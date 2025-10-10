// frontend/js/marketplace.js
function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "bg-gray-800 rounded-2xl p-6 card-neon-border flex flex-col";
  let actionButtons = "";
  console.log("Checking IDs -> My ID:", currentUser?.id, "Seller ID:", product.seller);
  if (currentUser && currentUser.id !== product.seller) {
    actionButtons = `
      <button class="modern-button-secondary add-to-cart-btn" data-id="${product._id}">Add to Cart</button>
      <button class="modern-button buy-now-btn" data-id="${product._id}">Buy Now</button>
    `;
  }
  card.innerHTML = `
    <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl mb-4">
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${product.name}</h3>
    <p class="text-gray-400 flex-1 mb-4">${product.description}</p>
    <div class="flex items-center justify-between mb-4">
      <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
      <span class="text-xs px-2 py-1 rounded bg-gray-700">${product.category}</span>
    </div><div class="grid grid-cols-2 gap-3">${actionButtons}</div>`;
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
  grid.querySelectorAll(".add-to-cart-btn").forEach(btn => btn.addEventListener("click", e => addToCart(e.currentTarget.dataset.id)));
  grid.querySelectorAll(".buy-now-btn").forEach(btn => btn.addEventListener("click", e => buyNow(e.currentTarget.dataset.id)));
}

async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        allProducts = await response.json();
        filterAndSortProducts();
    } catch (error) {
        document.getElementById("product-grid").innerHTML = `<p class="text-center text-gray-500 col-span-full">Error: Could not load products.</p>`;
    }
}

function filterAndSortProducts() {
  const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  const cat = document.getElementById("category-filter")?.value || "all";
  const sortBy = document.getElementById("sort-by")?.value || "date-desc";
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

async function buyNow(productId) {
  if (!currentUser) return showMessage("You must be logged in to purchase.");
  const product = allProducts.find(p => p._id === productId);
  if (!product) return showMessage("Product not found.");
  if (product.seller === currentUser.id) return showMessage("You cannot buy your own listing.");
  try {
    const response = await fetch(`${API_URL}/api/products/${productId}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': localStorage.getItem('token') }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Purchase failed');
    showMessage(`Purchased "${product.name}" successfully!`);
    allProducts = allProducts.filter(p => p._id !== productId);
    filterAndSortProducts();
    removeFromCart(productId, false); // Remove from cart but don't show a message
  } catch(error) { showMessage(error.message); }
}