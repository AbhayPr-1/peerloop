import { useEffect, type FormEvent } from 'react';
import { NetworkScene3D } from './NetworkScene3D';

const CONTACT_EMAIL = 'contact@peerloop.market';

function BrandIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M10 10h4v4h-4z" /></>,
    watch: <><rect x="8" y="6" width="8" height="12" rx="3" /><path d="m9 2 1 4m5-4-1 4m-5 12 1 4m5-4-1 4M12 9v3l2 1" /></>,
    network: <><circle cx="12" cy="12" r="3" /><circle cx="5" cy="6" r="1.5" /><circle cx="19" cy="6" r="1.5" /><circle cx="5" cy="18" r="1.5" /><circle cx="19" cy="18" r="1.5" /><path d="m10 10-4-3m8 3 4-3m-8 7-4 3m8-3 4 3" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-13-4 16" /></>,
    device: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M10 6h4m-3 12h2" /></>,
    prism: <><path d="m12 3 8 5v8l-8 5-8-5V8l8-5Z" /><path d="m4 8 8 5 8-5m-8 5v8" /></>,
    escrow: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2" /></>,
    exchange: <><path d="M4 8h14l-3-3m5 11H6l3 3" /><path d="M18 8v2M6 14v2" /></>,
    consensus: <><circle cx="12" cy="7" r="3" /><circle cx="5" cy="17" r="2.5" /><circle cx="19" cy="17" r="2.5" /><path d="m10 9-3.5 6m7.5-6 3.5 6M8 18h8" /></>,
    ledger: <><path d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5v-11Z" /><path d="m4 6.5 8 3.5 8-3.5M12 10v11m-4-13 8 4" /></>
  };

  return (
    <svg className="pl-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name] ?? paths.network}
    </svg>
  );
}

const categoriesPreview = [
  { id: 'electronics', name: 'Electronics', count: 'Hardware & Circuits', icon: 'chip' },
  { id: 'wearables', name: 'Wearables', count: 'Smart & Bio Devices', icon: 'watch' },
  { id: 'cybernetics', name: 'Cybernetics', count: 'Neural & Modded Tech', icon: 'network' },
  { id: 'data', name: 'Data & Software', count: 'Decentralized Code', icon: 'code' },
  { id: 'gadgets', name: 'Gadgets', count: 'Field Tools & Devices', icon: 'device' },
  { id: 'others', name: 'All Collectibles', count: 'Rare Goods & Pieces', icon: 'prism' }
];

