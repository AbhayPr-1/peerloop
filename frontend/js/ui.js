// frontend/js/ui.js
let currentConfirmAction = null;

function showSection(sectionId) {
  const sections = ["hero", "services", "marketplace", "sell-tab", "cart-tab", "my-listings-tab", "sold-history-tab", "purchase-history-tab", "seller-profile-tab"];
  const navHomeBtn = document.getElementById('nav-home-btn');
  const navAboutBtn = document.getElementById('nav-about-btn');
  const navExploreBtn = document.getElementById('nav-explore-btn');
  const navSellBtn = document.getElementById('nav-sell-btn');

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== sectionId);
  });

  const servicesSection = document.getElementById('services');
  if (sectionId === 'hero') {
    servicesSection.classList.remove('hidden');
    navHomeBtn.classList.add('hidden');
    navAboutBtn.classList.remove('hidden');
    navExploreBtn.classList.add('hidden');
    navSellBtn.classList.add('hidden');
  } else {
    servicesSection.classList.add('hidden');
    navHomeBtn.classList.remove('hidden');
    navAboutBtn.classList.add('hidden');
    navExploreBtn.classList.remove('hidden');
    if (currentUser) navSellBtn.classList.remove('hidden');
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderUI() {
  const cartBtn = document.getElementById("nav-cart-btn");
  const authBtn = document.getElementById("auth-btn");
  const profileDropdown = document.getElementById("profile-dropdown-container");
  const loggedIn = !!currentUser;

  cartBtn.classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    authBtn.classList.add('hidden');
    profileDropdown.classList.remove('hidden');
    document.getElementById('profile-username').textContent = currentUser.name;
  } else {
    authBtn.classList.remove('hidden');
    authBtn.textContent = "Login";
    authBtn.onclick = showAuthModal;
    profileDropdown.classList.add('hidden');
  }
  updateCartCount();
}

function showConfirmationModal(message, onConfirmCallback) {
  const modal = document.getElementById('confirmation-modal');
  const content = modal.querySelector('.modal-content');
  const messageEl = document.getElementById('confirmation-message');

  messageEl.innerHTML = message;
  currentConfirmAction = onConfirmCallback; 

  modal.classList.remove('hidden');
  setTimeout(() => content.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmation-modal');
  const content = modal.querySelector('.modal-content');
  content.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
    currentConfirmAction = null; 
  }, 300);
}

function showQuickView(product) {
    const modal = document.getElementById('quick-view-modal');
    const content = document.getElementById('quick-view-content');
    const sellerId = (product.seller && product.seller._id) ? product.seller._id : 'N/A';
    const sellerName = (product.seller && product.seller.name) ? product.seller.name : 'Unknown Seller';
    
    let actionButtons = "";
    if (!currentUser || (currentUser && currentUser.id !== sellerId)) {
        actionButtons = `
          <button class="modern-button-secondary add-to-cart-btn">Add to Cart</button>
          <button class="modern-button buy-now-btn">Buy Now</button>
        `;
    }

    content.innerHTML = `
        <button id="close-quick-view-btn" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-auto object-cover rounded-xl">
            <div class="flex flex-col h-full">
                <h3 class="text-4xl font-bold text-neon-blue mb-4">${product.name}</h3>
                <p class="text-gray-400 mb-4 flex-grow">${product.description}</p>
                <div class="text-sm mb-4">
                  Seller: <a href="#" class="seller-link">${sellerName}</a>
                </div>
                <div class="flex items-center justify-between mb-6">
                    <span class="text-3xl text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
                    <span class="text-sm px-3 py-1 rounded bg-gray-700">${categoryDisplayMap[product.category]}</span>
                </div>
                <div class="grid grid-cols-2 gap-3">${actionButtons}</div>
            </div>
        </div>
    `;

    // Attach listeners directly to the new content
    document.getElementById('close-quick-view-btn').addEventListener('click', closeQuickView);
    
    const buyNowBtn = content.querySelector(".buy-now-btn");
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
            if (!currentUser) return showAuthModal();
            const message = `Confirm purchase of <strong>${product.name}</strong> for <strong>${Number(product.price).toFixed(4)} ETH</strong>?`;
            showConfirmationModal(message, () => buyNow(product._id));
        });
    }

    const addToCartBtn = content.querySelector(".add-to-cart-btn");
    if(addToCartBtn) {
        addToCartBtn.addEventListener('click', (e) => {
            if (!currentUser) return showAuthModal();
            addToCart(product._id, e.currentTarget);
        });
    }

    const sellerLink = content.querySelector(".seller-link");
    if (sellerLink) {
        sellerLink.addEventListener('click', (e) => {
            e.preventDefault();
            renderSellerProfile(sellerId, sellerName);
        });
    }

    modal.classList.remove('hidden');
    setTimeout(() => content.classList.remove('scale-95', 'opacity-0'), 10);
}

function closeQuickView() {
    const modal = document.getElementById('quick-view-modal');
    const content = modal.querySelector('.modal-content');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}