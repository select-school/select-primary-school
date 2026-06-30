const PAGES = ['dashboard', 'ranking', 'links', 'account'];
let onPageChange = null;

export function initRouter(callback) {
  onPageChange = callback;
  window.addEventListener('hashchange', () => route());
  route();
}

export function navigateTo(hash) {
  window.location.hash = hash;
}

export function getCurrentPage() {
  const hash = window.location.hash.replace('#', '');
  return PAGES.includes(hash) ? hash : 'dashboard';
}

function route() {
  const page = getCurrentPage();

  PAGES.forEach(p => {
    const section = document.getElementById(`page-${p}`);
    if (section) section.classList.toggle('hidden', p !== page);
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    const isActive = item.dataset.page === page;
    item.classList.toggle('active', isActive);
    item.classList.toggle('bg-primary/10', isActive);
    item.classList.toggle('font-semibold', isActive);
  });

  if (onPageChange) onPageChange(page);
}
