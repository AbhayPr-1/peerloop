// frontend/js/cart.js
let userCart = [];

function fetchCart() {
  if (currentUser) {
    userCart = JSON.parse(localStorage.getItem(`peerloop_cart_${currentUser.id}`) || '[]');
  } else {
    userCart = [];
  }
  updateCartCount();
  if (!document.getElementById('cart-tab').classList.contains('hidden')) {
    renderCart();
  }
}

async function addToCart(product, buttonElement) {
  if (!currentUser) return showMessage("You must be logged in.");
  fetchCart(); 
  const originalButtonText = buttonElement.innerHTML;
  buttonElement.disabled = true;

  try {
    if (userCart.find(item => item._id === product._id)) {
        throw new Error("Product already in cart");
    }
    userCart.push(product);
    localStorage.setItem(`peerloop_cart_${currentUser.id}`, JSON.stringify(userCart));
    updateCartCount();
    buttonElement.innerHTML = 'Added ✓';
    buttonElement.classList.add('added-to-cart');
    setTimeout(() => {
        buttonElement.innerHTML = originalButtonText;
        buttonElement.classList.remove('added-to-cart');
        buttonElement.disabled = false;
    }, 2000);
  } catch (error) {
    showMessage(error.message);
    buttonElement.innerHTML = originalButtonText;
    buttonElement.disabled = false;
  }
}

function renderCart() {
  const cont = document.getElementById('cart-items-container');
  const totalEl = document.getElementById('cart-total');
  const summaryEl = document.getElementById('cart-summary');
  cont.innerHTML = '';

  if (userCart.length === 0) {
    // FIX: Provide the full HTML content for the empty cart state, 
    // including the necessary button with an ID to attach an event listener.
    cont.innerHTML = `<div class="text-center p-8 border-2 border-dashed rounded-md col-span-full">
            <h3 class="text-2xl font-bold text-gray-400">Your cart is empty.</h3>
            <p class="text-gray-500 mt-2 mb-6">Explore the marketplace to find your next gear.</p>
            <button id="cart-explore-btn" class="modern-button">Explore Gears</button>
        </div>`;
    
    summaryEl.classList.add('hidden');
    
    // FIX: The error occurs here because the button was missing/misnamed in the original placeholder.
    const exploreBtn = document.getElementById('cart-explore-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => showSection('marketplace'));
    }
    return;
  }

  summaryEl.classList.remove('hidden');
  let total = 0;
  userCart.forEach(item => {
    total += item.price;
    const el = document.createElement('div');
    el.className = 'flex items-center space-x-4 bg-gray-800 p-4 rounded-xl card-neon-border';
    const imageUrl = item.imageUrl || 'http://via.placeholder.com/300x200.png?text=No+Image';
    el.innerHTML = `
      <img src="${imageUrl}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md">
      <div class="flex-grow">
        <h4 class="text-lg font-bold text-neon-blue">${item.name}</h4><p>${item.price.toFixed(4)} ETH</p>
      </div>
      <button class="remove-from-cart-btn text-red-500 hover:text-red-400 transition-colors" data-product-id="${item._id}">✖</button>`;
    cont.appendChild(el);
  });
  totalEl.textContent = `${total.toFixed(4)} ETH`;
  document.querySelectorAll('.remove-from-cart-btn').forEach(btn =>
    btn.addEventListener('click', e => removeFromCart(e.target.dataset.productId))
  );
}

async function removeFromCart(productId, showMsg = true) {
  if (!currentUser) return;
  try {
    fetchCart(); 
    userCart = userCart.filter(item => item._id !== productId); 
    localStorage.setItem(`peerloop_cart_${currentUser.id}`, JSON.stringify(userCart)); 
    if (showMsg) showMessage("Item removed from cart.");
    renderCart();
    updateCartCount();
  } catch (error) {
    showMessage(error.message);
  }
}

async function checkout(buttonElement) {
  if (userCart.length === 0) return showMessage('Your cart is empty.');
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");
    
  const total = userCart.reduce((sum, item) => sum + item.price, 0);
  const message = `Confirm purchase of <strong>${userCart.length} item(s)</strong> for a total of <strong>${total.toFixed(4)} ETH</strong>?`;

  showConfirmationModal(message, async () => {
    showMessage("Please approve each transaction in your wallet.");
    const itemsToCheckout = [...userCart];
    
    // Disable checkout button during the multi-transaction process
    if (buttonElement) setButtonLoading(buttonElement, true, 'Processing...');
      
    try {
        for (const item of itemsToCheckout) {
          try {
            // Use buyNow, which handles its own transaction loading/messages
            await buyNow(item, null); 
            removeFromCart(item._id, false); // Remove from cart *after* successful purchase
          } catch (e) {
            // Note: buyNow already shows a message on error
            console.error(`Skipping ${item.name} due to transaction failure.`, e);
          }
        }
        
        // Final state update
        await fetchCart(); 
        showMessage("Checkout process finished.");
        
    } catch (error) {
        // This catch block would only be hit if something failed outside of the loop, which is rare.
        showMessage(error.message || "An unexpected error occurred during checkout.");
    } finally {
        if (buttonElement) setButtonLoading(buttonElement, false);
    }
  });
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

function handleRealTimeCartRemoval(productId, productName) {
    if (!currentUser) return;
    fetchCart(); 
    const removedItemIndex = userCart.findIndex(item => item._id === productId);
    if (removedItemIndex > -1) {
        const name = productName || userCart[removedItemIndex].name;
        userCart.splice(removedItemIndex, 1);
        localStorage.setItem(`peerloop_cart_${currentUser.id}`, JSON.stringify(userCart)); 
        updateCartCount();
        if (!document.getElementById('cart-tab').classList.contains('hidden')) {
            renderCart();
        }
        showMessage(`'${name}' was removed from your cart as it's no longer available.`, 4000);
    }
}