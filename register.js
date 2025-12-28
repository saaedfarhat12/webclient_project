document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const msg = document.getElementById("msg");
  
    form.addEventListener("submit", (e) => {
      e.preventDefault();
  
      msg.textContent = "";
      msg.style.color = "red";
  
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const firstName = document.getElementById("firstName").value.trim();
      const imageInput = document.getElementById("image");
  
      // Required fields
      if (!username || !password || !confirmPassword || !firstName) {
        msg.textContent = "All fields are required";
        return;
      }
      if (!imageInput.files || imageInput.files.length === 0) {
        msg.textContent = "Please choose an image";
        return;
      }
  
      // Password rules: 6+ chars, 1 letter, 1 number, 1 special
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/;
      if (!passwordRegex.test(password)) {
        msg.textContent = "Password must be 6+ chars and include letter, number, special char";
        return;
      }
  
      // Confirm password
      if (password !== confirmPassword) {
        msg.textContent = "Passwords do not match";
        return;
      }
  
      // Load users
      let users = JSON.parse(localStorage.getItem("users")) || [];
  
      // Unique username (case-insensitive)
      const exists = users.some(u => (u.username || "").toLowerCase() === username.toLowerCase());
      if (exists) {
        msg.textContent = "Username already exists";
        return;
      }
  
      // ✅ Save user first (image empty for now)
      const newUser = { username, password, firstName, image: "" };
      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));
  
      // ✅ Show success immediately
      msg.style.color = "green";
      msg.textContent = "Account created! Redirecting to login...";
  
      // ✅ Start redirect NOW (guaranteed)
      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
  
      // ✅ Read image in background and update saved user (doesn't block redirect)
      const reader = new FileReader();
      reader.onload = () => {
        const updatedUsers = JSON.parse(localStorage.getItem("users")) || [];
        const i = updatedUsers.findIndex(u => (u.username || "").toLowerCase() === username.toLowerCase());
        if (i !== -1) {
          updatedUsers[i].image = reader.result;
          localStorage.setItem("users", JSON.stringify(updatedUsers));
        }
      };
      reader.readAsDataURL(imageInput.files[0]);
    });
  });