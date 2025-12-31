/*************************************************
  app.js  — ONE SINGLE JS FILE FOR THE WHOLE PROJECT
  Part 2 (Server + users.json + playlists.json)
  + YouTube search
  + Playlists
  + Rating (stars) + Sort by rating
  + MP3 Upload to playlist (server uploads/)
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
  
    // Simple API helper
    async function api(url, options = {}) {
      const res = await fetch(url, {
        headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    }
  
    // ---------- YouTube API key ----------
    const YT_API_KEY = "AIzaSyBjEVanoV8OJ6iM_Hi_ODD2OT1DGyjq1GY";
  
    function openYoutube(videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
    }
  
    // ---------- Auth (server session) ----------
    const protectedPages = new Set(["search.html", "playlists.html"]);
    const page = (location.pathname.split("/").pop() || "").toLowerCase();
  
    let currentUser = null;
  
    async function loadMeOrRedirect() {
      try {
        currentUser = await api("/api/me");
        // Header
        if ($("helloText")) $("helloText").textContent = `Hello ${currentUser.firstName || ""}`.trim();
        if ($("userTag")) $("userTag").textContent = currentUser.username ? `@${currentUser.username}` : "";
        if ($("userAvatar")) {
          if (currentUser.image) $("userAvatar").src = currentUser.image;
          else $("userAvatar").style.display = "none";
        }
      } catch (e) {
        if (protectedPages.has(page)) {
          location.href = "login.html";
          return false;
        }
      }
      return true;
    }
  
    // Logout
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await api("/api/logout", { method: "POST" });
        } catch {}
        location.href = "index.html";
      });
    }
  
    // ---------- REGISTER ----------
    const registerForm = $("registerForm");
    if (registerForm) {
      const msg = $("msg");
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
          } else alert(t);
        };
        const setOk = (t) => {
          if (msg) {
            msg.style.color = "green";
            msg.textContent = t;
          } else alert(t);
        };
  
        if (!username || !password || !confirmPassword || !firstName) return setErr("All fields are required");
        if (!imageInput?.files?.length) return setErr("Please choose an image");
  
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/;
        if (!passwordRegex.test(password))
          return setErr("Password must be 6+ chars and include letter, number, special char");
  
        if (password !== confirmPassword) return setErr("Passwords do not match");
  
        const file = imageInput.files[0];
        const reader = new FileReader();
  
        reader.onload = async () => {
          try {
            await api("/api/register", {
              method: "POST",
              body: JSON.stringify({
                username,
                password,
                firstName,
                image: reader.result, // base64
              }),
            });
  
            setOk("Account created! Redirecting to login...");
            setTimeout(() => (location.href = "login.html"), 700);
          } catch (err) {
            setErr(err.message);
          }
        };
  
        reader.readAsDataURL(file);
      });
    }
  
    // ---------- LOGIN ----------
    const loginForm = $("loginForm");
    if (loginForm) {
      const loginError = $("loginError");
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
  
        const username = $("loginUsername")?.value.trim();
        const password = $("loginPassword")?.value || "";
  
        try {
          await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
          location.href = "search.html";
        } catch (err) {
          if (loginError) loginError.textContent = err.message || "Invalid username or password";
          else alert(err.message || "Invalid username or password");
        }
      });
    }
  
    // ---------- Playlists API ----------
    async function fetchPlaylists() {
      return await api("/api/playlists");
    }
    async function createPlaylist(name) {
      return await api("/api/playlists", { method: "POST", body: JSON.stringify({ name }) });
    }
    async function deletePlaylist(id) {
      return await api(`/api/playlists/${id}`, { method: "DELETE" });
    }
    async function addYoutubeToPlaylist(playlistId, video) {
      // server expects: videoId,title,thumb
      return await api(`/api/playlists/${playlistId}/videos`, {
        method: "POST",
        body: JSON.stringify({ videoId: video.id, title: video.title, thumb: video.thumb }),
      });
    }
    async function removeItem(playlistId, itemId) {
      return await api(`/api/playlists/${playlistId}/items/${itemId}`, { method: "DELETE" });
    }
    async function rateItem(playlistId, itemId, rating) {
      return await api(`/api/playlists/${playlistId}/items/${itemId}/rating`, {
        method: "PUT",
        body: JSON.stringify({ rating }),
      });
    }
    async function uploadMp3ToPlaylist(playlistId, file) {
      const fd = new FormData();
      fd.append("mp3", file);
  
      const res = await fetch(`/api/playlists/${playlistId}/mp3`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data;
    }
  
    // ---------- SEARCH (YouTube) ----------
    const queryEl = $("query");
    const searchBtn = $("searchBtn");
    const resultsEl = $("results");
    const statusText = $("statusText");
  
    // Favorites modal
    const favModal = $("favModal");
    const closeFav = $("closeFav");
    const playlistSelect = $("playlistSelect");
    const newPlaylistName = $("newPlaylistName");
    const saveFavBtn = $("saveFavBtn");
    const favError = $("favError");
  
    let selectedVideo = null;
  
    function closeFavModal() {
      if (!favModal) return;
      favModal.classList.add("hidden");
      selectedVideo = null;
    }
  
    async function fillPlaylistSelect() {
      if (!playlistSelect) return;
      const pls = await fetchPlaylists();
      playlistSelect.innerHTML = `<option value="">-- Select --</option>`;
      pls.forEach((pl) => {
        const opt = document.createElement("option");
        opt.value = pl.id;
        opt.textContent = pl.name;
        playlistSelect.appendChild(opt);
      });
    }
  
    async function openFavModal(video) {
      selectedVideo = video;
      if (!favModal) return;
  
      if (favError) favError.textContent = "";
      if (newPlaylistName) newPlaylistName.value = "";
      await fillPlaylistSelect();
  
      favModal.classList.remove("hidden");
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
  
        const thumbWrap = document.createElement("div");
        thumbWrap.className = "thumb-wrap";
        thumbWrap.addEventListener("click", () => openYoutube(v.id));
  
        const img = document.createElement("img");
        img.className = "thumb";
        img.src = v.thumb;
        img.alt = "thumbnail";
        thumbWrap.appendChild(img);
  
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
  
      if (!YT_API_KEY) {
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
  
    if (closeFav && favModal) closeFav.addEventListener("click", closeFavModal);
    if (favModal) {
      favModal.addEventListener("click", (e) => {
        if (e.target === favModal) closeFavModal();
      });
    }
  
    if (saveFavBtn) {
      saveFavBtn.addEventListener("click", async () => {
        if (!selectedVideo) return;
  
        const selectedId = playlistSelect ? playlistSelect.value : "";
        const newName = (newPlaylistName?.value || "").trim();
  
        try {
          let targetId = selectedId;
  
          if (!targetId && newName) {
            const created = await createPlaylist(newName);
            targetId = created.id;
          }
  
          if (!targetId) {
            if (favError) favError.textContent = "Choose a playlist OR type a new playlist name.";
            return;
          }
  
          await addYoutubeToPlaylist(targetId, selectedVideo);
  
          closeFavModal();
          alert("Saved!");
        } catch (err) {
          if (favError) favError.textContent = err.message;
        }
      });
    }
  
    // ---------- PLAYLISTS PAGE ----------
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
  
    // MP3 elements (you added them in playlists.html)
    const uploadMp3Btn = $("uploadMp3Btn");
    const mp3Input = $("mp3Input");
  
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
  
    // ⭐ rating stars
    function renderStars(rating, itemId) {
      let html = "";
      for (let i = 1; i <= 5; i++) {
        const on = i <= (rating || 0);
        html += `<span class="star ${on ? "on" : ""}" data-rate="${i}" data-item="${escapeHtml(itemId)}">★</span>`;
      }
      return html;
    }
  
    // Default thumb for MP3 (small inline icon)
    const MP3_THUMB =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225">
          <rect width="100%" height="100%" fill="#111"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="48">MP3</text>
        </svg>`
      );
  
    // Only run playlists logic if playlists elements exist
    if (playlistList && videosArea && activePlaylistName && activePlaylistMeta) {
      let selectedPlaylistId = null;
      let playlistsCache = [];
  
      async function refreshPlaylists() {
        playlistsCache = await fetchPlaylists();
        renderSidebar();
        if (!selectedPlaylistId && playlistsCache.length > 0) {
          selectPlaylist(playlistsCache[0].id);
        } else {
          renderVideos();
        }
      }
  
      function getSelectedPlaylist() {
        return playlistsCache.find((p) => p.id === selectedPlaylistId) || null;
      }
  
      function renderSidebar() {
        playlistList.innerHTML = "";
  
        if (playlistsCache.length === 0) {
          playlistList.innerHTML = `<div class="pl-empty">No playlists yet. Click <b>+ New Playlist</b>.</div>`;
          activePlaylistName.textContent = "Choose a playlist";
          activePlaylistMeta.textContent = "";
          videosArea.className = "pl-videos-empty";
          videosArea.textContent = "Create a playlist first.";
  
          if (deletePlaylistBtn) deletePlaylistBtn.disabled = true;
          if (playPlaylistBtn) playPlaylistBtn.disabled = true;
          if (uploadMp3Btn) uploadMp3Btn.disabled = true;
          return;
        }
  
        playlistsCache.forEach((pl) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = `pl-item ${pl.id === selectedPlaylistId ? "active" : ""}`;
          item.innerHTML = `
            <div class="pl-item-name">${escapeHtml(pl.name)}</div>
            <div class="pl-item-count">${(pl.videos || []).length} items</div>
          `;
          item.addEventListener("click", () => selectPlaylist(pl.id));
          playlistList.appendChild(item);
        });
      }
  
      function selectPlaylist(id) {
        const pl = playlistsCache.find((p) => p.id === id);
        if (!pl) return;
  
        selectedPlaylistId = id;
        activePlaylistName.textContent = pl.name;
        activePlaylistMeta.textContent = `${(pl.videos || []).length} items`;
  
        if (deletePlaylistBtn) deletePlaylistBtn.disabled = false;
        if (playPlaylistBtn) playPlaylistBtn.disabled = false;
        if (uploadMp3Btn) uploadMp3Btn.disabled = false;
  
        renderSidebar();
        renderVideos();
      }
  
      function renderVideos() {
        const pl = getSelectedPlaylist();
  
        if (!pl) {
          videosArea.className = "pl-videos-empty";
          videosArea.textContent = "Choose a playlist from the list";
          return;
        }
  
        let items = [...(pl.videos || [])];
  
        // Filter
        const q = (filterInput?.value || "").trim().toLowerCase();
        if (q) items = items.filter((v) => (v.title || "").toLowerCase().includes(q));
  
        // Sort
        const mode = sortSelect?.value || "az";
        if (mode === "rate") {
          items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else {
          items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
          if (mode === "za") items.reverse();
        }
  
        if (items.length === 0) {
          videosArea.className = "pl-videos-empty";
          videosArea.textContent = "No items found in this playlist.";
          return;
        }
  
        videosArea.className = "pl-videos-grid";
        videosArea.innerHTML = "";
  
        items.forEach((v) => {
          const itemId = v.videoId || v.id; // yt uses videoId, mp3 uses id
          const isMp3 = v.type === "mp3";
  
          const thumb = isMp3 ? (v.thumb || MP3_THUMB) : (v.thumb || MP3_THUMB);
  
          const card = document.createElement("div");
          card.className = "pl-video-card";
  
          card.innerHTML = `
            <div class="pl-thumb-wrap">
              <img class="pl-thumb" src="${escapeHtml(thumb)}" alt="thumb" />
            </div>
  
            <div class="pl-vinfo">
              <div class="pl-vtitle" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</div>
  
              <div class="pl-rating">
                ${renderStars(v.rating || 0, itemId)}
              </div>
  
              <div class="pl-vactions">
                <button class="small-btn" type="button" data-open="${escapeHtml(itemId)}">Open</button>
                <button class="small-btn danger-mini" type="button" data-remove="${escapeHtml(itemId)}">Remove</button>
              </div>
            </div>
          `;
  
          // Open
          card.querySelector("[data-open]")?.addEventListener("click", () => {
            if (isMp3) {
              window.open(v.url, "_blank");
            } else {
              openYoutube(v.videoId);
            }
          });
  
          // Remove
          card.querySelector("[data-remove]")?.addEventListener("click", async () => {
            try {
              await removeItem(selectedPlaylistId, itemId);
              await refreshPlaylists();
              showToast("Removed.");
            } catch (e) {
              alert(e.message);
            }
          });
  
          // Rating click
          card.querySelectorAll(".star").forEach((star) => {
            star.addEventListener("click", async () => {
              const rate = Number(star.getAttribute("data-rate"));
              try {
                await rateItem(selectedPlaylistId, itemId, rate);
                await refreshPlaylists();
                showToast("Rating saved ⭐");
              } catch (e) {
                alert(e.message);
              }
            });
          });
  
          videosArea.appendChild(card);
        });
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
        createPlaylistBtn.addEventListener("click", async () => {
          const name = (playlistNameInput?.value || "").trim();
          if (modalError) modalError.textContent = "";
  
          if (!name) {
            if (modalError) modalError.textContent = "Please enter a playlist name.";
            return;
          }
  
          try {
            const pl = await createPlaylist(name);
            closeModalFn();
            await refreshPlaylists();
            selectPlaylist(pl.id);
            showToast("Playlist created");
          } catch (e) {
            if (modalError) modalError.textContent = e.message;
          }
        });
      }
  
      // Delete playlist
      if (deletePlaylistBtn) {
        deletePlaylistBtn.addEventListener("click", async () => {
          const pl = getSelectedPlaylist();
          if (!pl) return;
          if (!confirm(`Delete playlist "${pl.name}"?`)) return;
  
          try {
            await deletePlaylist(pl.id);
            selectedPlaylistId = null;
            await refreshPlaylists();
            showToast("Playlist deleted");
          } catch (e) {
            alert(e.message);
          }
        });
      }
  
      // Play playlist (open first item)
      if (playPlaylistBtn) {
        playPlaylistBtn.addEventListener("click", () => {
          const pl = getSelectedPlaylist();
          if (!pl || !(pl.videos || []).length) {
            alert("This playlist is empty");
            return;
          }
          const first = pl.videos[0];
          if (first.type === "mp3") window.open(first.url, "_blank");
          else openYoutube(first.videoId);
        });
      }
  
      // Filter/sort
      if (filterInput) filterInput.addEventListener("input", renderVideos);
      if (sortSelect) sortSelect.addEventListener("change", renderVideos);
  
      // MP3 Upload
      if (uploadMp3Btn && mp3Input) {
        uploadMp3Btn.addEventListener("click", () => {
          if (!selectedPlaylistId) return;
          mp3Input.value = "";
          mp3Input.click();
        });
  
        mp3Input.addEventListener("change", async () => {
          const file = mp3Input.files?.[0];
          if (!file || !selectedPlaylistId) return;
  
          try {
            await uploadMp3ToPlaylist(selectedPlaylistId, file);
            await refreshPlaylists();
            showToast("MP3 uploaded ✅");
          } catch (e) {
            alert(e.message);
          }
        });
      }
  
      // Init playlists
      refreshPlaylists();
    }
  
    // ---------- Start: load session user ----------
    // This will redirect protected pages if not logged in
    loadMeOrRedirect();
  });