// frontend/js/utils.js
const API_URL = `http://${window.location.hostname}:5000`;

let currentUser = null;
let allProducts = [];
let purchaseIntentProductId = null;

const categoryDisplayMap = {
    'electronics': 'Electronics',
    'wearables': 'Wearables',
    'cybernetics': 'Cybernetics',
    'data': 'Data & Software',
    'gadgets': 'Gadgets',
    'others': 'Others'
};

// *** NEW FUNCTION ***
function formatAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
// *** END NEW FUNCTION ***


function checkAuthState() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        currentUser = { 
          id: payload.user.id, 
          name: payload.user.name, 
          walletAddress: payload.user.walletAddress 
        };
        if(!currentUser.name) currentUser.name = localStorage.getItem('username');
      } else {
        logout();
      }
    } catch (e) {
      console.error("Auth check failed:", e);
      logout();
    }
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  if (currentUser) {
    localStorage.removeItem(`peerloop_cart_${currentUser.id}`);
  }
  currentUser = null;
  renderUI();
  showMessage("You have been logged out.");
  showSection("hero");
}

function showMessage(message, duration = 3000) {
  const msgBox = document.getElementById("message-box");
  msgBox.textContent = message;
  msgBox.classList.remove("hidden");
  setTimeout(() => msgBox.classList.add("hidden"), duration);
}

function setButtonLoading(button, isLoading, loadingText = 'Loading...') {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.innerHTML = `<span class="loader"></span> ${loadingText}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
          button.innerHTML = button.dataset.originalText;
          delete button.dataset.originalText;
        }
    }
}

function createProfileProductCard(product, context) {
    const card = document.createElement("div");
    card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col";
    let contextInfo = '';
    let actionButtons = '';
    
    const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';
    const imageUrl = product.imageUrl || 'http://via.placeholder.com/300x200.png?text=No+Image';

    // *** UPDATED: Use formatAddress for display ***
    const sellerAddressDisplay = formatAddress(product.seller);
    const buyerAddressDisplay = formatAddress(product.buyer);


    if (context === 'sold' && product.buyer) {
        contextInfo = `<p class="text-sm text-green-400 mb-2" style="overflow-wrap: break-word;">Sold to: ${product.buyer.name || buyerAddressDisplay}</p>`;
    } else if (context === 'purchased' && product.seller) {
        contextInfo = `<p class="text-sm text-yellow-400 mb-2" style="overflow-wrap: break-word;">Purchased from: ${product.seller.name || sellerAddressDisplay}</p>`;
    } else if (context === 'listings') {
         contextInfo = `<p class="text-sm text-blue-400 mb-2">Status: Listed for sale</p>`;
         actionButtons = `
            <div class="grid grid-cols-1 gap-3 mt-4">
                <button class="modern-button-secondary delete-listing-btn !border-red-500 !text-red-500 hover:!bg-red-500 hover:!text-white">Delete</button>
            </div>
         `;
    }

    card.innerHTML = `
        <img src="${imageUrl}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl mb-4">
        <h3 class="text-2xl font-bold text-neon-blue mb-2">${product.name}</h3>
        ${contextInfo}
        <p class="text-gray-400 flex-1 mb-4">${product.description}</p>
        <div class="flex items-center justify-between">
            <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
            <span class="text-xs px-2 py-1 rounded bg-gray-700">${displayCategory}</span>
        </div>
        ${actionButtons}
    `;

    if (context === 'listings') {
        const deleteBtn = card.querySelector('.delete-listing-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                const buttonThatWasClicked = e.currentTarget;
                const message = `Are you sure you want to permanently delete this listing from the blockchain? This action cannot be undone.`;
                showConfirmationModal(message, () => deleteProduct(product._id, buttonThatWasClicked));
            });
        }
    }

    return card;
}