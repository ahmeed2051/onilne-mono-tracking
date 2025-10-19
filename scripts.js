const scrollButtons = document.querySelectorAll('[data-scroll]');
scrollButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.scroll;
    const section = document.getElementById(targetId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const navToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  navLinks?.classList.toggle('nav-open', !expanded);
});

navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    if (!navToggle) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('nav-open');
  });
});

const contactForm = document.querySelector('.contact-form');
const formStatus = document.querySelector('.form-status');

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!formStatus) return;
  formStatus.hidden = false;
  formStatus.textContent = "Thanks! We'll be in touch soon.";
  contactForm.reset();
  window.setTimeout(() => {
    formStatus.hidden = true;
  }, 3500);
});

document.getElementById('year').textContent = new Date().getFullYear();
