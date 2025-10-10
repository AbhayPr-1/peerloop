// frontend/js/cart.js (FINAL, DATABASE VERSION)

// This variable will hold the cart items in memory to avoid constant fetching
let userCart = [];

async function fetchCart() {
  if (!currentUser) return;
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_URL}/api/users/cart`, {
      headers: { 'x-auth-token': token }
    });
    if (!response.ok) throw new Error('Could not fetch cart');
    
    userCart = await response.json();
    updateCartCount();
    
    // If the cart tab is currently visible, re-render it
    if (!document.getElementById('cart-tab').classList.contains('hidden')) {
      renderCart();
    }

  } catch (error) {
    console.error("Fetch Cart Error:", error);
  }
}

async function addToCart(productId) {
  if (!currentUser) return showMessage("You must be logged in.");
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_URL}/api/users/cart/${productId}`, {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.msg || 'Failed to add item');
    
    userCart = data; // Update local cart state
    const product = allProducts.find(p => p._id === productId);
    showMessage(`Added ${product.name} to cart`);
    updateCartCount();

  } catch (error) {
    showMessage(error.message);
  }
}

function renderCart() {
  const cont = document.getElementById('cart-items-container');
  const totalEl = document.getElementById('cart-total');
  cont.innerHTML = '';

  if (userCart.length === 0) {
    cont.innerHTML = '<p class="text-center text-gray-500">Your cart is empty.</p>';
    totalEl.textContent = '0 ETH';
    return;
  }

  let total = 0;
  userCart.forEach(item => {
    total += item.price;
    const el = document.createElement('div');
    el.className = 'flex items-center space-x-4 bg-gray-800 p-4 rounded-xl card-neon-border';
    el.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md">
      <div class="flex-grow">
        <h4 class="text-lg font-bold text-neon-blue">${item.name}</h4><p>${item.price} ETH</p>
      </div>
      <button class="remove-from-cart-btn text-red-500" data-product-id="${item._id}">✖</button>`;
    cont.appendChild(el);
  });
  totalEl.textContent = `${total.toFixed(4)} ETH`;
  document.querySelectorAll('.remove-from-cart-btn').forEach(btn =>
    btn.addEventListener('click', e => removeFromCart(e.target.dataset.productId))
  );
}

async function removeFromCart(productId, showMsg = true) {
  if (!currentUser) return;
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_URL}/api/users/cart/${productId}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Failed to remove item');

    userCart = data; // Update local cart state
    if (showMsg) showMessage("Item removed from cart.");
    renderCart(); // Re-render the cart view
    updateCartCount();

  } catch (error) {
    showMessage(error.message);
  }
}

async function checkout() {
  if (userCart.length === 0) return showMessage('Your cart is empty.');
  
  // Create a copy of the cart to iterate over, as `buyNow` will modify the underlying data
  const itemsToCheckout = [...userCart];
  
  showLoadingMessage("Processing your purchases...");
  for (const item of itemsToCheckout) {
    // The `buyNow` function already exists in marketplace.js and handles removing the product
    await buyNow(item._id);
  }
  
  // After all purchases, fetch the (now empty) cart from the server
  await fetchCart(); 
  hideLoadingMessage();
  showMessage("Checkout complete!");
}

function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (currentUser && userCart.length > 0) {
    el.textContent = userCart.length;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}