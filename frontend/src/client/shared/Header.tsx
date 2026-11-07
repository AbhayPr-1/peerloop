import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="pl-header">
      <a className="pl-header-logo" href="#hero" aria-label="PeerLoop home">PEERLOOP</a>
      <nav className="pl-nav" aria-label="Main navigation">
        <button id="nav-home-btn" className="pl-nav-link">Home</button>
        <button id="nav-about-btn" className="pl-nav-link hidden">Our philosophy</button>
        <button id="nav-explore-btn" className="pl-nav-link hidden">Marketplace</button>
        <button id="nav-sell-btn" className="pl-nav-link hidden">Start selling</button>
        <button id="nav-escrow-btn" className="pl-nav-link hidden">Escrow</button>
        <button id="nav-cart-btn" className="pl-nav-link hidden" aria-label="Shopping bag"><span aria-hidden="true">Bag</span><span id="cart-count" /></button>
      </nav>
      <div className="pl-header-actions">
        <ThemeToggle />
        <button id="auth-btn" className="pl-login">Login <span>↗</span></button>
        <div id="profile-dropdown-container" className="relative hidden">
          <button id="profile-dropdown-btn" className="pl-login"><span id="profile-username" /> <span>⌄</span></button>
          <div id="profile-dropdown-menu" className="dropdown-menu right-0 w-56 hidden"><div className="py-1" role="menu" aria-orientation="vertical"><a href="#" id="nav-profile-btn" className="block" role="menuitem">User Profile</a><div className="border-t border-gray-700 my-1" /><a href="#" id="logout-btn" className="block" role="menuitem">Logout</a></div></div>
        </div>
      </div>
    </header>
  );
}
