// frontend/js/marketplace.js

const realtimeRemovedProductIds = new Set();
let productRefreshVersion = 0;
let filterDebounceTimer = null;

const escrowPurchaseInterface = new ethers.utils.Interface([
    'event EscrowCreated(uint256 escrowId, uint256 productId, address seller, address buyer, uint256 amount)'
]);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function debouncedFilterAndSort(delayMs = 120) {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
        filterAndSortProducts();
        filterDebounceTimer = null;
    }, delayMs);
}

function renderProductSkeletons(grid) {
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 8 }).map(() => `
      <div class="theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col pl-skeleton-card">
        <div class="w-full h-48 rounded-xl bg-gray-700/30 mb-4 skeleton-shimmer"></div>
        <div class="h-6 w-3/4 rounded bg-gray-700/30 mb-3 skeleton-shimmer"></div>
        <div class="h-4 w-full rounded bg-gray-700/20 mb-2 skeleton-shimmer"></div>
        <div class="h-4 w-2/3 rounded bg-gray-700/20 mb-4 skeleton-shimmer"></div>
        <div class="flex justify-between items-center mb-4 mt-auto">
          <div class="h-6 w-20 rounded bg-gray-700/30 skeleton-shimmer"></div>
          <div class="h-5 w-16 rounded bg-gray-700/20 skeleton-shimmer"></div>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-2">
          <div class="h-10 rounded-full bg-gray-700/30 skeleton-shimmer"></div>
          <div class="h-10 rounded-full bg-gray-700/30 skeleton-shimmer"></div>
        </div>
      </div>
    `).join('');
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "theme-card-bg rounded-2xl p-6 card-neon-border flex flex-col group relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl";
  
  const sellerAddress = product.seller;
  const sellerDisplay = (product.seller && product.seller.name) ? product.seller.name : formatAddress(sellerAddress);
  
  const displayCategory = categoryDisplayMap[product.category] || product.category || 'Data';

  let actionButtons = "";
  if (!currentUser || (currentUser && currentUser.walletAddress.toLowerCase() !== product.seller.toLowerCase())) {
    actionButtons = `
      <button class="modern-button-secondary add-to-cart-btn active:scale-95 transition-transform">Add to Cart</button>
      <button class="modern-button buy-now-btn active:scale-95 transition-transform">Buy with Escrow</button>
    `;
  }

  card.innerHTML = `
    <div class="product-gallery-slot"></div>
    <h3 class="text-2xl font-bold text-neon-blue mb-2">${escapeHtml(product.name)}</h3>
    <p class="text-gray-400 flex-1 mb-4 leading-relaxed">${escapeHtml(product.description)}</p>
    <div class="text-sm mb-2" style="overflow-wrap: break-word;">
      Seller: <a href="#" class="seller-link text-neon-blue hover:underline">${escapeHtml(sellerDisplay)}</a>
    </div>
    <div class="product-card-meta mb-4 flex items-center justify-between">
      <span class="product-card-price text-neon-pink font-bold text-xl">${window.PeerLoopMoney.formatEth(product.price)} ETH</span>
      <span class="product-card-category text-xs px-2.5 py-1 rounded-full bg-gray-700/70 border border-gray-600/40 text-gray-300">${escapeHtml(displayCategory)}</span>
    </div><div class="product-card-actions grid grid-cols-2 gap-3 mt-auto">${actionButtons}</div>`;
  const imageGallery = createProductImageGallery(product.imageUrl, product.name, 'marketplace', () => showQuickView(product));
  card.querySelector('.product-gallery-slot').replaceWith(imageGallery);

  const buyNowBtn = card.querySelector(".buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!currentUser) return showAuthModal(); // Still need to be logged in to buy
      const message = `Buy <strong>${escapeHtml(product.name)}</strong> for <strong>${window.PeerLoopMoney.formatEth(product.price)} ETH</strong>? Payment will be held in escrow until you release it or request a refund.`;
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
  
  return card;
}

