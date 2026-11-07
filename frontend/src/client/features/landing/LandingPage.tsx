import { useEffect, type FormEvent } from 'react';

const CONTACT_EMAIL = 'hello@peerloop.market';

const editorialImages = [
  {
    src: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=85',
    alt: 'Sculptural mid-century chair in a quiet interior',
    label: 'OBJECTS WITH A PAST',
    title: 'A little more lived in.',
    className: 'pl-editorial-item pl-editorial-item--large'
  },
  {
    src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85',
    alt: 'Classic watch photographed against a warm neutral background',
    label: 'THE EVERYDAY',
    title: 'Keep time beautifully.',
    className: 'pl-editorial-item'
  },
  {
    src: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=85',
    alt: 'Well-kept leather accessories',
    label: 'MADE TO CARRY ON',
    title: 'Good things go places.',
    className: 'pl-editorial-item pl-editorial-item--offset'
  }
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
      }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

      revealTargets.forEach((element) => {
        if (element.dataset.reveal === 'hero') {
          element.setAttribute('data-revealed', 'true');
        } else {
          observer?.observe(element);
        }
      });
    }

    const progress = document.querySelector<HTMLElement>('.pl-scroll-progress');
    const heroImage = page.querySelector<HTMLElement>('.pl-hero-art img');
    let frame = 0;
    const updateScrollEffects = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progressValue = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        progress?.style.setProperty('--scroll-progress', `${Math.min(1, Math.max(0, progressValue)) * 100}%`);

        if (!reducedMotion && heroImage) {
          const heroOffset = Math.min(window.scrollY, window.innerHeight) * 0.09;
          heroImage.style.setProperty('--hero-parallax', `${heroOffset}px`);
        }
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
    const subject = encodeURIComponent(`A note for PeerLoop from ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nEmail: ${email}`);

    window.location.assign(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <main className="peerloop-home">
      <div className="pl-scroll-progress" aria-hidden="true" />

      <section id="hero" className="pl-hero" data-reveal="hero" data-revealed="true">
        <div className="pl-hero-copy">
          <p className="pl-eyebrow"><span /> A blockchain-powered peer-to-peer marketplace</p>
          <h1 className="pl-wordmark">PEERLOOP</h1>
          <h2>Good things<br /><em>deserve another life.</em></h2>
          <p className="pl-intro">
            A more considered way to buy and sell pre-loved pieces. Meet the person behind the find,
            exchange directly, and keep good things in circulation.
          </p>
          <div className="pl-chain-note" aria-label="PeerLoop uses Ethereum, the Sepolia network, and ETH payments">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.8 5.7 12l6.3 3.4 6.3-3.4L12 2.8Z" />
              <path d="m5.7 13.2 6.3 8 6.3-8-6.3 3.4-6.3-3.4Z" />
            </svg>
            <span><strong>Built on Ethereum</strong><small>Sepolia network <i /> ETH payments</small></span>
          </div>
          <div className="pl-actions">
            <button id="hero-explore-btn" className="pl-button pl-button-dark">
              Explore marketplace <span aria-hidden="true">↗</span>
            </button>
            <button id="hero-sell-btn" className="pl-button pl-button-light">
              Start selling <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="pl-hero-note"><span className="pl-note-rule" />Direct exchange. Thoughtful reuse. On-chain transparency.</div>
        </div>

        <figure className="pl-hero-art">
          <div className="pl-hero-image">
            <img
              src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1500&q=85"
              alt="Sculptural white vases beneath flowering branches in a sunlit room"
              fetchPriority="high"
            />
          </div>
          <figcaption className="pl-image-note">
            Found once. Loved all over again.
          </figcaption>
        </figure>

        <a className="pl-scroll" href="#philosophy">
          <span>SCROLL TO DISCOVER</span><i aria-hidden="true" />
        </a>
      </section>

      <section id="services" className="pl-story">
        <section id="philosophy" className="pl-philosophy" data-reveal="philosophy">
          <div className="pl-section-index">THE PEERLOOP IDEA</div>
          <div className="pl-philosophy-copy">
            <p className="pl-kicker">A little less waste. A lot more meaning.</p>
            <h2>The next chapter<br />is <em>closer than new.</em></h2>
            <p>
              The things we value deserve more than a one-way journey. PeerLoop brings people
              together to pass useful, beautiful things on—making thoughtful finds more accessible
              and giving every good piece somewhere to go next.
            </p>
            <div className="pl-values">
              <span>Keep good things in use</span>
              <span>Buy with intention</span>
              <span>Trade directly, person to person</span>
            </div>
          </div>
          <figure className="pl-philosophy-image">
            <img
              src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1100&q=85"
              alt="A warm home filled with plants and carefully collected objects"
              loading="lazy"
            />
            <figcaption>A life well lived leaves lovely things behind.</figcaption>
          </figure>
        </section>

        <section className="pl-process" id="how-it-works" data-reveal="process">
          <div className="pl-process-heading">
            <p className="pl-section-index">SERVICES · HOW IT WORKS</p>
            <h2>From one good<br />thing to <em>another.</em></h2>
            <p className="pl-process-intro">A marketplace should feel as human as the exchange itself.</p>
          </div>
          <div className="pl-steps">
            <article className="pl-service-card">
              <h3>Discover</h3>
              <p>Explore pieces listed by other people. Find something useful, lovely, or simply right for you.</p>
            </article>
            <article className="pl-service-card">
              <h3>Connect</h3>
              <p>Get to know the person behind the listing and choose the pieces you want to make your own.</p>
            </article>
            <article className="pl-service-card">
              <h3>Exchange</h3>
              <p>Complete purchases with ETH through a blockchain-powered marketplace built for transparent exchange.</p>
            </article>
          </div>
        </section>

        <section className="pl-trust" data-reveal="trust">
          <figure className="pl-trust-image">
            <img
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1300&q=85"
              alt="A carefully arranged collection of vintage clothing and accessories"
              loading="lazy"
            />
            <figcaption>Good things, ready for their next owner.</figcaption>
          </figure>
          <div className="pl-trust-copy">
            <p className="pl-section-index">FEATURES THAT BUILD TRUST</p>
            <h2>Personal by nature.<br /><em>Transparent by design.</em></h2>
            <p>
              PeerLoop connects buyers and sellers directly, with wallet-based identity and
              blockchain-powered transactions. Less distance between people—and a clearer view of
              every exchange.
            </p>
            <ul className="pl-feature-grid">
              <li><div><h3>Direct trading</h3><p>Buy and sell person to person.</p></div></li>
              <li><div><h3>Escrow payments</h3><p>Funds stay held until the buyer releases or refunds.</p></div></li>
              <li><div><h3>On-chain records</h3><p>Purchases and escrow actions are recorded on Sepolia.</p></div></li>
              <li><div><h3>Wallet identity</h3><p>Connect a wallet to make marketplace transactions.</p></div></li>
              <li><div><h3>Keep goods moving</h3><p>Give useful, well-loved pieces another chapter.</p></div></li>
            </ul>
          </div>
        </section>

        <section className="pl-market" data-reveal="market">
          <div className="pl-market-heading">
            <div>
              <p className="pl-section-index">THE PEERLOOP EXPERIENCE</p>
              <h2>Good things<br /><em>find good people.</em></h2>
            </div>
            <button
              id="market-edit-btn"
              className="pl-text-link"
              onClick={() => document.getElementById('hero-explore-btn')?.click()}
            >
              Explore marketplace <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="pl-editorial-note">A few illustrative finds, not live listings.</p>
          <div className="pl-editorial-grid">
            {editorialImages.map((item) => (
              <article className={item.className} key={item.label}>
                <div className="pl-editorial-image">
                  <img src={item.src} alt={item.alt} loading="lazy" />
                </div>
                <p>{item.label}</p>
                <h3>{item.title}</h3>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="pl-manifesto" data-reveal="manifesto">
        <p>THE NEXT CHAPTER STARTS HERE</p>
        <h2>Pass it on.<br /><em>Keep it going.</em></h2>
        <button
          className="pl-button pl-button-ivory"
          onClick={() => document.getElementById('hero-explore-btn')?.click()}
        >
          Find something worth keeping <span aria-hidden="true">↗</span>
        </button>
      </section>

      <section className="pl-contact" id="contact" data-reveal="contact">
        <div className="pl-contact-copy">
          <p className="pl-section-index">SAY HELLO</p>
          <h2>Good things<br /><em>start with a note.</em></h2>
          <p>Questions, ideas, or something lovely to pass along? We’d love to hear from you.</p>
          <a className="pl-contact-link" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <form className="pl-contact-form" onSubmit={handleContactSubmit}>
          <label>
            <span>Your name</span>
            <input name="name" type="text" autoComplete="name" placeholder="How should we address you?" required />
          </label>
          <label>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>Your message</span>
            <textarea name="message" rows={4} placeholder="What’s on your mind?" required />
          </label>
          <button className="pl-button pl-button-dark" type="submit">
            Open a message to PeerLoop <span aria-hidden="true">↗</span>
          </button>
          <p className="pl-form-note">Your email app will open with your message addressed to PeerLoop.</p>
        </form>
      </section>

      <footer className="pl-footer">
        <div className="pl-footer-main">
          <div className="pl-footer-about">
            <a className="pl-footer-brand" href="#hero">PEERLOOP</a>
            <p>A more considered marketplace.<br />Good things deserve another life.</p>
          </div>
          <nav className="pl-footer-links" aria-label="Footer navigation">
            <div>
              <span>EXPLORE</span>
              <button onClick={() => document.getElementById('hero-explore-btn')?.click()}>Marketplace <i>↗</i></button>
              <button onClick={() => document.getElementById('hero-sell-btn')?.click()}>Start selling <i>↗</i></button>
            </div>
            <div>
              <span>PEERLOOP</span>
              <a href="#philosophy">Our philosophy</a>
              <a href="#how-it-works">How it works</a>
              <a href="#contact">Contact us</a>
            </div>
          </nav>
        </div>
        <div className="pl-footer-bottom">
          <a href="#hero">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