export function LandingPage() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.peerloop-home');
    if (!page) return;

    const revealTargets = Array.from(page.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    page.classList.add('pl-motion-ready');

    let observer: IntersectionObserver | undefined;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach((element) => element.setAttribute('data-revealed', 'true'));
    } else {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-revealed', 'true');
          observer?.unobserve(entry.target);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

      revealTargets.forEach((element) => {
        if (element.dataset.reveal === 'hero') {
          element.setAttribute('data-revealed', 'true');
        } else {
          observer?.observe(element);
        }
      });
    }

    const progress = document.querySelector<HTMLElement>('.pl-scroll-progress');
    let frame = 0;
    const updateScrollEffects = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progressValue = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        progress?.style.setProperty('--scroll-progress', `${Math.min(1, Math.max(0, progressValue)) * 100}%`);
      });
    };

    updateScrollEffects();
    window.addEventListener('scroll', updateScrollEffects, { passive: true });
    window.addEventListener('resize', updateScrollEffects, { passive: true });

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateScrollEffects);
      window.removeEventListener('resize', updateScrollEffects);
      page.classList.remove('pl-motion-ready');
    };
  }, []);

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();
    const subject = encodeURIComponent(`Peerloop Inquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nEmail: ${email}`);
    window.location.assign(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <main className="peerloop-home relative">
      <div className="pl-scroll-progress" aria-hidden="true" />

      {/* Global 3D Full-Page Blockchain Background & Spine */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-85">
        <div className="pl-3d-blockchain-container w-full h-full">
          <NetworkScene3D />
        </div>
      </div>

      {/* 1. IMMERSIVE HERO SECTION */}
      <section id="hero" className="pl-hero relative z-10" data-reveal="hero" data-revealed="true">
        <div className="pl-hero-grid">
          <div className="pl-hero-copy">
            <div className="pl-network-badge" aria-label="Ethereum Sepolia test network">
              <span className="network-dot pulse" />
              <span>ETHEREUM SEPOLIA · SMART-CONTRACT MARKETPLACE</span>
            </div>

            <h1 className="pl-hero-title">
              Trade Beyond <br />
              <span className="pl-gradient-text">Boundaries.</span>
            </h1>

            <p className="pl-hero-subtitle">
              Discover peer-to-peer listings, buy with contract-held escrow, and review each transaction
              before signing. Buyers can release or request a refund, or open a dispute for both parties to resolve.
            </p>

            <div className="pl-hero-actions">
              <button id="hero-explore-btn" className="modern-button pl-hero-btn">
                <span>Explore Marketplace</span>
                <span aria-hidden="true">↗</span>
              </button>
              <button id="hero-sell-btn" className="modern-button-secondary pl-hero-btn">
                <span>Start Selling</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <p className="pl-testnet-note">
              <strong>Testnet only:</strong> Peerloop currently uses Sepolia test ETH, which has no mainnet value.
              Your wallet will ask you to review and approve signatures or transactions.
            </p>

            <div className="pl-hero-metrics">
              <div className="pl-metric-item">
                <span className="pl-metric-val">Ethereum</span>
                <span className="pl-metric-label">Configured test network</span>
              </div>
              <div className="pl-metric-sep" />
              <div className="pl-metric-item">
                <span className="pl-metric-val">Buyer-led</span>
                <span className="pl-metric-label">Escrow actions</span>
              </div>
            </div>
          </div>

          <div className="pl-hero-visual" aria-hidden="true" />
        </div>

        <a className="pl-scroll-indicator" href="#philosophy" aria-label="Scroll to explore ecosystem">
          <span>DISCOVER PROTOCOL</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </a>
      </section>

      {/* 2. BLOCKCHAIN ECOSYSTEM */}
      <section id="services" className="pl-story">
        <section id="philosophy" className="pl-section pl-philosophy" data-reveal="philosophy">
          <div className="pl-section-header">
            <span className="account-banner-eyebrow">DECENTRALIZED ARCHITECTURE</span>
            <h2 className="pl-section-title">Trade directly. <br /><em>See each on-chain step.</em></h2>
            <p className="pl-section-intro">
              Peerloop connects buyers and sellers through marketplace listings and a Solidity contract
              that records purchases, escrow actions, and seller withdrawals on the configured network.
            </p>
          </div>

          <div className="pl-feature-cards-grid">
            <article className="pl-card pl-feature-card">
              <div className="pl-card-icon"><BrandIcon name="escrow" /></div>
              <h3>Contract-held payment</h3>
              <p>
                A purchase sends the exact listing price to the contract. The buyer can release the funds,
                request a refund, or open a dispute while the escrow is active.
              </p>
            </article>

            <article className="pl-card pl-feature-card">
              <div className="pl-card-icon"><BrandIcon name="exchange" /></div>
              <h3>Direct P2P Settlement</h3>
              <p>
                A released escrow is credited to the seller's contract balance. The seller can call the
                withdrawal function to transfer that balance to their wallet.
              </p>
            </article>

            <article className="pl-card pl-feature-card">
              <div className="pl-card-icon"><BrandIcon name="consensus" /></div>
              <h3>Dual-Party Dispute Voting</h3>
              <p>
                The buyer can mark an active escrow disputed. Buyer and seller may each vote; matching
                votes determine whether the contract releases or refunds the payment.
              </p>
            </article>

            <article className="pl-card pl-feature-card">
              <div className="pl-card-icon"><BrandIcon name="ledger" /></div>
              <h3>On-chain contract events</h3>
              <p>
                The contract emits events for listings, purchases, escrow changes, and withdrawals,
                which can be inspected on the relevant network explorer.
              </p>
            </article>
          </div>
        </section>

        {/* 3. HOW PEERLOOP WORKS */}
        <section id="how-it-works" className="pl-section pl-process" data-reveal="process">
          <div className="pl-section-header">
            <span className="account-banner-eyebrow">PROTOCOL LIFECYCLE</span>
            <h2 className="pl-section-title">How Peer-to-Peer Trading Works</h2>
            <p className="pl-section-intro">Connect a wallet, choose a listing, and review each contract action before signing.</p>
          </div>

          <div className="pl-steps-grid">
            <div className="pl-step-item">
              <div className="pl-step-num">01</div>
              <h3>Connect Web3 Wallet</h3>
              <p>Connect an injected wallet provider and sign in by approving the authentication request.</p>
            </div>

            <div className="pl-step-item">
              <div className="pl-step-num">02</div>
              <h3>Discover or List</h3>
              <p>Browse available listings or create one with its description, price, and image.</p>
            </div>

            <div className="pl-step-item">
              <div className="pl-step-num">03</div>
              <h3>Deposit in Escrow</h3>
              <p>Purchase at the listed ETH price. The contract records the purchase and creates an escrow.</p>
            </div>

            <div className="pl-step-item">
              <div className="pl-step-num">04</div>
              <h3>Confirm & Settle</h3>
              <p>Confirm the delivery to release the funds, or request an instant buyer refund if the item was not fulfilled.</p>
            </div>
          </div>
        </section>

        {/* 4. MARKETPLACE DISCOVERY PREVIEW */}
        <section className="pl-section pl-categories" data-reveal="categories">
          <div className="pl-section-header">
            <span className="account-banner-eyebrow">MARKETPLACE DISCOVERY</span>
              <h2 className="pl-section-title">Explore listing categories</h2>
            <p className="pl-section-intro">From custom hardware and wearables to codebases and digital artifacts.</p>
          </div>

          <div className="pl-categories-grid">
            {categoriesPreview.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="pl-cat-card"
                onClick={() => {
                  document.getElementById('hero-explore-btn')?.click();
                  window.setTimeout(() => {
                    document.querySelector<HTMLButtonElement>(`#category-filter-options button[data-value="${cat.id}"]`)?.click();
                  }, 0);
                }}
              >
                <span className="pl-cat-icon"><BrandIcon name={cat.icon} /></span>
                <span className="pl-cat-name">{cat.name}</span>
                <span className="pl-cat-desc">{cat.count}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 5. BLOCKCHAIN TRANSACTION JOURNEY */}
        <section className="pl-section pl-journey" data-reveal="journey">
          <div className="pl-section-header">
            <span className="account-banner-eyebrow">ON-CHAIN STATE MACHINE</span>
            <h2 className="pl-section-title">The Blockchain Transaction Journey</h2>
            <p className="pl-section-intro">
              Understand the transparent state transitions executed by the Peerloop smart contract.
            </p>
          </div>

          <div className="pl-journey-diagram">
            <div className="pl-journey-node">
              <div className="pl-journey-pill">BUYER DEPOSIT</div>
              <p>Buyer initiates purchase. Exact ETH is locked in escrow contract.</p>
              <span className="pl-state-tag">EscrowState: Created</span>
            </div>

            <div className="pl-journey-arrow">→</div>

            <div className="pl-journey-node">
              <div className="pl-journey-pill">SELLER FULFILLMENT</div>
              <p>Seller delivers physical or digital goods to the buyer.</p>
              <span className="pl-state-tag">EscrowState: Created</span>
            </div>

            <div className="pl-journey-arrow">→</div>

            <div className="pl-journey-node">
              <div className="pl-journey-pill">BUYER CONFIRMATION</div>
              <p>The buyer can release or refund the escrow, or open a dispute.</p>
              <span className="pl-state-tag">Released / Refunded / Disputed</span>
            </div>

            <div className="pl-journey-arrow">→</div>

            <div className="pl-journey-node">
              <div className="pl-journey-pill">SELLER WITHDRAWAL</div>
              <p>When released, funds enter the seller's pending withdrawal balance.</p>
              <span className="pl-state-tag">Pending withdrawal</span>
            </div>
          </div>
        </section>

        {/* 6. ESCROW SAFEGUARD EXPERIENCE */}
        <section className="pl-section pl-escrow-deepdive" data-reveal="escrow">
          <div className="pl-section-header">
            <span className="account-banner-eyebrow">ESCROW CONTRACT FLOW</span>
            <h2 className="pl-section-title">Escrow actions and outcomes</h2>
            <p className="pl-section-intro">
              The contract defines buyer actions and stores their resulting escrow states on-chain. It does not verify physical delivery.
            </p>
          </div>

          <div className="pl-escrow-features">
            <div className="pl-card pl-escrow-card">
              <h3>Buyer refund action</h3>
              <p>
                For an escrow in the created state, the buyer can call the refund function. The amount is credited
                to the buyer's pending contract balance and must then be withdrawn.
              </p>
              <div className="pl-escrow-status-pill text-emerald-400">Refund changes listing availability</div>
            </div>

            <div className="pl-card pl-escrow-card">
              <h3>Consensus Dispute Resolution</h3>
              <p>
                The buyer may open a dispute. Buyer and seller can each vote to release or refund; matching
                votes trigger the corresponding contract state change.
              </p>
              <div className="pl-escrow-status-pill text-amber-400">Both parties must agree on an outcome</div>
            </div>

            <div className="pl-card pl-escrow-card">
              <h3>Independent Pull-Payment Architecture</h3>
              <p>
                Released amounts are recorded as pending withdrawals. The seller calls the contract to request
                transfer of that balance to their wallet.
              </p>
              <div className="pl-escrow-status-pill text-blue-400">Withdrawal is a separate transaction</div>
            </div>
          </div>
        </section>

        {/* 7. GETTING STARTED GUIDE */}
        <section className="pl-section pl-getstarted" data-reveal="getstarted">
          <div className="pl-section-header">
            <span className="account-banner-eyebrow">ONBOARDING GUIDE</span>
            <h2 className="pl-section-title">Getting Started on Sepolia</h2>
            <p className="pl-section-intro">Use Sepolia test ETH to try the marketplace contract without spending mainnet ETH.</p>
          </div>

          <div className="pl-onboarding-steps">
            <div className="pl-onboard-card">
              <span className="pl-onboard-num">Step 1</span>
              <h4>Obtain Sepolia Testnet ETH</h4>
              <p>Acquire Sepolia test ETH from a faucet. Testnet tokens have no mainnet value, but wallet signatures and contract calls still require care.</p>
            </div>
            <div className="pl-onboard-card">
              <span className="pl-onboard-num">Step 2</span>
              <h4>Connect & Sign Challenge</h4>
              <p>Choose Connect Wallet and review the authentication request in your wallet before signing.</p>
            </div>
            <div className="pl-onboard-card">
              <span className="pl-onboard-num">Step 3</span>
              <h4>List or Transact</h4>
              <p>Explore listings, purchase with escrow, or sell your gear to experience transparent peer-to-peer exchange.</p>
            </div>
          </div>
        </section>

        {/* 8. FINAL CALL TO ACTION */}
        <section className="pl-section pl-final-cta" data-reveal="cta">
          <div className="pl-cta-box glass-panel">
            <span className="account-banner-eyebrow">PEER-TO-PEER MARKETPLACE</span>
            <h2>Trade Beyond Boundaries.</h2>
            <p>Browse listings or create one of your own on the configured Ethereum test network.</p>
            <div className="flex gap-4 justify-center flex-wrap mt-6">
              <button
                className="modern-button"
                onClick={() => document.getElementById('hero-explore-btn')?.click()}
              >
                Launch Marketplace ↗
              </button>
              <button
                className="modern-button-secondary"
                onClick={() => document.getElementById('hero-sell-btn')?.click()}
              >
                Create Listing →
              </button>
            </div>
          </div>
        </section>

        {/* 9. CONTACT & QUESTIONS */}
        <section className="pl-section pl-contact" id="contact" data-reveal="contact">
          <div className="pl-contact-grid">
            <div className="pl-contact-info">
              <span className="account-banner-eyebrow">DEVELOPER CONTACT</span>
              <h2>Have Questions or Ideas?</h2>
              <p>Connect with the Peerloop engineering team regarding smart contracts, security, or integrations.</p>
              <div className="mt-4">
                <a className="text-neon-blue font-mono hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL} ↗
                </a>
              </div>
            </div>

            <form className="pl-contact-form" onSubmit={handleContactSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="sidebar-label">Your Name</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your name"
                    required
                    className="w-full auth-input"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="sidebar-label">Email Address</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    className="w-full auth-input"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="sidebar-label">Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={4}
                    placeholder="Describe your inquiry..."
                    required
                    className="w-full auth-input"
                  />
                </div>
                <button className="modern-button w-full" type="submit">
                  Send Message via Email ↗
                </button>
              </div>
            </form>
          </div>
        </section>
      </section>

      {/* 10. PREMIUM WEB3 FOOTER */}
      <footer className="pl-footer">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="pl-footer-grid">
            <div className="pl-footer-brand-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold font-mono">
                  ∞
                </span>
                <span className="text-xl font-bold tracking-wider text-neon-blue font-mono">PEERLOOP</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
                Peer-to-peer listings and purchases use an Ethereum smart contract escrow flow.
                Review the transaction details and network before signing.
              </p>
            </div>

            <div className="pl-footer-links-col">
              <h4 className="sidebar-label mb-3">Marketplace</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button className="hover:text-neon-blue transition-colors text-left" onClick={() => document.getElementById('hero-explore-btn')?.click()}>Browse Gears</button></li>
                <li><button className="hover:text-neon-blue transition-colors text-left" onClick={() => document.getElementById('hero-sell-btn')?.click()}>Start Selling</button></li>
                <li><button className="hover:text-neon-blue transition-colors text-left" onClick={() => document.getElementById('nav-escrow-btn')?.click()}>Escrow Status</button></li>
              </ul>
            </div>

            <div className="pl-footer-links-col">
              <h4 className="sidebar-label mb-3">Protocol</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#philosophy" className="hover:text-neon-blue transition-colors">Architecture</a></li>
                <li><a href="#how-it-works" className="hover:text-neon-blue transition-colors">How it works</a></li>
              </ul>
            </div>

            <div className="pl-footer-links-col">
              <h4 className="sidebar-label mb-3">Community & Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#contact" className="hover:text-neon-blue transition-colors">Contact Support</a></li>
                <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-neon-blue transition-colors">{CONTACT_EMAIL}</a></li>
              </ul>
            </div>
          </div>

          <div className="pl-footer-bottom mt-12 pt-6 border-t border-gray-700/40 flex justify-between items-center flex-wrap gap-4 text-xs text-gray-500">
            <a href="#hero" className="hover:text-neon-blue transition-colors">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
