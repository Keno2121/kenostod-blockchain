/* ══════════════════════════════════════════════════════════════════════
   THE KINGS SHIELD — app.js
   Animated circuit canvas · scroll reveals · nav effects
   ══════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Circuit network canvas background ────────────────────────────────────
(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, nodes = [], edges = [], frame = 0;
  const NODE_COUNT  = 60;
  const GOLD        = 'rgba(200,146,10,';
  const GREEN       = 'rgba(0,255,136,';
  const MAX_DIST    = 160;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x:   Math.random() * W,
        y:   Math.random() * H,
        vx:  (Math.random() - 0.5) * 0.22,
        vy:  (Math.random() - 0.5) * 0.22,
        r:   Math.random() * 2 + 0.5,
        gold: Math.random() > 0.7,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.02,
      });
    }
  }

  function drawFrame() {
    ctx.clearRect(0, 0, W, H);
    frame++;

    // Update positions
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += n.pulseSpeed;
      if (n.x < -10)  n.x = W + 10;
      if (n.x > W+10) n.x = -10;
      if (n.y < -10)  n.y = H + 10;
      if (n.y > H+10) n.y = -10;
    }

    // Draw edges
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.12;
          const col = (a.gold || b.gold) ? GOLD : GREEN;
          ctx.beginPath();
          ctx.strokeStyle = col + alpha + ')';
          ctx.lineWidth = 0.6;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const n of nodes) {
      const pulse = (Math.sin(n.pulse) + 1) * 0.5;
      const alpha = 0.3 + pulse * 0.5;
      const col   = n.gold ? GOLD : GREEN;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = col + alpha + ')';
      ctx.fill();

      // Glow on brighter nodes
      if (pulse > 0.8) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = col + (alpha * 0.12) + ')';
        ctx.fill();
      }
    }

    requestAnimationFrame(drawFrame);
  }

  resize();
  createNodes();
  drawFrame();
  window.addEventListener('resize', () => { resize(); createNodes(); });
})();


// ── Navbar scroll effect ──────────────────────────────────────────────────
(function initNav() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const mobile = document.getElementById('navMobile');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  if (toggle && mobile) {
    toggle.addEventListener('click', () => {
      mobile.classList.toggle('open');
    });
  }

  // Close mobile menu on link click
  document.querySelectorAll('.nav-mobile a').forEach(a => {
    a.addEventListener('click', () => mobile.classList.remove('open'));
  });
})();


// ── Scroll-reveal animation ───────────────────────────────────────────────
(function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger cards within same parent
        const siblings = entry.target.parentElement.querySelectorAll('[data-reveal]');
        let delay = 0;
        siblings.forEach((s, idx) => { if (s === entry.target) delay = idx * 120; });
        setTimeout(() => entry.target.classList.add('visible'), delay);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
})();


// ── Kaprekar live demo counter ────────────────────────────────────────────
(function initKaprekar() {
  // Animated number counting for the numbers-grid
  const nums = document.querySelectorAll('.num-val');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const el   = entry.target;
      const text = el.textContent;
      // Only animate if it's a plain number (no letters/symbols)
      const num  = parseFloat(text.replace(/,/g, ''));
      if (isNaN(num) || text.includes('B') || text.includes('s')) return;

      let start = 0, duration = 1400, startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const ease     = 1 - Math.pow(1 - progress, 3);
        const current  = start + (num - start) * ease;
        el.textContent = text.includes('%')
          ? current.toFixed(3) + '%'
          : text.includes(',')
            ? Math.round(current).toLocaleString()
            : current.toFixed(3);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = text;
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });

  nums.forEach(el => io.observe(el));
})();


// ── Smooth anchor scrolling with nav offset ───────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});


// ── Shield SVG pulse animation (JS-enhanced) ─────────────────────────────
(function initShieldPulse() {
  const nodes = document.querySelectorAll('.shield-svg .node');
  nodes.forEach((node, i) => {
    let t = i * (Math.PI * 2 / nodes.length);
    function pulse() {
      t += 0.02;
      const opacity = (Math.sin(t) + 1) * 0.35 + 0.3;
      node.style.opacity = opacity;
      requestAnimationFrame(pulse);
    }
    requestAnimationFrame(pulse);
  });
})();
