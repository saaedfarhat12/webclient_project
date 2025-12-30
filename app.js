/*************************************************
  app.js  — ONE SINGLE JS FILE FOR THE WHOLE PROJECT
  Part 1 (LocalStorage + SessionStorage)
  + YouTube search
  + Playlists
  + Rating (stars) + Sort by rating
**************************************************/

document.addEventListener("DOMContentLoaded", () => {
    // ---------- Helpers ----------
    const $ = (id) => document.getElementById(id);
  
    function escapeHtml(str) {
      return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  
    // ---------- LocalStorage Users ----------
    function loadUsers() {
      return JSON.parse(localStorage.getItem("users")) || [];
    }
    function saveUsers(users) {
      localStorage.setItem("users", JSON.stringify(users));
    }
  
    // ---------- Session User ----------
    function getCurrentUser() {
      try {
        return JSON.parse(sessionStorage.getItem("currentUser"));
      } catch {
        return null;
      }
    }
    function setCurrentUser(userObj) {
      sessionStorage.setItem("currentUser", JSON.stringify(userObj));
    }
  
    // ---------- Page Guard ----------
    const protectedPages = new Set(["search.html", "playlists.html"]);
    const page = (location.pathname.split("/").pop() || "").toLowerCase();
  
    if (protectedPages.has(page) && !getCurrentUser()) {
      location.href = "login.html";
      return;
    }
  
    // ---------- Header (if exists) ----------
    const currentUser = getCurrentUser();
    if (currentUser) {
      if ($("helloText")) $("helloText").textContent = `Hello ${currentUser.firstName || ""}`.trim();
      if ($("userTag")) $("userTag").textContent = currentUser.username ? `@${currentUser.username}` : "";
      if ($("userAvatar")) {
        if (currentUser.image) $("userAvatar").src = currentUser.image;
        else $("userAvatar").style.display = "none";
      }
    }
  
    // ---------- Logout ----------
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("currentUser");
        location.href = "index.html";
      });
    }
  
    /*********************
      REGISTER PAGE LOGIC
    *********************/
    const registerForm = $("registerForm");
    if (registerForm) {
      const msg = $("msg"); // optional
      registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
  
        const username = $("username")?.value.trim();
        const password = $("password")?.value || "";
        const confirmPassword = $("confirmPassword")?.value || "";
        const firstName = $("firstName")?.value.trim();
        const imageInput = $("image");
  
        const setErr = (t) => {
          if (msg) {
            msg.style.color = "red";
            msg.textContent = t;
          } else {
            alert(t);
          }
        };
        const setOk = (t) => {
          if (msg) {
            msg.style.color = "green";
            msg.textContent = t;
          } else {
            alert(t);
          }
        };
  
        if (!username || !password || !confirmPassword || !firstName) return setErr("All fields are required");
        if (!imageInput?.files?.length) return setErr("Please choose an image");
  
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/;
        if (!passwordRegex.test(password))
          return setErr("Password must be 6+ chars and include letter, number, special char");
  
        if (password !== confirmPassword) return setErr("Passwords do not match");
  
        const users = loadUsers();
        const exists = users.some((u) => String(u.username || "").toLowerCase() === username.toLowerCase());
        if (exists) return setErr("Username already exists");
  
        const file = imageInput.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          users.push({
            username,
            password,
            firstName,
            image: reader.result, // base64
          });
          saveUsers(users);
  
          setOk("Account created! Redirecting to login...");
          setTimeout(() => (location.href = "login.html"), 700);
        };
        reader.readAsDataURL(file);
      });
    }
  
    /******************
      LOGIN PAGE LOGIC
    ******************/
    const loginForm = $("loginForm");
    if (loginForm) {
      const loginError = $("loginError"); // optional
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
  
        const username = $("loginUsername")?.value.trim();
        const password = $("loginPassword")?.value || "";
  
        const users = loadUsers();
        const user = users.find((u) => u.username === username && u.password === password);
  
        if (!user) {
          if (loginError) loginError.textContent = "Invalid username or password";
          else alert("Invalid username or password");
          return;
        }
  
        setCurrentUser(user);
        location.href = "search.html";
      });
    }
  
    /****************************
      PLAYLISTS STORAGE (PER USER)
    ****************************/
    function playlistsKey() {
      const u = getCurrentUser();
      return u ? `playlists_${u.username}` : "playlists_guest";
    }
    function loadPlaylists() {
      return JSON.parse(localStorage.getItem(playlistsKey())) || [];
    }
    function savePlaylists(pls) {
      localStorage.setItem(playlistsKey(), JSON.stringify(pls));
    }
  
    /*********************
      SEARCH PAGE (YouTube)
      + Add to Favorites (Playlists)
    *********************/
    const queryEl = $("query");
    const searchBtn = $("searchBtn");
    const resultsEl = $("results");
    const statusText = $("statusText");
  
    // Favorites modal elements exist only on search.html
    const favModal = $("favModal");
    const closeFav = $("closeFav");
    const playlistSelect = $("playlistSelect");
    const newPlaylistName = $("newPlaylistName");
    const saveFavBtn = $("saveFavBtn");
    const favError = $("favError");
  
    //  YouTube API key 
    const YT_API_KEY = "AIzaSyBjEVanoV8OJ6iM_Hi_ODD2OT1DGyjq1GY";
  
    let selectedVideo = null; // {id,title,thumb}
  
    function openYoutube(videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
    }
  
    function fillPlaylistSelect() {
      if (!playlistSelect) return;
      const pls = loadPlaylists();
      playlistSelect.innerHTML = `<option value="">-- Select --</option>`;
      pls.forEach((pl) => {
        const opt = document.createElement("option");
        opt.value = pl.id;
        opt.textContent = pl.name;
        playlistSelect.appendChild(opt);
      });
    }
  
    function openFavModal(video) {
      selectedVideo = video;
      if (!favModal) return;
  
      if (favError) favError.textContent = "";
      if (newPlaylistName) newPlaylistName.value = "";
      fillPlaylistSelect();
  
      favModal.classList.remove("hidden");
    }
  
    function closeFavModal() {
      if (!favModal) return;
      favModal.classList.add("hidden");
      selectedVideo = null;
    }
  
    async function youtubeSearch(q) {
      const searchUrl =
        "https://www.googleapis.com/youtube/v3/search" +
        `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;
  
      const res = await fetch(searchUrl);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "YouTube API error");
  
      const ids = (data.items || []).map((it) => it?.id?.videoId).filter(Boolean);
      if (ids.length === 0) return [];
  
      const detailsUrl =
        "https://www.googleapis.com/youtube/v3/videos" +
        `?part=snippet&id=${ids.join(",")}&key=${YT_API_KEY}`;
  
      const res2 = await fetch(detailsUrl);
      const data2 = await res2.json();
      if (data2.error) throw new Error(data2.error.message || "YouTube API error");
  
      return (data2.items || []).map((v) => ({
        id: v.id,
        title: v.snippet?.title || "",
        thumb: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
      }));
    }
  
    function renderResults(videos) {
      if (!resultsEl) return;
      resultsEl.innerHTML = "";
  
      videos.forEach((v) => {
        const card = document.createElement("div");
        card.className = "video-card";
  
        // Thumbnail
        const thumbWrap = document.createElement("div");
        thumbWrap.className = "thumb-wrap";
        thumbWrap.addEventListener("click", () => openYoutube(v.id));
  
        const img = document.createElement("img");
        img.className = "thumb";
        img.src = v.thumb;
        img.alt = "thumbnail";
        thumbWrap.appendChild(img);
  
        // Info
        const info = document.createElement("div");
        info.className = "video-info";
  
        const title = document.createElement("div");
        title.className = "title";
        title.title = v.title;
        title.textContent = v.title;
  
        const actions = document.createElement("div");
        actions.className = "actions";
  
        const playBtn = document.createElement("button");
        playBtn.className = "small-btn";
        playBtn.type = "button";
        playBtn.textContent = "Play";
        playBtn.addEventListener("click", () => openYoutube(v.id));
  
        const addBtn = document.createElement("button");
        addBtn.className = "small-btn";
        addBtn.type = "button";
        addBtn.textContent = "Add to Favorites";
        addBtn.addEventListener("click", () => openFavModal(v));
  
        actions.appendChild(playBtn);
        actions.appendChild(addBtn);
  
        info.appendChild(title);
        info.appendChild(actions);
  
        card.appendChild(thumbWrap);
        card.appendChild(info);
  
        resultsEl.appendChild(card);
      });
    }
  
    async function doSearch() {
      if (!queryEl || !resultsEl) return;
      const q = queryEl.value.trim();
      if (!q) {
        if (statusText) statusText.textContent = "Type something to search.";
        resultsEl.innerHTML = "";
        return;
      }
  
      if (!YT_API_KEY || YT_API_KEY === "PUT_YOUR_API_KEY_HERE") {
        if (statusText) statusText.textContent = "Add your YouTube API key in app.js (YT_API_KEY).";
        return;
      }
  
      if (statusText) statusText.textContent = "Searching...";
      resultsEl.innerHTML = "";
  
      try {
        const videos = await youtubeSearch(q);
        if (videos.length === 0) {
          if (statusText) statusText.textContent = "No results found.";
          return;
        }
        if (statusText) statusText.textContent = "";
        renderResults(videos);
      } catch (err) {
        if (statusText) statusText.textContent = err.message || "Error";
      }
    }
  
    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (queryEl) {
      queryEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
    }
  
    // Favorites modal events
    if (closeFav && favModal) closeFav.addEventListener("click", closeFavModal);
    if (favModal) {
      favModal.addEventListener("click", (e) => {
        if (e.target === favModal) closeFavModal();
      });
    }
  
    if (saveFavBtn) {
      saveFavBtn.addEventListener("click", () => {
        if (!selectedVideo) return;
  
        const selectedId = playlistSelect ? playlistSelect.value : "";
        const newName = (newPlaylistName?.value || "").trim();
  
        if (!selectedId && !newName) {
          if (favError) favError.textContent = "Choose a playlist OR type a new playlist name.";
          return;
        }
  
        let pls = loadPlaylists();
        let targetId = selectedId;
  
        // Create playlist if needed
        if (!targetId && newName) {
          const exists = pls.some((p) => (p.name || "").toLowerCase() === newName.toLowerCase());
          if (exists) {
            if (favError) favError.textContent = "Playlist name already exists.";
            return;
          }
          const newPl = { id: "pl_" + Date.now(), name: newName, videos: [] };
          pls.push(newPl);
          targetId = newPl.id;
        }
  
        const pl = pls.find((p) => p.id === targetId);
        if (!pl) {
          if (favError) favError.textContent = "Playlist not found.";
          return;
        }
  
        pl.videos = pl.videos || [];
        const already = pl.videos.some((v) => v.id === selectedVideo.id);
        if (already) {
          if (favError) favError.textContent = "This video is already in that playlist.";
          return;
        }
  
        // ✅ ADD RATING DEFAULT
        pl.videos.push({
          id: selectedVideo.id,
          title: selectedVideo.title,
          thumb: selectedVideo.thumb,
          rating: 0,
        });
  
        savePlaylists(pls);
  
        closeFavModal();
        alert("Saved!");
      });
    }
  
    /*********************
      PLAYLISTS PAGE LOGIC
    *********************/
    const playlistList = $("playlistList");
    const videosArea = $("videosArea");
    const activePlaylistName = $("activePlaylistName");
    const activePlaylistMeta = $("activePlaylistMeta");
  
    const filterInput = $("filterInput");
    const sortSelect = $("sortSelect");
  
    const deletePlaylistBtn = $("deletePlaylistBtn");
    const playPlaylistBtn = $("playPlaylistBtn");
  
    const newPlaylistBtn = $("newPlaylistBtn");
    const plModal = $("plModal");
    const closeModal = $("closeModal");
    const playlistNameInput = $("playlistNameInput");
    const createPlaylistBtn = $("createPlaylistBtn");
    const modalError = $("modalError");
  
    // Play modal (optional exists in your playlists.html)
    const playModal = $("playModal");
    const closePlay = $("closePlay");
    const player = $("player");
    const playTitle = $("playTitle");
  
    // Toast (optional)
    const toast = $("toast");
    const toastText = $("toastText");
    let toastTimer = null;
  
    function showToast(message) {
      if (!toast || !toastText) return;
      if (toastTimer) clearTimeout(toastTimer);
      toastText.textContent = message;
      toast.classList.remove("hidden");
      toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
    }
  
    function openPlayer(videoId, titleText) {
      // You asked earlier for play to open YouTube new tab, but your playlists.html has a modal.
      // We'll OPEN NEW TAB to keep it consistent:
      openYoutube(videoId);
      // If you want modal play instead, tell me and I will switch.
    }
  
    if (closePlay && playModal) {
      closePlay.addEventListener("click", () => {
        playModal.classList.add("hidden");
        if (player) player.src = "";
      });
    }
  
    // Only run if playlists.html elements exist
    if (playlistList && videosArea && activePlaylistName && activePlaylistMeta) {
      let selectedPlaylistId = null;
  
      function getSelectedPlaylist() {
        return loadPlaylists().find((p) => p.id === selectedPlaylistId) || null;
      }
  
      // ⭐⭐ RATING HELPERS (ADDED) ⭐⭐
      function renderStars(rating, videoId) {
        let html = "";
        for (let i = 1; i <= 5; i++) {
          const on = i <= rating;
          html += `<span class="star ${on ? "on" : ""}" data-rate="${i}" data-video="${escapeHtml(
            videoId
          )}">★</span>`;
        }
        return html;
      }
  
      function setRating(videoId, rate) {
        const pls = loadPlaylists();
        const pl = pls.find((p) => p.id === selectedPlaylistId);
        if (!pl) return;
  
        const video = (pl.videos || []).find((v) => v.id === videoId);
        if (!video) return;
  
        video.rating = rate;
        savePlaylists(pls);
  
        renderVideos();
        showToast("Rating saved ⭐");
      }
  
      function renderSidebar() {
        const pls = loadPlaylists();
        playlistList.innerHTML = "";
  
        if (pls.length === 0) {
          playlistList.innerHTML = `<div class="pl-empty">No playlists yet. Click <b>+ New Playlist</b>.</div>`;
          activePlaylistName.textContent = "Choose a playlist";
          activePlaylistMeta.textContent = "";
          videosArea.className = "pl-videos-empty";
          videosArea.textContent = "Create a playlist first.";
  
          if (deletePlaylistBtn) deletePlaylistBtn.disabled = true;
          if (playPlaylistBtn) playPlaylistBtn.disabled = true;
          return;
        }
  
        pls.forEach((pl) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = `pl-item ${pl.id === selectedPlaylistId ? "active" : ""}`;
          item.innerHTML = `
            <div class="pl-item-name">${escapeHtml(pl.name)}</div>
            <div class="pl-item-count">${(pl.videos || []).length} videos</div>
          `;
          item.addEventListener("click", () => selectPlaylist(pl.id));
          playlistList.appendChild(item);
        });
      }
  
      function renderVideos() {
        const pl = getSelectedPlaylist();
  
        if (!pl) {
          videosArea.className = "pl-videos-empty";
          videosArea.textContent = "Choose a playlist from the list";
          return;
        }
  
        let vids = [...(pl.videos || [])];
  
        // Filter
        const q = (filterInput?.value || "").trim().toLowerCase();
        if (q) vids = vids.filter((v) => (v.title || "").toLowerCase().includes(q));
  
        // Sort (UPDATED: includes rating)
        const mode = sortSelect?.value || "az";
        if (mode === "rate") {
          vids.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else {
          vids.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
          if (mode === "za") vids.reverse();
        }
  
        if (vids.length === 0) {
          videosArea.className = "pl-videos-empty";
          videosArea.textContent = "No videos found in this playlist.";
          return;
        }
  
        videosArea.className = "pl-videos-grid";
        videosArea.innerHTML = "";
  
        vids.forEach((v) => {
          if (typeof v.rating !== "number") v.rating = 0;
  
          const card = document.createElement("div");
          card.className = "pl-video-card";
  
          // ✅ SAME DESIGN + JUST ADD RATING BLOCK
          card.innerHTML = `
            <div class="pl-thumb-wrap">
              <img class="pl-thumb" src="${escapeHtml(v.thumb || "")}" alt="thumb" />
            </div>
  
            <div class="pl-vinfo">
              <div class="pl-vtitle" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</div>
  
              <div class="pl-rating">
                ${renderStars(v.rating || 0, v.id)}
              </div>
  
              <div class="pl-vactions">
                <button class="small-btn" type="button" data-open="${escapeHtml(v.id)}">Open</button>
                <button class="small-btn danger-mini" type="button" data-remove="${escapeHtml(v.id)}">Remove</button>
              </div>
            </div>
          `;
  
          // Open
          card.querySelector("[data-open]")?.addEventListener("click", () => {
            openPlayer(v.id, v.title);
          });
  
          // Remove
          card.querySelector("[data-remove]")?.addEventListener("click", () => {
            removeVideoFromPlaylist(v.id);
          });
  
          // ⭐ Rating click (ADDED)
          card.querySelectorAll(".star").forEach((star) => {
            star.addEventListener("click", () => {
              const rate = Number(star.getAttribute("data-rate"));
              setRating(v.id, rate);
            });
          });
  
          videosArea.appendChild(card);
        });
      }
  
      function selectPlaylist(id) {
        const pls = loadPlaylists();
        const pl = pls.find((p) => p.id === id);
        if (!pl) return;
  
        selectedPlaylistId = id;
        activePlaylistName.textContent = pl.name;
        activePlaylistMeta.textContent = `${(pl.videos || []).length} videos`;
  
        if (deletePlaylistBtn) deletePlaylistBtn.disabled = false;
        if (playPlaylistBtn) playPlaylistBtn.disabled = false;
  
        renderSidebar();
        renderVideos();
      }
  
      function removeVideoFromPlaylist(videoId) {
        const pls = loadPlaylists();
        const pl = pls.find((p) => p.id === selectedPlaylistId);
        if (!pl) return;
  
        pl.videos = (pl.videos || []).filter((v) => v.id !== videoId);
        savePlaylists(pls);
  
        activePlaylistMeta.textContent = `${(pl.videos || []).length} videos`;
        renderSidebar();
        renderVideos();
        showToast("Removed from playlist");
      }
  
      // Modal create playlist
      function openModal() {
        if (!plModal) return;
        if (modalError) modalError.textContent = "";
        if (playlistNameInput) playlistNameInput.value = "";
        plModal.classList.remove("hidden");
        setTimeout(() => playlistNameInput?.focus(), 0);
      }
      function closeModalFn() {
        if (!plModal) return;
        plModal.classList.add("hidden");
      }
  
      if (newPlaylistBtn) newPlaylistBtn.addEventListener("click", openModal);
      if (closeModal) closeModal.addEventListener("click", closeModalFn);
      if (plModal) {
        plModal.addEventListener("click", (e) => {
          if (e.target === plModal) closeModalFn();
        });
      }
  
      if (createPlaylistBtn) {
        createPlaylistBtn.addEventListener("click", () => {
          const name = (playlistNameInput?.value || "").trim();
          if (modalError) modalError.textContent = "";
  
          if (!name) {
            if (modalError) modalError.textContent = "Please enter a playlist name.";
            return;
          }
  
          const pls = loadPlaylists();
          const exists = pls.some((p) => (p.name || "").toLowerCase() === name.toLowerCase());
          if (exists) {
            if (modalError) modalError.textContent = "Playlist name already exists.";
            return;
          }
  
          const newPl = { id: "pl_" + Date.now(), name, videos: [] };
          pls.push(newPl);
          savePlaylists(pls);
  
          closeModalFn();
          renderSidebar();
          selectPlaylist(newPl.id);
          showToast("Playlist created");
        });
      }
  
      // Delete playlist
      if (deletePlaylistBtn) {
        deletePlaylistBtn.addEventListener("click", () => {
          const pl = getSelectedPlaylist();
          if (!pl) return;
  
          if (!confirm(`Delete playlist "${pl.name}"?`)) return;
  
          let pls = loadPlaylists();
          pls = pls.filter((p) => p.id !== selectedPlaylistId);
          savePlaylists(pls);
  
          selectedPlaylistId = null;
          renderSidebar();
  
          const left = loadPlaylists();
          if (left.length > 0) selectPlaylist(left[0].id);
        });
      }
  
      // Play playlist (open first video in new tab)
      if (playPlaylistBtn) {
        playPlaylistBtn.addEventListener("click", () => {
          const pl = getSelectedPlaylist();
          if (!pl || !(pl.videos || []).length) {
            alert("This playlist is empty");
            return;
          }
          openYoutube(pl.videos[0].id);
        });
      }
  
      // Filter/sort
      if (filterInput) filterInput.addEventListener("input", renderVideos);
      if (sortSelect) sortSelect.addEventListener("change", renderVideos);
  
      // Init
      renderSidebar();
      const pls = loadPlaylists();
      if (pls.length > 0) selectPlaylist(pls[0].id);
    }
  });