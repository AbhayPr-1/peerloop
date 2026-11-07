function SelectDropdown({ id, label, options }: { id: string; label: string; options: Array<{ value: string; text: string }> }) {
  return (
    <div id={id} className="relative w-full">
      <button type="button" className="custom-select-btn w-full flex justify-between items-center">
        <span>{label}</span>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="dropdown-menu w-full hidden">
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
    <section id="marketplace" className="min-h-screen p-8 hidden-section hidden">
      <div className="max-w-7xl mx-auto">
        <h2 id="marketplace-heading" className="text-4xl sm:text-5xl font-bold mb-8 text-center">EXPLORE GEARS</h2>
        <div className="marketplace-layout">
          <aside className="explore-sidebar">
            <label className="sidebar-label" htmlFor="search-input">Search</label>
            <input type="search" id="search-input" placeholder="Search gears..." className="w-full p-3 rounded-xl auth-input" />
            <div className="sidebar-control">
              <label className="sidebar-label" htmlFor="category-filter">Categories</label>
              <SelectDropdown id="category-filter" label="All Categories" options={categories} />
            </div>
            <div className="sidebar-control">
              <span className="sidebar-label">Blockchain</span>
              <div className="network-chip"><span className="network-dot" />Sepolia network</div>
            </div>
            <div className="sidebar-control price-filter-control">
              <label className="sidebar-label" htmlFor="price-filter">Maximum price <output id="price-filter-value">Any price</output></label>
              <input id="price-filter" type="range" min="0" max="5" step="0.001" defaultValue="5" aria-label="Maximum price in ETH" />
              <div className="range-scale"><span>0 ETH</span><span id="price-filter-max-label">5 ETH</span></div>
            </div>
            <div className="sidebar-control status-control">
              <span className="sidebar-label">Status</span>
              <label className="checkbox-row"><input id="available-only" type="checkbox" defaultChecked /> Available listings</label>
            </div>
          </aside>
          <div className="explore-results">
            <div className="explore-toolbar">
              <div><span className="sidebar-label">Marketplace</span><span id="product-count" className="result-count">Loading listings…</span></div>
              <div className="relative sort-control">
                <SelectDropdown id="sort-by" label="Newest First" options={sortOptions} />
              </div>
            </div>
            <div id="product-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8" />
          </div>
        </div>
      </div>
    </section>
  );
}
