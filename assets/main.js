/* =========================================================
   RaceUp · Pépite Grand Est — main.js
   ---------------------------------------------------------
   Version optimisée :
   - Scroll natif (Locomotive Scroll retiré : c'est de loin la
     plus grosse cause de jank sur ce type de page).
   - IntersectionObserver pour les reveals (CSS uniquement,
     0 boucle GSAP par section).
   - rAF curseur en mode "sleep" quand la souris est immobile.
   - Event delegation pour les hover du curseur.
========================================================= */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------------------
     1. CURSEUR CUSTOM — rAF intelligent, event delegation
  --------------------------------------------------------- */
  if (isFinePointer && !prefersReducedMotion) {
    const cursor = document.querySelector('.cursor');
    const dot = document.querySelector('.cursor-dot');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let curX = mouseX, curY = mouseY;
    let dotX = mouseX, dotY = mouseY;
    let rafId = null;
    let lastMove = 0;

    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMove = performance.now();
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };

    function tick() {
      curX += (mouseX - curX) * 0.18;
      curY += (mouseY - curY) * 0.18;
      dotX += (mouseX - dotX) * 0.65;
      dotY += (mouseY - dotY) * 0.65;

      cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`;
      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;

      const dx = Math.abs(mouseX - curX);
      const dy = Math.abs(mouseY - curY);
      const idleFor = performance.now() - lastMove;

      // On éteint la boucle dès que tout est stable depuis 200 ms
      if (dx < 0.1 && dy < 0.1 && idleFor > 200) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', onMove, { passive: true });

    // Event delegation : un seul listener à la racine
    const isHoverable = (el) => {
      if (!el || el === document) return false;
      return el.matches('a, button, [data-cursor]') || el.closest('a, button, [data-cursor]');
    };
    document.addEventListener('mouseover', (e) => {
      if (isHoverable(e.target)) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (isHoverable(e.target) && !isHoverable(e.relatedTarget)) {
        cursor.classList.remove('is-hover');
      }
    });

    document.addEventListener('mousedown', () => cursor.classList.add('is-click'));
    document.addEventListener('mouseup', () => cursor.classList.remove('is-click'));

    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = 0;
      dot.style.opacity = 0;
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = 1;
      dot.style.opacity = 1;
    });
  }

  /* ---------------------------------------------------------
     2. SPLITTING.JS — index custom pour animations CSS
  --------------------------------------------------------- */
  if (typeof window.Splitting !== 'undefined') {
    const splits = Splitting({ target: '.split', by: 'chars' });
    splits.forEach((s) => {
      if (s.chars) {
        s.chars.forEach((c, i) => c.style.setProperty('--char-index', i));
      }
    });
  }

  /* ---------------------------------------------------------
     3. REVEALS — IntersectionObserver natif
  --------------------------------------------------------- */
  if (prefersReducedMotion) {
    document.querySelectorAll(
      '.fade-up, .fade-in, .fade-x, .line-reveal, .scale-x-line, .split'
    ).forEach((el) => el.classList.add('is-visible'));
    document.querySelectorAll('[data-counter]').forEach((el) => {
      el.textContent = el.dataset.target;
    });
  } else {
    // Le hero démarre immédiatement
    document.querySelectorAll('.hero .fade-up, .hero .fade-in, .hero .split')
      .forEach((el) => {
        // léger délai pour laisser le splitting indexer
        requestAnimationFrame(() => el.classList.add('is-visible'));
      });

    // Les autres sections : IntersectionObserver
    const targets = document.querySelectorAll(
      '.section .fade-up, .section .fade-in, .section .fade-x, ' +
      '.section .line-reveal, .section .scale-x-line, .section .split, ' +
      '.thanks'
    );

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      }, {
        rootMargin: '0px 0px -10% 0px',
        threshold: 0
      });
      targets.forEach((el) => io.observe(el));

      // Filet de sécurité : si un élément reste caché 4 s après l'arrivée
      // dans le viewport (rare mais possible sur certains layouts inline),
      // on force le reveal pour éviter tout contenu invisible.
      setTimeout(() => {
        targets.forEach((el) => {
          if (!el.classList.contains('is-visible')) {
            const r = el.getBoundingClientRect();
            const inView = r.top < window.innerHeight && r.bottom > 0;
            if (inView) {
              el.classList.add('is-visible');
              io.unobserve(el);
            }
          }
        });
      }, 4000);
    } else {
      // Fallback navigateurs très anciens
      targets.forEach((el) => el.classList.add('is-visible'));
    }

    // Dernier filet : sur scroll, tout élément déjà passé à l'écran et
    // toujours non-révélé est forcé visible.
    let scrollSafetyTicking = false;
    const safetyOnScroll = () => {
      if (scrollSafetyTicking) return;
      scrollSafetyTicking = true;
      requestAnimationFrame(() => {
        targets.forEach((el) => {
          if (!el.classList.contains('is-visible')) {
            const r = el.getBoundingClientRect();
            if (r.top < window.innerHeight * 0.95) {
              el.classList.add('is-visible');
            }
          }
        });
        scrollSafetyTicking = false;
      });
    };
    window.addEventListener('scroll', safetyOnScroll, { passive: true });
  }

  /* ---------------------------------------------------------
     4. COUNTERS — animation au premier viewport
  --------------------------------------------------------- */
  const animateCounter = (el) => {
    const target = parseInt(el.dataset.target, 10) || 0;
    const duration = 1500;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.floor(target * eased);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    };
    requestAnimationFrame(tick);
  };

  if (!prefersReducedMotion) {
    const counters = document.querySelectorAll('[data-counter]');
    if ('IntersectionObserver' in window) {
      const cio = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            cio.unobserve(entry.target);
          }
        }
      }, { threshold: 0.4 });
      counters.forEach((el) => cio.observe(el));
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* ---------------------------------------------------------
     5. NAV — léger fond plein quand on scroll
  --------------------------------------------------------- */
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = -1;
    let ticking = false;
    const updateNav = () => {
      const y = window.scrollY;
      if (y > 20 !== nav.classList.contains('is-scrolled')) {
        nav.classList.toggle('is-scrolled', y > 20);
      }
      lastY = y;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNav);
        ticking = true;
      }
    }, { passive: true });
    updateNav();
  }

})();
