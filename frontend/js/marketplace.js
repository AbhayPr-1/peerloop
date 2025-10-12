// frontend/js/marketplace.js
function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "bg-gray-800 rounded-2xl p-6 card-neon-border flex flex-col";
  let actionButtons = "";

  const sellerId = (typeof product.seller === 'object' && product.seller !== null) ? product.seller._id : product.seller;
  const sellerName = (typeof product.seller === 'object' && product.seller !== null) ? product.seller.name : 'Your new listing';
  const displayCategory = categoryDisplayMap[product.category] || product.category;

  if (!currentUser || (currentUser && currentUser.id !== sellerId)) {
    actionButtons = `
      <button class="modern-button-secondary add-to-cart-btn" data-id="${product._id}">Add to Cart</button>
      <button class="modern-button buy-now-btn" data-id="${product._id}">Buy Now</button>
    `;
  }

  card.innerHTML = `
    <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl mb-4">
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${product.name}</h3>
    <p class="text-gray-400 flex-1 mb-4">${product.description}</p>
    <div class="text-sm mb-2">
      Seller: <a href="#" class="seller-link text-neon-blue hover:underline" data-seller-id="${sellerId}" data-seller-name="${sellerName}">${sellerName}</a>
    </div>
    <div class="flex items-center justify-between mb-4">
      <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
      <span class="text-xs px-2 py-1 rounded bg-gray-700">${displayCategory}</span>
    </div><div class="grid grid-cols-2 gap-3">${actionButtons}</div>`;
  return card;
}

function attachCardListeners(grid) {
  grid.querySelectorAll(".add-to-cart-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      if (currentUser) {
        addToCart(e.currentTarget.dataset.id);
      } else {
        showMessage('Please log in to add items to your cart.');
        showAuthModal();
      }
    });
  });

  grid.querySelectorAll(".buy-now-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      if (currentUser) {
        const card = e.currentTarget.closest('.card-neon-border');
        const productName = card.querySelector('h3').textContent;
        buyNow(e.currentTarget.dataset.id, e, productName);
      } else {
        showMessage('Please log in to purchase an item.');
        showAuthModal();
      }
    });
  });

  grid.querySelectorAll(".seller-link").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const sellerId = e.currentTarget.dataset.sellerId;
      const sellerName = e.currentTarget.dataset.sellerName;
      renderSellerProfile(sellerId, sellerName);
    });
  });
}

function renderProducts(list) {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No products match your filters.</p>`;
    return;
  }
  list.forEach(p => grid.appendChild(createProductCard(p)));
  attachCardListeners(grid);
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

async function buyNow(productId, event, productName) { 
  if (!currentUser) return showMessage("You must be logged in to purchase.");
  
  try {
    const response = await fetch(`${API_URL}/api/products/${productId}/buy`, {
      method: 'POST',
      headers: { 'x-auth-token': localStorage.getItem('token') }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Purchase failed');

    const name = productName || "the item";
    showMessage(`Purchased "${name}" successfully!`);

    allProducts = allProducts.filter(p => p._id !== productId);
    
    if (event) {
        event.target.closest('.card-neon-border').remove();
    } else {
        filterAndSortProducts();
    }
    
    removeFromCart(productId, false);
  } catch(error) { showMessage(error.message); }
}