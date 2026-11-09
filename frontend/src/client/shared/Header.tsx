import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    mobileMenuToggleRef.current?.focus();
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    mobileMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuToggleRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !mobileMenuRef.current) return;
      const focusable = Array.from(mobileMenuRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="pl-header">
        <a
          className="pl-header-logo"
          href="/"
          aria-label="Peerloop home"
          onClick={(event) => {
            const homeButton = document.getElementById('nav-home-btn');
            if (!homeButton) return;
            event.preventDefault();
            homeButton.click();
          }}
        >
          <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 inline-flex items-center justify-center text-emerald-400 font-bold font-mono text-sm mr-1">
            ∞
          </span>
          PEERLOOP
        </a>

        {/* Desktop Navigation */}
        <nav className="pl-nav" aria-label="Main navigation">
          <button id="nav-home-btn" className="pl-nav-link">Home</button>
          <button id="nav-about-btn" className="pl-nav-link hidden">Ecosystem</button>
          <button id="nav-explore-btn" className="pl-nav-link hidden">Marketplace</button>
          <button id="nav-sell-btn" className="pl-nav-link hidden">Start Selling</button>
          <button id="nav-escrow-btn" className="pl-nav-link hidden">Escrow</button>
          <button id="nav-cart-btn" className="pl-nav-link hidden flex items-center gap-1.5" aria-label="Shopping bag">
            <span>Bag</span>
            <span id="cart-count" className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold" />
          </button>
        </nav>

        {/* Header Actions */}
        <div className="pl-header-actions">
          {/* Network Indicator Pill */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-700/30 border border-gray-600/30 text-xs font-mono font-semibold text-gray-300">
            <span className="network-dot pulse" />
            <span>Sepolia</span>
          </div>

          <ThemeToggle />

          <button id="auth-btn" className="pl-login">
            <span>Connect Wallet</span>
            <span aria-hidden="true">↗</span>
          </button>

          <div id="profile-dropdown-container" className="relative hidden">
            <button id="profile-dropdown-btn" className="pl-login">
              <span id="profile-username" className="font-mono text-xs max-w-[120px] truncate" />
              <span>⌄</span>
            </button>
            <div id="profile-dropdown-menu" className="dropdown-menu right-0 w-60 hidden">
              <div className="p-2" role="menu" aria-orientation="vertical">
                <a href="#" id="nav-profile-btn" className="rounded-lg flex items-center gap-2 font-medium" role="menuitem">
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4" strokeWidth="1.8" />
                    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span>User Dashboard</span>
                </a>
                <div className="border-t border-gray-700/40 my-1" />
                <a href="#" id="logout-btn" className="rounded-lg flex items-center gap-2 text-red-400 hover:text-red-300" role="menuitem">
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M10 4H5v16h5M14 8l4 4-4 4m4-4H9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Disconnect</span>
                </a>
              </div>
            </div>
          </div>

          {/* Mobile menu toggle button */}
          <button
            type="button"
            ref={mobileMenuToggleRef}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/40"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-md md:hidden pt-24 px-6 flex flex-col gap-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMobileMenu();
          }}
        >
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation links">
            <button
              className="text-left py-3 px-4 rounded-xl text-lg font-semibold text-gray-200 hover:bg-gray-800"
              onClick={() => {
                closeMobileMenu();
                document.getElementById('nav-home-btn')?.click();
              }}
            >
              Home
            </button>
            <button
              className="text-left py-3 px-4 rounded-xl text-lg font-semibold text-gray-200 hover:bg-gray-800"
              onClick={() => {
                closeMobileMenu();
                document.getElementById('nav-explore-btn')?.click();
              }}
            >
              Marketplace
            </button>
            <button
              className="text-left py-3 px-4 rounded-xl text-lg font-semibold text-gray-200 hover:bg-gray-800"
              onClick={() => {
                closeMobileMenu();
                document.getElementById('nav-sell-btn')?.click();
              }}
            >
              Start Selling
            </button>
            <button
              className="text-left py-3 px-4 rounded-xl text-lg font-semibold text-gray-200 hover:bg-gray-800"
              onClick={() => {
                closeMobileMenu();
                document.getElementById('nav-escrow-btn')?.click();
              }}
            >
              Escrow
            </button>
            <button
              className="text-left py-3 px-4 rounded-xl text-lg font-semibold text-gray-200 hover:bg-gray-800 flex justify-between items-center"
              onClick={() => {
                closeMobileMenu();
                document.getElementById('nav-cart-btn')?.click();
              }}
            >
              <span>Shopping Bag</span>
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
