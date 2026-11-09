export function SellListing() {
  return (
    <section id="sell-tab" className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 hidden-section hidden">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">SELL YOUR GEAR</h2>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-xl mx-auto leading-relaxed">
            Create a listing on the configured Ethereum test network. Purchases use contract escrow; released
            funds are recorded for seller withdrawal.
          </p>
        </div>

        <div className="theme-card-bg rounded-2xl p-6 sm:p-10 card-neon-border">
          <form id="create-listing-form" className="space-y-6">
            {/* Product Name */}
            <div>
              <label htmlFor="product-name" className="block text-sm font-bold uppercase tracking-wider mb-2 text-neon-blue">
                Product Title
              </label>
              <input
                type="text"
                id="product-name"
                placeholder="e.g. Cyberdeck Terminal 2077, Neural Rig..."
                maxLength={100}
                required
                className="w-full p-3.5 auth-input"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="product-desc" className="block text-sm font-bold uppercase tracking-wider mb-2 text-neon-blue">
                Detailed Description
              </label>
              <textarea
                id="product-desc"
                rows={4}
                placeholder="Describe item condition, technical specifications, and delivery details..."
                maxLength={2000}
                required
                className="w-full p-3.5 auth-input"
              />
            </div>

            {/* Price & Category in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="product-price" className="block text-sm font-bold uppercase tracking-wider mb-2 text-neon-blue">
                  Price in ETH
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="product-price"
                    placeholder="0.05"
                    step="any"
                    min="0"
                    required
                    className="w-full p-3.5 pr-14 auth-input font-mono"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-400">
                    ETH
                  </span>
                </div>
              </div>

              <div>
                <span id="product-category-label" className="block text-sm font-bold uppercase tracking-wider mb-2 text-neon-blue">
                  Category
                </span>
                <div id="product-category" className="relative w-full">
                  <button
                    type="button"
                    className="custom-select-btn w-full flex justify-between items-center"
                    aria-labelledby="product-category-label product-category-value"
                    aria-controls="product-category-options"
                    aria-expanded="false"
                  >
                    <span id="product-category-value">Electronics</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div id="product-category-options" className="dropdown-menu w-full hidden" role="menu">
                    <button type="button" role="menuitemradio" aria-checked="false" data-value="electronics">Electronics</button>
                    <button type="button" role="menuitemradio" aria-checked="false" data-value="wearables">Wearables</button>
                    <button type="button" role="menuitemradio" aria-checked="false" data-value="cybernetics">Cybernetics</button>
                    <button type="button" role="menuitemradio" aria-checked="false" data-value="data">Data &amp; Software</button>
                    <button type="button" role="menuitemradio" aria-checked="false" data-value="gadgets">Gadgets</button>
                    <button type="button" role="menuitemradio" aria-checked="false" data-value="others">Others</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Uploader */}
            <div>
              <span className="block text-sm font-bold uppercase tracking-wider mb-2 text-neon-blue">
                Product Images
              </span>
              <div id="image-uploader" className="mt-1 flex justify-center px-6 pt-6 pb-6 border-2 border-dashed rounded-xl cursor-pointer">
                <div className="space-y-2 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-neon-blue">
                    <svg className="w-6 h-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex text-sm text-gray-300 justify-center">
                    <label htmlFor="product-photo" className="relative cursor-pointer font-semibold text-neon-blue hover:underline">
                      <span>Upload images</span>
                      <input id="product-photo" name="product-photo" type="file" className="sr-only" accept="image/jpeg,image/png,image/gif,image/webp" multiple />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-400">PNG, JPG, GIF or WebP. Up to 8 images, 5 MB each.</p>
                  <p id="file-name-display" className="text-sm text-neon-blue font-semibold" />
                </div>
              </div>

              {/* Image Preview Grid */}
              <div id="image-preview" className="mt-4 hidden">
                <div id="image-preview-grid" className="image-preview-grid flex gap-3 flex-wrap" />
                <p className="image-preview-note text-xs text-gray-400 mt-2">
                  All photos will be pinned to IPFS. Remove any photo you do not want before submitting.
                </p>
              </div>
            </div>

            {/* Contract flow notice */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-700/20 border border-gray-600/30 text-xs text-gray-400">
              <span aria-hidden="true" className="text-emerald-400 text-base font-mono">PL</span>
              <div>
                <strong className="text-gray-200 block mb-0.5">Listing and payment flow</strong>
                Listing details are submitted to the marketplace contract. When purchased, payment is held
                by the contract. On release, the amount is credited for you to withdraw in a separate transaction.
              </div>
            </div>

            <button type="submit" className="w-full modern-button text-lg py-4">
              <span>Create Listing on Sepolia</span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
