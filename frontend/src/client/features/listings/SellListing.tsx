import { useEffect, useState } from 'react';

export function SellListing() {
  const [preview, setPreview] = useState({ title: '', category: 'Electronics', price: '', description: '', images: [] as string[] });

  useEffect(() => {
    const title = document.getElementById('product-name') as HTMLInputElement | null;
    const category = document.getElementById('product-category-value');
    const price = document.getElementById('product-price') as HTMLInputElement | null;
    const description = document.getElementById('product-desc') as HTMLTextAreaElement | null;
    const imageGrid = document.getElementById('image-preview-grid');
    const form = document.getElementById('create-listing-form');
    if (!title || !category || !price || !description || !imageGrid || !form) return;

    const refresh = () => setPreview({
      title: title.value,
      category: category.textContent?.trim() || '',
      price: price.value,
      description: description.value,
      images: Array.from(imageGrid.querySelectorAll('img')).map((image) => image.src),
    });
    [title, price, description].forEach((field) => field.addEventListener('input', refresh));
    const handleReset = () => window.setTimeout(refresh, 0);
    form.addEventListener('reset', handleReset);
    const observer = new MutationObserver(refresh);
    observer.observe(category, { childList: true, characterData: true, subtree: true });
    observer.observe(imageGrid, { childList: true, subtree: true });
    refresh();
    return () => {
      [title, price, description].forEach((field) => field.removeEventListener('input', refresh));
      form.removeEventListener('reset', handleReset);
      observer.disconnect();
    };
  }, []);

  const formattedPrice = preview.price && Number.isFinite(Number(preview.price))
    ? Number(preview.price).toLocaleString(undefined, { maximumFractionDigits: 8 })
    : '';

  return (
    <section id="sell-tab" className="sell-page min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 hidden-section hidden">
      <div className="sell-shell">
        <header className="sell-heading">
          <div>
            <div className="sell-eyebrow"><span className="sell-eyebrow-mark" /> LIST A PRODUCT <span className="sell-divider">/</span> PEERLOOP MARKETPLACE</div>
            <h2>Sell your gear</h2>
            <p>Create a marketplace listing with the details buyers need. Purchases use the configured contract escrow flow; released funds are recorded for seller withdrawal.</p>
          </div>
          <div className="sell-network-note"><span className="sell-network-dot" /><span>Configured test network</span></div>
        </header>

        <div className="sell-layout">
          <form id="create-listing-form" className="sell-form">
            <section className="sell-panel" aria-labelledby="sell-item-heading">
              <div className="sell-panel-heading"><div><span className="sell-index">01</span><h3 id="sell-item-heading">Item details</h3></div><span className="sell-panel-caption">PRODUCT INFORMATION</span></div>
              <div className="sell-field">
                <label htmlFor="product-name">Product title <span>*</span></label>
                <input type="text" id="product-name" placeholder="Enter a clear, descriptive title" maxLength={100} required className="auth-input" />
              </div>
              <div className="sell-field sell-field-row">
                <div>
                  <span id="product-category-label">Category <span>*</span></span>
                  <div id="product-category" className="custom-select relative w-full">
                    <button type="button" className="custom-select-btn w-full flex justify-between items-center" aria-labelledby="product-category-label product-category-value" aria-controls="product-category-options" aria-expanded="false">
                      <span id="product-category-value">Electronics</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
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
                <div className="sell-price-field">
                  <label htmlFor="product-price">Price <span>*</span></label>
                  <div className="sell-price-input"><input type="number" id="product-price" placeholder="Enter amount" step="any" min="0" required className="auth-input font-mono" /><span>ETH</span></div>
                </div>
              </div>
              <div className="sell-field">
                <label htmlFor="product-desc">Description <span>*</span></label>
                <textarea id="product-desc" rows={5} placeholder="Describe condition, specifications, included items, and delivery details..." maxLength={2000} required className="auth-input" />
                <small>Share accurate details buyers can use to assess the item.</small>
              </div>
            </section>

            <section className="sell-panel" aria-labelledby="sell-images-heading">
              <div className="sell-panel-heading"><div><span className="sell-index">02</span><h3 id="sell-images-heading">Product images</h3></div><span className="sell-panel-caption">ADD YOUR OWN PHOTOS</span></div>
              <div id="image-uploader" className="sell-upload">
                <div className="sell-upload-icon" aria-hidden="true"><svg className="w-6 h-6" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                <div className="sell-upload-copy"><label htmlFor="product-photo">Choose product images</label><span>or drag and drop</span></div>
                <input id="product-photo" name="product-photo" type="file" className="sr-only" accept="image/jpeg,image/png,image/gif,image/webp" multiple />
                <p>PNG, JPG, GIF or WebP. Up to 8 images, 5 MB each.</p>
                <p id="file-name-display" className="sell-file-name" />
              </div>
              <div id="image-preview" className="mt-4 hidden"><div id="image-preview-grid" className="image-preview-grid flex gap-3 flex-wrap" /><p className="image-preview-note text-xs text-gray-400 mt-2">All photos will be pinned to IPFS. Remove any photo you do not want before submitting.</p></div>
            </section>

            <div className="sell-flow-note"><span className="sell-flow-mark" aria-hidden="true">∞</span><div><strong>How listing and payment work</strong><p>Listing details are submitted to the marketplace contract. When purchased, payment is held by the contract. On release, the amount is credited for you to withdraw in a separate transaction.</p></div></div>
            <button type="submit" className="sell-submit modern-button"><span>Create listing on configured network</span><span aria-hidden="true">↗</span></button>
          </form>

          <aside className="sell-aside" aria-label="Live listing preview">
            <div className="sell-aside-label">LIVE LISTING PREVIEW <span className="sell-live-indicator">• UPDATING</span></div>
            <div className="sell-preview-card">
              <div className="sell-preview-image">
                {preview.images[0] ? <img src={preview.images[0]} alt={preview.title ? `${preview.title} product photo` : 'Selected product photo'} /> : <div className="sell-preview-empty"><span aria-hidden="true">＋</span><span>Your product photo will appear here</span></div>}
                {preview.images.length > 0 && <span className="sell-preview-photo-count">{preview.images.length} photo{preview.images.length === 1 ? '' : 's'}</span>}
              </div>
              <div className="sell-preview-content">
                <span className="sell-preview-category">{preview.category || 'Category'}</span>
                <h3>{preview.title.trim() || 'Your product title'}</h3>
                <p className="sell-preview-description">{preview.description.trim() || 'Your product description will appear here.'}</p>
                <div className="sell-preview-price"><span>Asking price</span><strong>{formattedPrice || '—'} <small>ETH</small></strong></div>
              </div>
            </div>
            <p className="sell-aside-footnote">Preview reflects the information you enter above. Only the first selected photo is shown.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
