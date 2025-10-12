// frontend/js/utils.js
let currentUser = null;
let allProducts = [];
const API_URL = 'http://localhost:5000';

const categoryDisplayMap = {
    'electronics': 'Electronics',
    'wearables': 'Wearables',
    'cybernetics': 'Cybernetics',
    'data': 'Data & Software'
};

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
  filterAndSortProducts(); 
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

function createProfileProductCard(product, context) {
    const card = document.createElement("div");
    card.className = "bg-gray-800 rounded-2xl p-6 card-neon-border flex flex-col";
    let contextInfo = '';
    
    const displayCategory = categoryDisplayMap[product.category] || product.category;

    if (context === 'sold' && product.buyer) {
        contextInfo = `<p class="text-sm text-green-400 mb-2">Sold to: ${product.buyer.name}</p>`;
    } else if (context === 'purchased' && product.seller) {
        contextInfo = `<p class="text-sm text-yellow-400 mb-2">Purchased from: ${product.seller.name}</p>`;
    } else if (context === 'listings') {
         contextInfo = `<p class="text-sm text-blue-400 mb-2">Status: Listed for sale</p>`;
    }

    card.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl mb-4">
        <h3 class="text-2xl font-bold text-neon-blue mb-2">${product.name}</h3>
        ${contextInfo}
        <p class="text-gray-400 flex-1 mb-4">${product.description}</p>
        <div class="flex items-center justify-between">
            <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
            <span class="text-xs px-2 py-1 rounded bg-gray-700">${displayCategory}</span>
        </div>
    `;
    return card;
}