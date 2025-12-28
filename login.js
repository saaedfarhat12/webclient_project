const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    let users = JSON.parse(localStorage.getItem("users")) || [];

    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        loginError.textContent = "Invalid username or password";
        return;
    }

    // Save logged in user
    sessionStorage.setItem("currentUser", JSON.stringify(user));

    // Go to main page
    window.location.href = "search.html";
});