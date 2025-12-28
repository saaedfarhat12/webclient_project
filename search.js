// ===== Put your YouTube API key here =====
const YT_API_KEY = "PASTE_YOUR_API_KEY_HERE";

const resultsEl = document.getElementById("results");
const queryEl = document.getElementById("query");
const searchBtn = document.getElementById("searchBtn");
const statusText = document.getElementById("statusText");

// Header
const helloText = document.getElementById("helloText");
const userTag = document.getElementById("userTag");
const userAvatar = document.getElementById("userAvatar");
const logoutBtn = document.getElementById("logoutBtn");

// Play modal
const playModal = document.getElementById("playModal");
const closePlay = document.getElementById("closePlay");
const player = document.getElementById("player");
const playTitle = document.getElementById("playTitle");

// Fav modal
const favModal = document.getElementById("favModal");
const closeFav = document.getElementById("closeFav");
const playlistSelect = document.getElementById("playlistSelect");
const newPlaylistName = document.getElementById("newPlaylistName");
const saveFavBtn = document.getElementById("saveFavBtn");
const favError = document.getElementById("favError");

// Toast
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
let toastTimer = null;

let selectedVideoToSave = null;

// ===== Check login (required) =====
const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
if (!currentUser) window.location.href = "login.html";

// Welcome message
helloText.textContent = `Hello ${currentUser.firstName}`;
userTag.textContent = `@${currentUser.username}`;
if (currentUser.image) {
  userAvatar.src = currentUser.image;
} else {
  userAvatar.style.display = "none";
}

// Logout
logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("currentUser");
  window.location.href = "index.html";
});

// ===== Playlists per user in LocalStorage =====
function playlistsKey() {
  return `playlists_${currentUser.username}`;
}
function loadPlaylists() {
  return JSON.parse(localStorage.getItem(playlistsKey())) || [];
}
function savePlaylists(pls) {
  localStorage.setItem(playlistsKey(), JSON.stringify(pls));
}
function videoIsSaved(videoId) {
  const pls = loadPlaylists();
  return pls.some(p => (p.videos || []).some(v => v.videoId === videoId));
}

// ===== Helpers =====
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatViews(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return String(num);
}

function isoDurationToMmSs(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  const totalMin = h * 60 + min;
  return `${totalMin}:${String(s).padStart(2, "0")}`;
}

function showToast(message, isHtml = false) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.classList.remove("hidden");
  toastText[isHtml ? "innerHTML" : "textContent"] = message;
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

// ===== YouTube fetch =====
async function youtubeSearch(q) {
  const searchUrl =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;

  const res = await fetch(searchUrl);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "YouTube API error");

  const ids = data.items.map(it => it.id.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  const detailsUrl =
    "https://www.googleapis.com/youtube/v3/videos" +
    `?part=snippet,contentDetails,statistics&id=${ids.join(",")}&key=${YT_API_KEY}`;

  const res2 = await fetch(detailsUrl);
  const data2 = await res2.json();
  if (data2.error) throw new Error(data2.error.message || "YouTube API error");

  return data2.items.map(v => ({
    videoId: v.id,
    title: v.snippet.title,
    thumb: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
    views: v.statistics?.viewCount || "0",
    duration: isoDurationToMmSs(v.contentDetails?.duration || "PT0S"),
    channel: v.snippet.channelTitle || ""
  }));
}

// ===== Render results =====
function renderResults(videos) {
  resultsEl.innerHTML = "";

  videos.forEach(v => {
    const saved = videoIsSaved(v.videoId);

    const card = document.createElement("div");
    card.className = "video-card";

    card.innerHTML = `
      <div class="thumb-wrap" data-play="${v.videoId}">
        <img class="thumb" src="${v.thumb}" alt="thumbnail">
        <div class="duration">${v.duration}</div>
      </div>

      <div class="video-info">
        <div class="title" title="${escapeHtml(v.title)}" data-play="${v.videoId}">
          ${escapeHtml(v.title)}
        </div>

        <div class="meta">
          <span>${formatViews(v.views)} views</span>
          <span class="dot">•</span>
          <span>${escapeHtml(v.channel)}</span>
        </div>

        <div class="actions">
          <button class="small-btn" data-play="${v.videoId}">Play</button>
          <button class="small-btn ${saved ? "saved" : ""}" data-save="${v.videoId}">
            ${saved ? "Saved ✓" : "Add to favorites"}
          </button>
        </div>
      </div>
    `;

    resultsEl.appendChild(card);
  });

  // Play events
  resultsEl.querySelectorAll("[data-play]").forEach(el => {
    el.addEventListener("click", () => openPlay(el.getAttribute("data-play")));
  });

  // Save events
  resultsEl.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-save");

      if (videoIsSaved(id)) {
        showToast(`Already saved. Go to <a href="playlists.html">Playlists</a>.`, true);
        return;
      }

      const card = btn.closest(".video-card");
      const title = card.querySelector(".title")?.textContent || "";
      const thumb = card.querySelector(".thumb")?.src || "";
      const duration = card.querySelector(".duration")?.textContent || "";
      const channel = card.querySelector(".meta")?.textContent || "";

      selectedVideoToSave = { videoId: id, title, thumb, duration, channel };
      openFavModal();
    });
  });
}

