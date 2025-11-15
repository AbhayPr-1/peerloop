// frontend/js/marketplace.js

// ** NEW HELPER FUNCTION **
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// ** END NEW HELPER FUNCTION **

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col";
  
  // *** UPDATED: Format the address for display ***
  const sellerAddress = product.seller;
  const sellerDisplay = (product.seller && product.seller.name) ? product.seller.name : formatAddress(sellerAddress);
  
  const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';
  const imageUrl = product.imageUrl || 'http://via.placeholder.com/300x200.png?text=No+Image';

  let actionButtons = "";
  if (!currentUser || (currentUser && currentUser.walletAddress.toLowerCase() !== product.seller.toLowerCase())) {
    actionButtons = `
      <button class="modern-button-secondary add-to-cart-btn">Add to Cart</button>
      <button class="modern-button buy-now-btn">Buy Now</button>
    `;
  }

  card.innerHTML = `
    <img src="${imageUrl}" alt="${product.name}" class="w-full h-48 object-cover rounded-xl mb-4 cursor-pointer quick-view-trigger">
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${product.name}</h3>
    <p class="text-gray-400 flex-1 mb-4">${product.description}</p>
    <div class="text-sm mb-2" style="overflow-wrap: break-word;">
      Seller: <a href="#" class="seller-link">${sellerDisplay}</a>
    </div>
    <div class="flex items-center justify-between mb-4">
      <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
      <span class="text-xs px-2 py-1 rounded bg-gray-700">${displayCategory}</span>
    </div><div class="grid grid-cols-2 gap-3">${actionButtons}</div>`;

  const buyNowBtn = card.querySelector(".buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal(); // Still need to be logged in to buy
      const message = `Confirm purchase of <strong>${product.name}</strong> for <strong>${Number(product.price).toFixed(4)} ETH</strong>?`;
      showConfirmationModal(message, () => buyNow(product, e.currentTarget));
    });
  }

  const addToCartBtn = card.querySelector(".add-to-cart-btn");
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal(); // Still need to be logged in to add
      addToCart(product, e.currentTarget);
    });
  }

  const sellerLink = card.querySelector(".seller-link");
  if (sellerLink) {
    sellerLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderSellerProfile(product.seller, sellerDisplay);
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

async function fetchProducts(waitForSync = false) { // Added parameter
    const grid = document.getElementById("product-grid");
    
    let skeletonHTML = '';
    for (let i = 0; i < 6; i++) {
        skeletonHTML += `<div class="skeleton-card"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
    }
    grid.innerHTML = skeletonHTML;

    try {
        // CRITICAL: If triggered by a transactional event (waitForSync=true), wait 1000ms for RPC sync
        if (waitForSync) {
            console.log("DEBUG: fetchProducts: Waiting 1000ms for RPC node synchronization.");
            await delay(1000); 
        } else {
            console.log("DEBUG: fetchProducts: Executing without delay.");
        }

        const productsFromChain = await marketplaceContract.getAllForSaleProducts();
        
        // DEBUG: Log the result count to ensure we are getting fresh data.
        console.log(`DEBUG: fetchProducts: Received ${productsFromChain.length} items from contract.`);

        allProducts = productsFromChain.map(p => ({
            _id: p.id.toString(),
            name: p.name,
            description: p.description,
            price: parseFloat(ethers.utils.formatEther(p.price)),
            seller: p.seller,
            imageUrl: p.imageUrl,
            category: 'Data', 
            isSold: p.isSold
        }));
        
        filterAndSortProducts();
        
    } catch (error) {
        console.error("DEBUG: fetchProducts FAILED:", error);
        if (error.message.includes("network")) {
            grid.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: Could not connect to the Sepolia network. Please check your connection.</p>`;
        } else {
            grid.innerHTML = `<p class="text-center text-gray-500 col-span-full">Error: Could not load products from the blockchain.</p>`;
        }
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
    default: break;
  }
  renderProducts(list);
}

async function buyNow(product, buttonElement = null) {
  if (!currentUser) return showAuthModal();
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");

  if (buttonElement) setButtonLoading(buttonElement, true, 'Paying...');

  try {
    const priceInWei = ethers.utils.parseEther(product.price.toString());
    showMessage("Sending transaction... Please check your wallet.");
    
    const tx = await marketplaceContract.buyProduct(product._id, { value: priceInWei });
    
    if (buttonElement) setButtonLoading(buttonElement, true, 'Confirming...');
    await tx.wait(); 
    
    showMessage("Purchase Successful!");
    console.log("DEBUG: buyNow: Transaction confirmed. Triggering global fetch (true).");

    // CRITICAL: FORCE REFRESH with 1000ms delay
    fetchProducts(true); 
    
  } catch (error) {
    console.error("DEBUG: buyNow FAILED:", error);
    let errorMessage = "Transaction failed. Please check console for details.";

    if (error.reason) {
        errorMessage = error.reason;
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT' && error.error && error.error.message) {
        errorMessage = error.error.message.replace('execution reverted: ', '');
    } else if (error.code === -32603 && error.data && error.data.message) {
        errorMessage = error.data.message;
    } else if (error.code === 'USER_REJECTED_TRANSACTION' || error.message.includes("user rejected transaction")) {
        errorMessage = "Payment was cancelled by the user.";
    }

    showMessage(errorMessage);
    throw error;
  } finally {
    if (buttonElement) setButtonLoading(buttonElement, false);
  }
}

async function deleteProduct(productId, buttonElement) {
  if (!currentUser) return showAuthModal();
  if (!marketplaceContract || !signer) return showMessage("Connecting to contract... Please log in again.");

  setButtonLoading(buttonElement, true, 'Deleting...');

  try {
      showMessage("Sending transaction... Please check your wallet.");
      const tx = await marketplaceContract.deleteProduct(productId);
      setButtonLoading(buttonElement, true, 'Confirming...');
      await tx.wait(); 
      
      showMessage("Listing deleted successfully!");
      
      // Manual UI removal for immediate feedback (for the seller on the Listings page)
      buttonElement.closest('.card-neon-border').remove(); 
      console.log("DEBUG: deleteProduct: Transaction confirmed. Triggering global fetch (true).");

      // CRITICAL: FORCE FETCH HERE FOR INSTANT UI UPDATE (triggers real-time for all users)
      fetchProducts(true); 
      
  } catch (error) {
      console.error("DEBUG: deleteProduct FAILED:", error);
      let errorMessage = "Transaction failed. Please check console for details.";
      if (error.reason) {
          errorMessage = error.reason;
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT' && error.error && error.error.message) {
          errorMessage = error.error.message.replace('execution reverted: ', '');
      } else if (error.code === -32603 && error.data && error.data.message) {
          errorMessage = error.data.message;
      } else if (error.code === 'USER_REJECTED_TRANSACTION') {
          errorMessage = "Deletion was cancelled by the user.";
      }
      showMessage(errorMessage);
      throw error;
  } finally {
      if (buttonElement) setButtonLoading(buttonElement, false);
  }
}