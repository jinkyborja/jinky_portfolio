const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.getElementById('mainNav');
const navLinks = document.querySelectorAll('.main-nav a');
const messageFab = document.getElementById('messageFab');
const lightbox = document.getElementById('lightbox');

const savedTheme = localStorage.getItem('portfolio-theme')
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

if (themeToggle) {
  const iconEl = themeToggle.querySelector('.theme-toggle__icon');
  const textEl = themeToggle.querySelector('.theme-toggle__text');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    iconEl.textContent = isDark ? '☀' : '☾';
    textEl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('portfolio-theme', theme);
  }

  applyTheme(savedTheme);
  themeToggle.addEventListener('click', () => {
    const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

if (navToggle && mainNav) {
  function setNavigationOpen(isOpen) {
    mainNav.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  }

  navToggle.addEventListener('click', () => {
    setNavigationOpen(!mainNav.classList.contains('is-open'));
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      setNavigationOpen(false);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mainNav.classList.contains('is-open')) {
      setNavigationOpen(false);
      navToggle.focus();
    }
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  });
});

const sections = document.querySelectorAll('section[id]');
function updateActiveNav() {
  const scrollPosition = window.scrollY + 120;
  sections.forEach((section) => {
    const id = section.getAttribute('id');
    const link = document.querySelector(`.main-nav a[href="#${id}"]`);
    if (!link) return;

    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    if (scrollPosition >= top && scrollPosition < bottom) {
      navLinks.forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();

if (lightbox) {
  const lightboxImage = lightbox.querySelector('.lightbox__image');
  const lightboxClose = lightbox.querySelector('.lightbox__close');
  let activeTrigger = null;

  function openLightbox(trigger) {
    activeTrigger = trigger;
    lightboxImage.src = trigger.dataset.src;
    lightboxImage.alt = trigger.dataset.alt;
    lightbox.classList.add('lightbox--open');
    lightbox.classList.toggle('lightbox--overview', trigger.dataset.lightboxMode === 'overview');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('lightbox--open');
    lightbox.classList.remove('lightbox--overview');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lightboxImage.removeAttribute('src');
    if (activeTrigger) activeTrigger.focus();
  }

  document.querySelectorAll('[data-lightbox]').forEach((trigger) => {
    trigger.addEventListener('click', () => openLightbox(trigger));
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target.classList.contains('lightbox__backdrop')
      || (lightbox.classList.contains('lightbox--overview') && event.target.classList.contains('lightbox__dialog'))) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('lightbox--open')) return;

    if (event.key === 'Escape') {
      closeLightbox();
      return;
    }

    if (event.key === 'Tab') {
      const focusableElements = [...lightbox.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });

  const gallery = document.getElementById('designsViewport');
  const canvas = document.getElementById('designsCanvas');
  const galleryReset = document.getElementById('galleryReset');
  const galleryHint = document.getElementById('galleryHint');
  const galleryItems = gallery ? [...gallery.querySelectorAll('.gallery-item')] : [];

  if (gallery && canvas && galleryItems.length) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let viewX = 0;
    let viewY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let frameId = 0;
    let pointer = null;
    let lastFrameTime = 0;

    function bounds() {
      return {
        minX: Math.min(0, gallery.clientWidth - canvas.offsetWidth),
        minY: Math.min(0, gallery.clientHeight - canvas.offsetHeight)
      };
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function markInteraction() {
      gallery.classList.add('has-interaction');
      galleryHint?.classList.add('is-faded');
    }

    function render() {
      canvas.style.transform = `translate3d(${viewX}px, ${viewY}px, 0)`;
      const tilt = clamp(velocityX * 0.08 + velocityY * 0.025, -0.3, 0.3);
      canvas.style.setProperty('--drag-tilt', `${tilt}deg`);
    }

    function stopMotion() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      velocityX = 0;
      velocityY = 0;
    }

    function animateTo(destinationX, destinationY, duration = 360) {
      stopMotion();
      if (reduceMotion.matches) {
        viewX = destinationX;
        viewY = destinationY;
        render();
        return;
      }

      const stiffness = 26 / (duration * duration);
      const damping = 1.65 * Math.sqrt(stiffness);
      let springVelocityX = 0;
      let springVelocityY = 0;
      let lastTime = 0;

      function step(now) {
        const delta = Math.min(32, lastTime ? now - lastTime : 16);
        lastTime = now;
        springVelocityX += ((destinationX - viewX) * stiffness - springVelocityX * damping) * delta;
        springVelocityY += ((destinationY - viewY) * stiffness - springVelocityY * damping) * delta;
        viewX += springVelocityX * delta;
        viewY += springVelocityY * delta;
        render();
        if (Math.hypot(destinationX - viewX, destinationY - viewY) > 0.5
          || Math.hypot(springVelocityX, springVelocityY) > 0.02) {
          frameId = requestAnimationFrame(step);
        } else {
          frameId = 0;
          viewX = destinationX;
          viewY = destinationY;
          render();
        }
      }

      frameId = requestAnimationFrame(step);
    }

    function settle() {
      const limit = bounds();
      animateTo(clamp(viewX, limit.minX, 0), clamp(viewY, limit.minY, 0), reduceMotion.matches ? 1 : 300);
    }

    function updateCanvasLayout(preservePosition = true) {
      const previousBounds = bounds();
      const progressX = previousBounds.minX < 0 ? viewX / previousBounds.minX : -0.5;
      const progressY = previousBounds.minY < 0 ? viewY / previousBounds.minY : -0.5;
      const compact = gallery.clientWidth < 520;
      const baseWidth = compact
        ? clamp(gallery.clientWidth * 0.72, 168, 230)
        : clamp(gallery.clientWidth * 0.42, 230, 340);
      const margin = compact ? 28 : 44;
      const gapX = Math.round(baseWidth * (compact ? 0.17 : 0.2));
      const gapY = Math.round(baseWidth * (compact ? 0.26 : 0.3));
      const rowStep = Math.round(baseWidth * 0.77) + gapY;
      const columnStep = baseWidth + gapX;
      const sizeFactors = [1.08, 0.88, 1, 1.13, 0.94, 0.9, 1.12, 0.96, 1.06, 0.86, 1.1];
      let rightEdge = 0;
      let bottomEdge = 0;

      galleryItems.forEach((item, index) => {
        const row = Math.floor(index / 5);
        const column = index % 5;
        const factor = sizeFactors[(index * 7) % sizeFactors.length];
        const width = Math.round(baseWidth * factor);
        const jitterX = ((row * 17 + column * 23) % 29) - 14;
        const jitterY = ((row * 19 + column * 13) % 25) - 12;
        const left = margin + column * columnStep + jitterX;
        const top = margin + row * rowStep + jitterY;
        const tilt = ((index * 17) % 9) - 4;
        const image = item.querySelector('img');
        const aspectRatio = image?.naturalWidth
          ? image.naturalHeight / image.naturalWidth
          : 0.64;
        const height = width * aspectRatio;

        item.style.left = `${left}px`;
        item.style.top = `${top}px`;
        item.style.width = `${width}px`;
        item.style.setProperty('--tilt', `${tilt * 0.32}deg`);
        item.style.zIndex = String(2 + (index * 3) % 19);
        rightEdge = Math.max(rightEdge, left + width + margin);
        bottomEdge = Math.max(bottomEdge, top + height + margin);
      });

      canvas.style.width = `${rightEdge}px`;
      canvas.style.height = `${bottomEdge}px`;
      const limit = bounds();
      viewX = preservePosition ? limit.minX * progressX : limit.minX / 2;
      viewY = preservePosition ? limit.minY * progressY : limit.minY / 2;
      render();
    }

    function rubberBand(value, minimum, maximum = 0) {
      if (value > maximum) return maximum + Math.min(72, (value - maximum) * 0.28);
      if (value < minimum) return minimum - Math.min(72, (minimum - value) * 0.28);
      return value;
    }

    function startMomentum() {
      if (reduceMotion.matches) {
        settle();
        return;
      }

      lastFrameTime = 0;
      function step(now) {
        const delta = Math.min(32, lastFrameTime ? now - lastFrameTime : 16);
        lastFrameTime = now;
        const limit = bounds();
        viewX += velocityX * delta;
        viewY += velocityY * delta;
        if (viewX > 0) velocityX -= viewX * 0.004 * delta;
        else if (viewX < limit.minX) velocityX += (limit.minX - viewX) * 0.004 * delta;
        if (viewY > 0) velocityY -= viewY * 0.004 * delta;
        else if (viewY < limit.minY) velocityY += (limit.minY - viewY) * 0.004 * delta;

        const friction = Math.exp(-delta / 230);
        velocityX *= friction;
        velocityY *= friction;
        render();

        const outsideX = viewX > 0 ? viewX : Math.max(0, limit.minX - viewX);
        const outsideY = viewY > 0 ? viewY : Math.max(0, limit.minY - viewY);
        if (Math.hypot(velocityX, velocityY) > 0.015 || outsideX > 0.5 || outsideY > 0.5) {
          frameId = requestAnimationFrame(step);
        } else {
          frameId = 0;
          viewX = clamp(viewX, limit.minX, 0);
          viewY = clamp(viewY, limit.minY, 0);
          velocityX = 0;
          velocityY = 0;
          render();
        }
      }

      frameId = requestAnimationFrame(step);
    }

    gallery.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('#galleryReset')) return;
      stopMotion();
      pointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: performance.now(),
        originX: viewX,
        originY: viewY,
        velocityX: 0,
        velocityY: 0,
        moved: false
      };
      markInteraction();
      gallery.classList.add('is-dragging');
      gallery.setPointerCapture(event.pointerId);
    });

    gallery.addEventListener('pointermove', (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const deltaX = event.clientX - pointer.startX;
      const deltaY = event.clientY - pointer.startY;
      if (!pointer.moved && Math.hypot(deltaX, deltaY) > 5) pointer.moved = true;
      if (!pointer.moved) return;

      const now = performance.now();
      const elapsed = Math.max(1, now - pointer.lastTime);
      const instantX = (event.clientX - pointer.lastX) / elapsed;
      const instantY = (event.clientY - pointer.lastY) / elapsed;
      pointer.velocityX = pointer.velocityX * 0.55 + instantX * 0.45;
      pointer.velocityY = pointer.velocityY * 0.55 + instantY * 0.45;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastTime = now;

      const limit = bounds();
      viewX = rubberBand(pointer.originX + deltaX, limit.minX);
      viewY = rubberBand(pointer.originY + deltaY, limit.minY);
      velocityX = pointer.velocityX;
      velocityY = pointer.velocityY;
      render();
    });

    function finishPointer(event, cancelled = false) {
      if (!pointer || event.pointerId !== pointer.id) return;
      const completedPointer = pointer;
      pointer = null;
      gallery.classList.remove('is-dragging');
      if (gallery.hasPointerCapture(event.pointerId)) gallery.releasePointerCapture(event.pointerId);

      velocityX = completedPointer.moved ? clamp(completedPointer.velocityX, -1.6, 1.6) : 0;
      velocityY = completedPointer.moved ? clamp(completedPointer.velocityY, -1.6, 1.6) : 0;
      if (completedPointer.moved) startMomentum();
      else settle();
    }

    gallery.addEventListener('pointerup', (event) => finishPointer(event));
    gallery.addEventListener('pointercancel', (event) => finishPointer(event, true));
    gallery.addEventListener('contextmenu', (event) => {
      if (pointer?.moved) event.preventDefault();
    });

    gallery.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 150 : 90;
      let destinationX = viewX;
      let destinationY = viewY;
      const limit = bounds();
      if (event.key === 'ArrowLeft') destinationX += step;
      else if (event.key === 'ArrowRight') destinationX -= step;
      else if (event.key === 'ArrowUp') destinationY += step;
      else if (event.key === 'ArrowDown') destinationY -= step;
      else if (event.key === 'Home') {
        event.preventDefault();
        galleryReset.click();
        return;
      } else return;

      event.preventDefault();
      markInteraction();
      animateTo(clamp(destinationX, limit.minX, 0), clamp(destinationY, limit.minY, 0), reduceMotion.matches ? 1 : 180);
    });

    galleryReset.addEventListener('click', () => {
      markInteraction();
      const limit = bounds();
      animateTo(limit.minX / 2, limit.minY / 2, reduceMotion.matches ? 1 : 420);
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        stopMotion();
        updateCanvasLayout(false);
      });
      observer.observe(gallery);
    } else {
      window.addEventListener('resize', updateCanvasLayout, { passive: true });
    }

    updateCanvasLayout(false);
    galleryItems.forEach((item) => {
      const image = item.querySelector('img');
      if (image && !image.complete) image.addEventListener('load', updateCanvasLayout, { once: true });
    });
  }
}

if (messageFab) {
  messageFab.addEventListener('click', (event) => {
    event.preventDefault();
    window.open('https://wa.me/639855162530', '_blank', 'noopener,noreferrer');
  });
}