// ===== Play modal =====
function openPlay(videoId) {
  // title from DOM
  const titleEl = document.querySelector(`.title[data-play="${videoId}"]`);
  playTitle.textContent = titleEl ? titleEl.textContent.trim() : "Playing";
  player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  playModal.classList.remove("hidden");
}
function closePlayModal() {
  player.src = "";
  playModal.classList.add("hidden");
}
closePlay.addEventListener("click", closePlayModal);
playModal.addEventListener("click", (e) => {
  if (e.target === playModal) closePlayModal();
});

// ===== Favorites modal =====
function openFavModal() {
  favError.textContent = "";
  newPlaylistName.value = "";

  const pls = loadPlaylists();
  playlistSelect.innerHTML = `<option value="">-- Select --</option>`;
  pls.forEach(pl => {
    const opt = document.createElement("option");
    opt.value = pl.id;
    opt.textContent = pl.name;
    playlistSelect.appendChild(opt);
  });

  favModal.classList.remove("hidden");
}
function closeFavModal() {
  favModal.classList.add("hidden");
  selectedVideoToSave = null;
}
closeFav.addEventListener("click", closeFavModal);
favModal.addEventListener("click", (e) => {
  if (e.target === favModal) closeFavModal();
});

saveFavBtn.addEventListener("click", () => {
  if (!selectedVideoToSave) return;

  const selectedId = playlistSelect.value;
  const newName = newPlaylistName.value.trim();

  if (!selectedId && !newName) {
    favError.textContent = "Choose a playlist OR type a new playlist name.";
    return;
  }

  let pls = loadPlaylists();
  let targetId = selectedId;

  // create new playlist
  if (!targetId && newName) {
    const newPl = { id: "pl_" + Date.now(), name: newName, videos: [] };
    pls.push(newPl);
    targetId = newPl.id;
  }

  const pl = pls.find(p => p.id === targetId);
  if (!pl) {
    favError.textContent = "Playlist not found.";
    return;
  }

  pl.videos = pl.videos || [];
  if (pl.videos.some(v => v.videoId === selectedVideoToSave.videoId)) {
    favError.textContent = "This video is already in that playlist.";
    return;
  }

  pl.videos.push(selectedVideoToSave);
  savePlaylists(pls);

  closeFavModal();

  // update button state
  const btn = document.querySelector(`[data-save="${selectedVideoToSave.videoId}"]`);
  if (btn) {
    btn.classList.add("saved");
    btn.textContent = "Saved ✓";
  }

  showToast(`Saved! Go to <a href="playlists.html">Playlists</a>.`, true);
});

// ===== Search action =====
async function doSearch() {
  const q = queryEl.value.trim();
  if (!q) {
    statusText.textContent = "Type something to search.";
    resultsEl.innerHTML = "";
    return;
  }

  if (YT_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
    statusText.textContent = "Paste your YouTube API key inside search.js (YT_API_KEY).";
    resultsEl.innerHTML = "";
    return;
  }

  statusText.textContent = "Searching...";
  resultsEl.innerHTML = "";

  try {
    const videos = await youtubeSearch(q);
    if (videos.length === 0) {
      statusText.textContent = "No results found.";
      return;
    }
    statusText.textContent = "";
    renderResults(videos);
  } catch (err) {
    statusText.textContent = err.message || "Error";
  }
}

searchBtn.addEventListener("click", doSearch);
queryEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});