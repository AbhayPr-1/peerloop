function SelectDropdown({ id, label, options, labelId }: {
  id: string;
  label: string;
  options: Array<{ value: string; text: string }>;
  labelId?: string;
}) {
  return (
    <div id={id} className="relative w-full">
      <button
        type="button"
        className="custom-select-btn w-full flex justify-between items-center"
        aria-label={labelId ? undefined : `Sort listings: ${label}`}
        aria-labelledby={labelId ? `${labelId} ${id}-value` : undefined}
        aria-controls={`${id}-options`}
        aria-expanded="false"
      >
        <span id={`${id}-value`}>{label}</span>
        <svg aria-hidden="true" className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div id={`${id}-options`} className="dropdown-menu w-full hidden" role="menu">
        {options.map(({ value, text }) => <button key={value} type="button" role="menuitemradio" aria-checked="false" data-value={value}>{text}</button>)}
      </div>
    </div>
  );
}

const categories = [
  { value: 'all', text: 'All categories' },
  { value: 'electronics', text: 'Electronics' },
  { value: 'wearables', text: 'Wearables' },
  { value: 'cybernetics', text: 'Cybernetics' },
  { value: 'data', text: 'Data & Software' },
  { value: 'gadgets', text: 'Gadgets' },
  { value: 'others', text: 'Others' }
];

const sortOptions = [
  { value: 'date-desc', text: 'Newest First' },
  { value: 'price-asc', text: 'Price: Low to High' },
  { value: 'price-desc', text: 'Price: High to Low' },
  { value: 'name-asc', text: 'Name: A-Z' },
  { value: 'name-desc', text: 'Name: Z-A' }
];

export function Marketplace() {
  return (
    <section id="marketplace" className="min-h-screen pt-28 pb-16 px-4 sm:px-6 lg:px-8 hidden-section hidden">
      <div className="max-w-7xl mx-auto marketplace-page">
        <header className="marketplace-intro">
          <div className="marketplace-overline">
            <span className="network-dot" aria-hidden="true" />
            <span>PeerLoop marketplace</span>
            <span className="marketplace-overline-divider" aria-hidden="true">/</span>
            <span className="marketplace-network-label">Sepolia testnet</span>
          </div>
          <div className="marketplace-intro-grid">
            <div>
              <h2 id="marketplace-heading" className="marketplace-title">
                Explore <span>listings</span>
              </h2>
              <p className="marketplace-description">
                Browse current listings from the marketplace contract. Purchases use its escrow flow and are completed with your connected wallet.
              </p>
            </div>
            <aside className="marketplace-flow-note" aria-label="Marketplace purchase information">
              <span className="marketplace-flow-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V7a5 5 0 0 1 10 0v3M5.5 10h13v10h-13z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v2" />
                </svg>
              </span>
              <span>
                <strong>Contract-based checkout</strong>
                <span>Review the on-chain transaction in your wallet before confirming.</span>
              </span>
            </aside>
          </div>

          <div className="marketplace-category-bar" id="marketplace-category-shortcuts" role="group" aria-label="Filter listings by category">
            <span className="marketplace-category-heading">Browse categories</span>
            <div className="marketplace-category-chips">
              {categories.map(({ value, text }, index) => (
                <button
                  key={value}
                  type="button"
                  className="marketplace-category-chip"
                  data-marketplace-category={value}
                  aria-pressed={index === 0}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="marketplace-layout">
          <aside className="explore-sidebar" aria-label="Filter marketplace listings">
            <div className="sidebar-control">
              <label className="sidebar-label" htmlFor="search-input">Search listings</label>
              <div className="marketplace-search-wrap">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="10.8" cy="10.8" r="6.3" />
                  <path strokeLinecap="round" d="m15.5 15.5 4.2 4.2" />
                </svg>
                <input
                  type="search"
                  id="search-input"
                  placeholder="Title or description"
                  className="w-full auth-input text-sm"
                />
              </div>
            </div>

            <div className="sidebar-control">
              <span className="sidebar-label" id="category-filter-label">Category</span>
              <SelectDropdown id="category-filter" labelId="category-filter-label" label="All categories" options={categories} />
            </div>

            <div className="sidebar-control">
              <span className="sidebar-label">Network</span>
              <div className="network-chip w-full justify-between">
                <span className="marketplace-network-name"><span className="network-dot" aria-hidden="true" />Sepolia testnet</span>
                <span className="marketplace-network-type">Marketplace</span>
              </div>
            </div>

            <div className="sidebar-control price-filter-control">
              <div className="marketplace-filter-heading">
                <label className="sidebar-label m-0" htmlFor="price-filter">Maximum price</label>
                <output id="price-filter-value" className="marketplace-price-value">Any price</output>
              </div>
              <input
                id="price-filter"
                type="range"
                min="0"
                max="5"
                step="0.001"
                defaultValue="5"
                aria-label="Maximum price in ETH"
              />
              <div className="range-scale">
                <span>0 ETH</span>
                <span id="price-filter-max-label">5 ETH</span>
              </div>
            </div>

            <div className="sidebar-control status-control">
              <span className="sidebar-label">Availability</span>
              <label className="checkbox-row">
                <input id="available-only" type="checkbox" defaultChecked />
                <span>Show available only</span>
              </label>
            </div>
          </aside>

          <div className="explore-results">
            <div className="explore-toolbar">
              <div className="marketplace-results-heading">
                <span className="sidebar-label">Marketplace inventory</span>
                <span id="product-count" className="result-count" aria-live="polite">Loading listings…</span>
              </div>
              <div className="marketplace-sort-control">
                <span className="marketplace-sort-label">Sort by</span>
                <div className="relative sort-control">
                  <SelectDropdown id="sort-by" label="Newest first" options={sortOptions} />
                </div>
              </div>
            </div>

            <div id="product-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" />
            <div id="marketplace-pagination" className="marketplace-pagination hidden" hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
