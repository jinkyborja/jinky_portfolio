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
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
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
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('lightbox--open');
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
    if (event.target === lightbox || event.target.classList.contains('lightbox__backdrop')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('lightbox--open')) {
      closeLightbox();
    }
  });
}

if (messageFab) {
  messageFab.addEventListener('click', (event) => {
    event.preventDefault();
    window.open('https://wa.me/639855162530', '_blank', 'noopener,noreferrer');
  });
}
