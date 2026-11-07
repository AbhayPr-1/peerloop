export function SellListing() {
  return (
    <section id="sell-tab" className="min-h-screen p-8 hidden-section hidden">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl sm:text-5xl font-bold mb-8 text-center">SELL YOUR GEAR</h2>
        <div className="theme-card-bg rounded-2xl p-8 card-neon-border">
          <form id="create-listing-form" className="space-y-6">
            <div>
              <label htmlFor="product-name" className="block text-xl font-medium mb-2 text-neon-blue">Product Name</label>
              <input type="text" id="product-name" placeholder="Cyberdeck 2077" required className="w-full p-3 rounded-xl auth-input" />
            </div>
            <div>
              <label htmlFor="product-desc" className="block text-xl font-medium mb-2 text-neon-blue">Description</label>
              <textarea id="product-desc" rows={4} placeholder="A custom rig for hacking." required className="w-full p-3 rounded-xl auth-input" />
            </div>
            <div>
              <label htmlFor="product-price" className="block text-xl font-medium mb-2 text-neon-blue">Price (ETH)</label>
              <input type="number" id="product-price" placeholder="0.0001" step="0.0001" min="0" required className="w-full p-3 rounded-xl auth-input" />
            </div>
            <div>
              <label htmlFor="product-category" className="block text-xl font-medium mb-2 text-neon-blue">Category</label>
              <div id="product-category" className="relative w-full">
                <button type="button" className="custom-select-btn w-full flex justify-between items-center">
                  <span>Electronics</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="dropdown-menu w-full hidden">
                  <a href="#" data-value="electronics">Electronics</a>
                  <a href="#" data-value="wearables">Wearables</a>
                  <a href="#" data-value="cybernetics">Cybernetics</a>
                  <a href="#" data-value="data">Data &amp; Software</a>
                  <a href="#" data-value="gadgets">Gadgets</a>
                  <a href="#" data-value="others">Others</a>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xl font-medium mb-2 text-neon-blue">Product Images</label>
              <div id="image-uploader" className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex text-sm text-neon-blue">
                    <label htmlFor="product-photo" className="relative cursor-pointer rounded-md font-medium text-neon-blue hover:text-neon-pink focus-within:outline-none">
                      <span>Upload images</span>
                      <input id="product-photo" name="product-photo" type="file" className="sr-only" accept="image/jpeg,image/png,image/gif,image/webp" multiple />
                    </label>
                    <p className="pl-1">or drag and drop images</p>
                  </div>
                  <p className="text-xs text-neon-blue">PNG, JPG, GIF or WebP. 5 MB each, up to 8 images.</p>
                  <p id="file-name-display" className="text-sm text-neon-blue font-semibold" />
                </div>
              </div>
              <div id="image-preview" className="mt-4 hidden">
                <div id="image-preview-grid" className="image-preview-grid" />
                <p className="image-preview-note">All selected photos will appear in Explore and your sale or purchase history. Remove any image you do not want before creating the listing.</p>
              </div>
            </div>
            <button type="submit" className="w-full modern-button text-lg">Create Listing</button>
          </form>
        </div>
      </div>
    </section>
  );
}
