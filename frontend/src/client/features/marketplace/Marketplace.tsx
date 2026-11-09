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
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div id={`${id}-options`} className="dropdown-menu w-full hidden">
        {options.map(({ value, text }) => <a key={value} href="#" data-value={value}>{text}</a>)}
      </div>
    </div>
  );
}

const categories = [
  { value: 'all', text: 'All Categories' },
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
      <div className="max-w-7xl mx-auto">
        {/* Marketplace Header */}
        <div className="mb-10 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="network-dot pulse" />
            <span className="account-banner-eyebrow">DECENTRALIZED COMMERCE</span>
          </div>
          <h2 id="marketplace-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Explore listings
          </h2>
          <p className="text-gray-400 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Browse current marketplace listings. Purchases use the configured contract escrow; review its
            available actions and network details before signing a transaction.
          </p>
        </div>

        {/* Layout: Sidebar + Results */}
        <div className="marketplace-layout">
          {/* Filter Sidebar */}
          <aside className="explore-sidebar">
            <div className="sidebar-control">
              <label className="sidebar-label" htmlFor="search-input">Search Gears</label>
              <div className="relative">
                <input
                  type="search"
                  id="search-input"
                  placeholder="Search by title, description..."
                  className="w-full auth-input text-sm"
                />
              </div>
            </div>

            <div className="sidebar-control">
              <span className="sidebar-label" id="category-filter-label">Categories</span>
              <SelectDropdown id="category-filter" labelId="category-filter-label" label="All Categories" options={categories} />
            </div>

            <div className="sidebar-control">
              <span className="sidebar-label">Blockchain Network</span>
              <div className="network-chip w-full justify-between">
                <div className="flex items-center gap-2">
                  <span className="network-dot" />
                  <span>Sepolia Testnet</span>
                </div>
                <span className="text-xs text-gray-400">11155111</span>
              </div>
            </div>

            <div className="sidebar-control price-filter-control">
              <div className="flex justify-between items-center mb-1">
                <label className="sidebar-label m-0" htmlFor="price-filter">Max Price</label>
                <output id="price-filter-value" className="text-xs font-mono font-bold text-neon-pink">Any price</output>
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
              <span className="sidebar-label">Listing Status</span>
              <label className="checkbox-row">
                <input id="available-only" type="checkbox" defaultChecked />
                <span>Show Available Only</span>
              </label>
            </div>
          </aside>

          {/* Results Area */}
          <div className="explore-results">
            {/* Toolbar */}
            <div className="explore-toolbar">
              <div>
                <span className="sidebar-label">Marketplace Inventory</span>
                <span id="product-count" className="result-count">Loading listings…</span>
              </div>
              <div className="relative sort-control">
                <SelectDropdown id="sort-by" label="Newest First" options={sortOptions} />
              </div>
            </div>

            {/* Product Cards Grid */}
            <div id="product-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" />
          </div>
        </div>
      </div>
    </section>
  );
}
