// frontend/js/animations.js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible-section');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.hidden-section').forEach(section => observer.observe(section));

// Subtle pointer parallax on visual cards via delegated listener so dynamic cards also get depth
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.matchMedia('(pointer: fine)').matches) {
  let activeCard: HTMLElement | null = null;

  document.addEventListener('pointermove', (event) => {
    const target = event.target as HTMLElement | null;
    const card = target?.closest?.('.card-neon-border') as HTMLElement | null;
    
    if (activeCard && activeCard !== card) {
      activeCard.style.transform = '';
      activeCard = null;
    }

    if (!card || card.closest('#hero')) return;
    activeCard = card;

    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(900px) rotateX(${(-y * 2.4).toFixed(2)}deg) rotateY(${(x * 2.4).toFixed(2)}deg) translateY(-3px)`;
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    if (activeCard) {
      activeCard.style.transform = '';
      activeCard = null;
    }
  });
}
