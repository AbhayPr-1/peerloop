// frontend/js/animations.js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible-section');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.hidden-section').forEach(section => observer.observe(section));

// Subtle pointer parallax on visual cards only; no interaction or data flow changes.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.matchMedia('(pointer: fine)').matches) {
  document.querySelectorAll<HTMLElement>('.card-neon-border').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      if (card.closest('#hero')) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 2.4).toFixed(2)}deg) rotateY(${(x * 2.4).toFixed(2)}deg) translateY(-3px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}
