// frontend/js/utils.js
let currentUser = null;
let allProducts = [];
const API_URL = 'http://localhost:5000';

function checkAuthState() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        currentUser = { id: payload.user.id, name: localStorage.getItem('username') };
      } else {
        logout();
      }
    } catch (e) {
      logout();
    }
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  currentUser = null;
  renderUI();
  showMessage("You have been logged out.");
  showSection("hero");
  updateCartCount();
}

function showMessage(message, duration = 3000) {
  const msgBox = document.getElementById("message-box");
  msgBox.textContent = message;
  msgBox.classList.remove("hidden");
  setTimeout(() => msgBox.classList.add("hidden"), duration);
}

function showLoadingMessage(message) {
  const msgBox = document.getElementById("message-box");
  msgBox.textContent = message;
  msgBox.classList.remove("hidden");
  msgBox.classList.add("animate-pulse", "text-neon-blue");
}

function hideLoadingMessage() {
  const msgBox = document.getElementById("message-box");
  msgBox.classList.add("hidden");
  msgBox.classList.remove("animate-pulse", "text-neon-blue");
}