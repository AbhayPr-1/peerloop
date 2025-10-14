// frontend/js/marketplace.js

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col";
  const sellerId = (product.seller && product.seller._id) ? product.seller._id : 'N/A';
  const sellerName = (product.seller && product.seller.name) ? product.seller.name : 'Unknown Seller';
  const displayCategory = categoryDisplayMap[product.category] || product.category;

  let actionButtons = "";
  if (!currentUser || (currentUser && currentUser.id !== sellerId)) {
    actionButtons = `
      <button class="modern-button-secondary add-to-cart-btn">Add to Cart</button>
      <button class="modern-button buy-now-btn">Buy Now</button>
    `;
  }

  card.innerHTML = `
    <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl mb-4 cursor-pointer quick-view-trigger">
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${product.name}</h3>
    <p class="text-gray-400 flex-1 mb-4">${product.description}</p>
    <div class="text-sm mb-2">
      Seller: <a href="#" class="seller-link">${sellerName}</a>
    </div>
    <div class="flex items-center justify-between mb-4">
      <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
      <span class="text-xs px-2 py-1 rounded bg-gray-700">${displayCategory}</span>
    </div><div class="grid grid-cols-2 gap-3">${actionButtons}</div>`;

  // --- NEW: Attach listeners directly after creating the card ---
  const buyNowBtn = card.querySelector(".buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal();
      const message = `Confirm purchase of <strong>${product.name}</strong> for <strong>${Number(product.price).toFixed(4)} ETH</strong>?`;
      showConfirmationModal(message, () => buyNow(product._id));
    });
  }

  const addToCartBtn = card.querySelector(".add-to-cart-btn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal();
      addToCart(product._id, e.currentTarget);
    });
  }

  const sellerLink = card.querySelector(".seller-link");
  if (sellerLink) {
    sellerLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderSellerProfile(sellerId, sellerName);
    });
  }
  
  const quickViewTrigger = card.querySelector('.quick-view-trigger');
  if(quickViewTrigger) {
    quickViewTrigger.addEventListener('click', () => showQuickView(product));
  }

  return card;
}

function renderProducts(list) {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No products match your filters.</p>`;
    return;
  }
  list.forEach(p => grid.appendChild(createProductCard(p)));
}

async function fetchProducts() {
    const grid = document.getElementById("product-grid");
    let skeletonHTML = '';
    for (let i = 0; i < 6; i++) {
        skeletonHTML += `<div class="skeleton-card"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
    }
    grid.innerHTML = skeletonHTML;

    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        allProducts = await response.json();
        filterAndSortProducts();
    } catch (error) {
        grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">Error: Could not load products.</p>`;
    }
}

function filterAndSortProducts() {
  const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  const cat = document.querySelector("#category-filter input[type='hidden']")?.value || "all";
  const sortBy = document.querySelector("#sort-by input[type='hidden']")?.value || "date-desc";
  let list = [...allProducts];
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (cat !== "all") list = list.filter(p => p.category === cat);
  switch (sortBy) {
    case "price-asc": list.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case "price-desc": list.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "name-desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
    default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
  }
  renderProducts(list);
}

async function buyNow(productId, showMsg = true) {
  if (!currentUser) return showMessage("You must be logged in to purchase.");

  try {
    const response = await fetch(`${API_URL}/api/products/${productId}/buy`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-auth-token': localStorage.getItem('token') 
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Purchase failed');

    if (showMsg) {
      showMessage(`Purchased "${data.product.name}" successfully!`);
    }
    
    allProducts = allProducts.filter(p => p._id !== productId);
    filterAndSortProducts();
    
    if (!document.getElementById('quick-view-modal').classList.contains('hidden')) {
      closeQuickView();
    }
    
    removeFromCart(productId, false);

  } catch(error) {
    showMessage(error.message);
    throw error;
  }
}

async function deleteProduct(productId, buttonElement) {
    if (!currentUser) return showMessage("You are not authorized.");
    setButtonLoading(buttonElement, true, 'Deleting...');

    try {
        const response = await fetch(`${API_URL}/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'Failed to delete product.');
        
        showMessage("Listing deleted successfully!");
        
        allProducts = allProducts.filter(p => p._id !== productId);
        buttonElement.closest('.card-neon-border').remove();
        
    } catch (error) {
        showMessage(error.message);
        setButtonLoading(buttonElement, false);
    }
}