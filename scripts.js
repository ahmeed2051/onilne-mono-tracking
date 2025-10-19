const scrollButtons = document.querySelectorAll('[data-scroll]');
scrollButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.scroll;
    const section = document.getElementById(targetId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.getElementById('year').textContent = new Date().getFullYear();
