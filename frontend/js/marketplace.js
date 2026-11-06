// frontend/js/marketplace.js

const realtimeRemovedProductIds = new Set();
let productRefreshVersion = 0;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col";
  
  const sellerAddress = product.seller;
  const sellerDisplay = (product.seller && product.seller.name) ? product.seller.name : formatAddress(sellerAddress);
  
  const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';

  let actionButtons = "";
  if (!currentUser || (currentUser && currentUser.walletAddress.toLowerCase() !== product.seller.toLowerCase())) {
    actionButtons = `
      <button class="modern-button-secondary add-to-cart-btn">Add to Cart</button>
      <button class="modern-button buy-now-btn">Buy Now</button>
    `;
  }

  card.innerHTML = `
    <img alt="${escapeHtml(product.name)}" class="w-full h-48 object-cover rounded-xl mb-4 cursor-pointer quick-view-trigger">
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${escapeHtml(product.name)}</h3>
    <p class="text-gray-400 flex-1 mb-4">${escapeHtml(product.description)}</p>
    <div class="text-sm mb-2" style="overflow-wrap: break-word;">
      Seller: <a href="#" class="seller-link">${escapeHtml(sellerDisplay)}</a>
    </div>
    <div class="flex items-center justify-between mb-4">
      <span class="text-neon-pink font-bold">${Number(product.price).toFixed(4)} ETH</span>
      <span class="text-xs px-2 py-1 rounded bg-gray-700">${escapeHtml(displayCategory)}</span>
    </div><div class="grid grid-cols-2 gap-3">${actionButtons}</div>`;
  setResilientImage(card.querySelector('img'), product.imageUrl);

  const buyNowBtn = card.querySelector(".buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal(); // Still need to be logged in to buy
      const message = `Confirm purchase of <strong>${escapeHtml(product.name)}</strong> for <strong>${Number(product.price).toFixed(4)} ETH</strong>?`;
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

async function loadProductsFromChain() {
    const productsFromChain = await readMarketplaceProducts();
    let categories = {};
    try {
        const categoryResponse = await fetchWithTimeout(
            `${API_URL}/api/listing-metadata`,
            { cache: 'no-store' },
            1500
        );
        if (!categoryResponse.ok) {
            throw new Error(`Category service returned HTTP ${categoryResponse.status}.`);
        }
        const categoryData = await categoryResponse.json();
        if (!categoryData || typeof categoryData !== 'object' || Array.isArray(categoryData)) {
            throw new Error('Category service returned invalid data.');
        }
        categories = categoryData;
    } catch (error) {
        console.warn('Listing categories are unavailable; showing products with their default category.', error.message);
    }

    return productsFromChain
        .filter(p => !realtimeRemovedProductIds.has(p.id.toString()))
        .map(p => ({
            _id: p.id.toString(),
            name: String(p.name || ''),
            description: String(p.description || ''),
            price: Number(ethers.utils.formatEther(p.price)),
            seller: String(p.seller || ''),
            imageUrl: String(p.imageUrl || ''),
            category: categories[p.id.toString()] || 'data',
            isSold: Boolean(p.isSold)
        }));
}

async function fetchProducts(waitForSync = false, retryCount = 0) {
    const grid = document.getElementById("product-grid");
    const refreshVersion = ++productRefreshVersion;
    if (!waitForSync) {
        const loadingMessage = document.createElement('p');
        loadingMessage.className = 'text-center text-gray-500 col-span-full';
        loadingMessage.textContent = 'Loading Explore Gears...';
        grid.replaceChildren(loadingMessage);
    }

    try {
        if (waitForSync) {
            await delay(1000);
        }

        const products = await loadProductsFromChain();
        if (refreshVersion !== productRefreshVersion) return;
        allProducts = products;
        filterAndSortProducts();
        
    } catch (error) {
        if (refreshVersion !== productRefreshVersion) return;
        console.error("Failed to fetch products:", error);
        if (retryCount < 2) {
            const retryMessage = document.createElement('p');
            retryMessage.className = 'text-center text-gray-500 col-span-full';
            retryMessage.textContent = 'Marketplace is taking longer than usual. Retrying...';
            grid.replaceChildren(retryMessage);
            setTimeout(() => {
                if (refreshVersion === productRefreshVersion
                    && !document.getElementById('marketplace').classList.contains('hidden')) {
                    fetchProducts(false, retryCount + 1);
                }
            }, 1000 * (retryCount + 1));
            return;
        }
        const details = error.shortMessage
            || error.reason
            || error.error?.message
            || error.message
            || 'Unknown error';
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-center text-red-500 col-span-full';
        errorMessage.textContent = `Could not load Explore Gears after retrying: ${details}`;
        grid.replaceChildren(errorMessage);
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
    await ensureSepoliaNetwork();
    const priceInWei = ethers.utils.parseEther(product.price.toString());
    showMessage("Sending transaction... Please check your wallet.");
    
    const tx = await marketplaceContract.buyProduct(product._id, { value: priceInWei });
    
    if (buttonElement) setButtonLoading(buttonElement, true, 'Confirming...');
    await tx.wait(); 
    
    showMessage("Purchase Successful!");

    fetchProducts(true); 
    
  } catch (error) {
    console.error("Purchase failed:", error);
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
      await ensureSepoliaNetwork();
      const tx = await marketplaceContract.deleteProduct(productId);
      setButtonLoading(buttonElement, true, 'Confirming...');
      await tx.wait(); 
      
      showMessage("Listing deleted successfully!");
      
      // Manual UI removal for immediate feedback (for the seller on the Listings page)
      buttonElement.closest('.card-neon-border').remove(); 

      fetchProducts(true); 
      
  } catch (error) {
      console.error("Product deletion failed:", error);
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