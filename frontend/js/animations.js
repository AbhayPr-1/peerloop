// frontend/js/animations.js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible-section');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.hidden-section').forEach(section => observer.observe(section));

const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function Particle() {
  this.x = Math.random() * canvas.width;
  this.y = Math.random() * canvas.height;
  this.size = Math.random() * 2 + 1;
  this.speedX = (Math.random() - 0.5) * 0.5;
  this.speedY = (Math.random() - 0.5) * 0.5;
  this.color = `rgba(0,229,255,${Math.random()*0.5+0.3})`;
}
Particle.prototype.update = function() {
  this.x += this.speedX; this.y += this.speedY;
  if (this.x<=0 || this.x>=canvas.width) this.speedX *= -1;
  if (this.y<=0 || this.y>=canvas.height) this.speedY *= -1;
};
Particle.prototype.draw = function() {
  ctx.fillStyle = this.color;
  ctx.beginPath();
  ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
  ctx.fill();
};
function connectParticles() {
  const maxDistance = 120;
  for (let a=0;a<particles.length;a++) {
    for (let b=a+1;b<particles.length;b++) {
      const dist = Math.hypot(particles[a].x - particles[b].x, particles[a].y - particles[b].y);
      if (dist < maxDistance) {
        ctx.strokeStyle = `rgba(0,229,255,${(maxDistance-dist)/maxDistance*0.4})`;
        ctx.beginPath();
        ctx.moveTo(particles[a].x, particles[a].y);
        ctx.lineTo(particles[b].x, particles[b].y);
        ctx.stroke();
      }
    }
  }
}
function animateParticles() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  connectParticles();
  requestAnimationFrame(animateParticles);
}
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  particles = [];
  let numParticles = window.innerWidth < 768 ? 50 : 100;
  for (let i=0;i<numParticles;i++) particles.push(new Particle());
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
animateParticles();