function renderProducts(list) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center glass-panel rounded-2xl">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-700/30 flex items-center justify-center text-neon-blue">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <p class="text-xl font-bold mb-1">No gears match your filters</p>
        <p class="text-gray-400 text-sm">Try broadening your search or resetting filters.</p>
      </div>`;
    return;
  }
  list.forEach(p => grid.appendChild(createProductCard(p)));
}

function removeProductFromMarketplace(productId) {
    const id = String(productId);
    realtimeRemovedProductIds.add(id);
    allProducts = allProducts.filter(product => String(product._id) !== id);
    filterAndSortProducts();
}

function markProductAvailable(productId, historyRecord = null) {
    const id = String(productId);
    realtimeRemovedProductIds.delete(id);
    let product = allProducts.find(item => String(item._id) === id);
    if (product) {
        product.isSold = false;
        product.buyer = '';
    } else if (historyRecord) {
        product = {
            _id: id,
            name: historyRecord.name || 'Marketplace item',
            description: historyRecord.description || '',
            price: String(historyRecord.price || '0'),
            seller: String(historyRecord.seller || ''),
            imageUrl: historyRecord.imageUrl || '',
            category: historyRecord.category || 'data',
            isSold: false
        };
        allProducts.push(product);
    }
    if (currentUser && window.PeerLoopAccount) {
        window.PeerLoopAccount.updateListings(allProducts);
    }
    filterAndSortProducts();
}

async function loadProductsFromChain() {
    const productsFromChain = await readMarketplaceProducts();
    let categories = {};
    try {
        const categoryData = await window.PeerLoopApi.listingMetadata.getAll(1500);
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
            price: ethers.utils.formatEther(p.price),
            seller: String(p.seller || ''),
            imageUrl: String(p.imageUrl || ''),
            category: categories[p.id.toString()] || 'data',
            isSold: Boolean(p.isSold)
        }));
}

async function fetchProducts(waitForSync = false, retryCount = 0, showLoading = !waitForSync) {
    const grid = document.getElementById("product-grid");
    if (!grid) return;
    const refreshVersion = ++productRefreshVersion;

    if (allProducts && allProducts.length > 0) {
        // Instant response: Render cached data immediately without blanking or lag!
        filterAndSortProducts();
    } else if (showLoading) {
        renderProductSkeletons(grid);
    }

    try {
        if (waitForSync) {
            await delay(300);
        }

        const products = await loadProductsFromChain();
        if (refreshVersion !== productRefreshVersion) return;

        // Merge: preserve any locally-added listings (e.g. just-created by the
        // current user) that the lagging public RPC hasn't indexed yet.
        const chainProductIds = new Set(products.map(p => String(p._id)));
        const localOnlyProducts = allProducts.filter(p =>
          !chainProductIds.has(String(p._id))
          && !p.isSold
          && !realtimeRemovedProductIds.has(String(p._id))
        );
        allProducts = [...products, ...localOnlyProducts];
        if (currentUser && window.PeerLoopAccount) {
            window.PeerLoopAccount.updateListings(products);
        }
        filterAndSortProducts();
        
    } catch (error) {
        if (refreshVersion !== productRefreshVersion) return;
        console.error("Failed to fetch products:", error);
        if (retryCount < 2) {
            if (allProducts.length === 0) {
                const retryMessage = document.createElement('p');
                retryMessage.className = 'text-center text-gray-500 col-span-full py-8';
                retryMessage.textContent = 'Marketplace is syncing on-chain data. Retrying...';
                grid.replaceChildren(retryMessage);
            }
            setTimeout(() => {
                if (refreshVersion === productRefreshVersion
                    && !document.getElementById('marketplace').classList.contains('hidden')) {
                    fetchProducts(false, retryCount + 1, showLoading);
                }
            }, 800 * (retryCount + 1));
            return;
        }
        if (allProducts.length === 0) {
            const details = error.shortMessage
                || error.reason
                || error.error?.message
                || error.message
                || 'Unknown error';
            const errorMessage = document.createElement('p');
            errorMessage.className = 'text-center text-red-500 col-span-full py-8';
            errorMessage.textContent = `Could not load Explore Gears after retrying: ${details}`;
            grid.replaceChildren(errorMessage);
        }
    }
}

function filterAndSortProducts() {
  const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
  const cat = (document.querySelector("#category-filter input[type='hidden']") as HTMLInputElement | null)?.value || "all";
  const sortBy = (document.querySelector("#sort-by input[type='hidden']") as HTMLInputElement | null)?.value || "date-desc";
  const priceControl = document.getElementById('price-filter');
  if (priceControl && allProducts.length) {
    const stepWei = 10n ** 15n;
    const highestWei = allProducts.reduce((highest, product) => {
      const priceWei = window.PeerLoopMoney.toWei(product.price);
      return priceWei > highest ? priceWei : highest;
    }, stepWei);
    const boundWei = ((highestWei + stepWei - 1n) / stepWei) * stepWei;
    const bound = window.PeerLoopMoney.fromWei(boundWei, 3);
    const oldBound = priceControl.dataset.bound || priceControl.max;
    if (!priceControl.dataset.bound
      || window.PeerLoopMoney.compareEth(priceControl.value, oldBound) >= 0) priceControl.value = bound;
    priceControl.max = bound;
    priceControl.dataset.bound = bound;
    const maxLabel = document.getElementById('price-filter-max-label');
    if (maxLabel) maxLabel.textContent = `${bound} ETH`;
    const output = document.getElementById('price-filter-value');
    if (output) {
      output.textContent = window.PeerLoopMoney.compareEth(priceControl.value, bound) >= 0
        ? 'Any price' : `${priceControl.value} ETH`;
    }
  }
  let list = [...allProducts];
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (cat !== "all") list = list.filter(p => p.category === cat);
  if (document.getElementById('available-only')?.checked) list = list.filter(p => !p.isSold);
  if (priceControl) list = list.filter(p => window.PeerLoopMoney.compareEth(p.price, priceControl.value) <= 0);
  switch (sortBy) {
    case "price-asc": list.sort((a, b) => window.PeerLoopMoney.compareEth(a.price, b.price)); break;
    case "price-desc": list.sort((a, b) => window.PeerLoopMoney.compareEth(b.price, a.price)); break;
    case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "name-desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
    default: break;
  }
  const count = document.getElementById('product-count');
  if (count) count.textContent = `${list.length} ${list.length === 1 ? 'listing' : 'listings'}`;
  renderProducts(list);
}

async function buyNow(product, buttonElement = null) {
  if (!currentUser) {
    showAuthModal();
    throw new Error('Sign in before purchasing.');
  }
  if (!marketplaceContract || !signer) {
    showMessage("Connecting to contract... Please log in again.");
    throw new Error('Wallet is not connected to the marketplace contract.');
  }

  if (buttonElement) setButtonLoading(buttonElement, true, 'Paying...');

  try {
    await ensureSepoliaNetwork();
    const priceInWei = ethers.utils.parseEther(product.price.toString());
    showMessage("Sending transaction... Please check your wallet.");
    
    const tx = await marketplaceContract.buyProductWithEscrow(product._id, { value: priceInWei });
    
    if (buttonElement) setButtonLoading(buttonElement, true, 'Confirming...');
    const receipt = await tx.wait();
    invalidateWalletTransactionHistory();
    let escrowId = null;
    for (const log of receipt.logs || []) {
        try {
            const parsed = escrowPurchaseInterface.parseLog(log);
            if (parsed.name === 'EscrowCreated' && parsed.args.productId.toString() === String(product._id)) {
                escrowId = parsed.args.escrowId.toString();
                break;
            }
        } catch (_) {
            // Ignore logs emitted by other contracts in the same transaction.
        }
    }
    if (!escrowId) throw new Error('Purchase was confirmed, but its escrow record could not be read.');

    removeProductFromMarketplace(product._id);
    let soldAt = null;
    try {
      const blockTimestamp = await getMarketplaceBlockTimestamp(receipt.blockNumber);
      soldAt = new Date(blockTimestamp * 1000).toISOString();
    } catch (error) {
      console.warn('Could not read confirmed purchase block timestamp:', error.message);
    }
    const confirmedPurchase = recordConfirmedEscrowPurchase({
        productId: product._id,
        name: product.name,
        price: product.price,
        seller: product.seller,
        buyer: currentUser.walletAddress,
        imageUrl: product.imageUrl,
        description: product.description,
        category: product.category,
        escrowId,
        transactionHash: receipt.transactionHash || tx.hash,
        blockNumber: receipt.blockNumber,
        soldAt
    });
    
    if (window.PeerLoopAccount) {
        window.PeerLoopAccount.showEscrowDashboard(confirmedPurchase);
    }
    showMessage("Purchase secured in escrow. Review its status and release or refund it from Escrow.");

    fetchProducts(false); 
    return { transactionHash: receipt.transactionHash || tx.hash };

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
      
      if (window.PeerLoopAccount) {
        window.PeerLoopAccount.removeListing(productId);
      }

      removeProductFromMarketplace(productId);
      buttonElement?.closest('.card-neon-border')?.remove(); 
      
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
