const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// ---------- Middleware ----------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "mySecretKey123",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false },
  })
);

// Serve your frontend files
app.use(express.static(path.join(__dirname)));

// Uploads static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- JSON Files ----------
const USERS_FILE = path.join(__dirname, "data", "users.json");
const PLAYLISTS_FILE = path.join(__dirname, "data", "playlists.json");

// Ensure files exist
function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
}
ensureFile(USERS_FILE);
ensureFile(PLAYLISTS_FILE);

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8") || "[]");
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ---------- Auth Middleware ----------
function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Login required" });
  next();
}

// ---------- Multer (MP3) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, safe);
  },
});

function mp3Only(req, file, cb) {
  const ok = file.mimetype === "audio/mpeg" || file.originalname.toLowerCase().endsWith(".mp3");
  cb(ok ? null : new Error("Only MP3 allowed"), ok);
}

const upload = multer({
  storage,
  fileFilter: mp3Only,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ================= AUTH API =================

// Register
app.post("/api/register", (req, res) => {
  const { username, password, firstName, image } = req.body;
  if (!username || !password || !firstName || !image) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const users = readJSON(USERS_FILE);
  const exists = users.some(
    (u) => String(u.username || "").toLowerCase() === String(username).toLowerCase()
  );
  if (exists) return res.status(400).json({ error: "User exists" });

  users.push({ username, password, firstName, image });
  writeJSON(USERS_FILE, users);

  res.json({ ok: true });
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid login" });

  req.session.user = user.username;
  res.json({ ok: true });
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Current user
app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.username === req.session.user);
  if (!user) return res.status(401).json({ error: "Not logged in" });

  const safe = { ...user };
  delete safe.password;
  res.json(safe);
});

// ================= PLAYLISTS API =================

// Get playlists
app.get("/api/playlists", auth, (req, res) => {
  const all = readJSON(PLAYLISTS_FILE);
  res.json(all.filter((p) => p.username === req.session.user));
});

// Create playlist
app.post("/api/playlists", auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const all = readJSON(PLAYLISTS_FILE);
  const newPl = { id: "pl_" + Date.now(), username: req.session.user, name, videos: [] };

  all.push(newPl);
  writeJSON(PLAYLISTS_FILE, all);
  res.json(newPl);
});

// Delete playlist
app.delete("/api/playlists/:id", auth, (req, res) => {
  const all = readJSON(PLAYLISTS_FILE);
  const filtered = all.filter(
    (p) => !(p.id === req.params.id && p.username === req.session.user)
  );
  writeJSON(PLAYLISTS_FILE, filtered);
  res.json({ ok: true });
});

// Add YouTube video
app.post("/api/playlists/:id/videos", auth, (req, res) => {
  const { videoId, title, thumb } = req.body;
  if (!videoId || !title || !thumb) return res.status(400).json({ error: "Missing fields" });

  const all = readJSON(PLAYLISTS_FILE);
  const pl = all.find((p) => p.id === req.params.id && p.username === req.session.user);
  if (!pl) return res.status(404).json({ error: "Playlist not found" });

  const exists = pl.videos.some((v) => v.type === "yt" && v.videoId === videoId);
  if (exists) return res.status(400).json({ error: "Already saved" });

  pl.videos.push({ type: "yt", videoId, title, thumb, rating: 0 });
  writeJSON(PLAYLISTS_FILE, all);
  res.json(pl);
});

// Remove item (yt or mp3)
app.delete("/api/playlists/:id/items/:itemId", auth, (req, res) => {
  const all = readJSON(PLAYLISTS_FILE);
  const pl = all.find((p) => p.id === req.params.id && p.username === req.session.user);
  if (!pl) return res.status(404).json({ error: "Playlist not found" });

  pl.videos = pl.videos.filter((x) => (x.videoId || x.id) !== req.params.itemId);
  writeJSON(PLAYLISTS_FILE, all);
  res.json(pl);
});

// Rate item
app.put("/api/playlists/:id/items/:itemId/rating", auth, (req, res) => {
  const rateNum = Number(req.body.rating);
  if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 5) {
    return res.status(400).json({ error: "Rating must be 0..5" });
  }

  const all = readJSON(PLAYLISTS_FILE);
  const pl = all.find((p) => p.id === req.params.id && p.username === req.session.user);
  if (!pl) return res.status(404).json({ error: "Playlist not found" });

  const item = pl.videos.find((x) => (x.videoId || x.id) === req.params.itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  item.rating = rateNum;
  writeJSON(PLAYLISTS_FILE, all);
  res.json(pl);
});

// Upload MP3 and add to playlist
app.post("/api/playlists/:id/mp3", auth, upload.single("mp3"), (req, res) => {
  const all = readJSON(PLAYLISTS_FILE);
  const pl = all.find((p) => p.id === req.params.id && p.username === req.session.user);
  if (!pl) return res.status(404).json({ error: "Playlist not found" });

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  pl.videos.push({
    type: "mp3",
    id: "mp3_" + Date.now(),
    title: req.file.originalname.replace(/\.mp3$/i, ""),
    url: "/uploads/" + req.file.filename,
    rating: 0,
  });

  writeJSON(PLAYLISTS_FILE, all);
  res.json(pl);
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});