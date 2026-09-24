// Shared page chrome: header navigation and footer.
//
// To add a new page to the menu:
//   1. create `my-page.html` (copy an existing page as a starting point),
//   2. give its <body> a `data-page="my-page"` attribute,
//   3. add an entry to PAGES below.
import { icon } from './icons.js';

export const SITE_NAME = 'Depart Karl';

export const PAGES = [
  { id: 'puzzle', label: 'Puzzle', href: 'index.html' },
  { id: 'custom-puzzle', label: 'Custom Puzzle', href: 'custom-puzzle.html' },
  { id: 'sudoku', label: 'Sudoku', href: 'sudoku.html' },
  { id: 'messages', label: 'Messages', href: 'messages.html' },
];

function renderHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const current = document.body.dataset.page;

  header.innerHTML = `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="header-inner">
      <a class="brand" href="index.html">${SITE_NAME}</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
        ${icon('menu')}
      </button>
      <nav id="site-nav" class="site-nav" aria-label="Main">
        ${PAGES.map((p) => `<a href="${p.href}"${p.id === current ? ' aria-current="page"' : ''}>${p.label}</a>`).join('')}
      </nav>
    </div>`;

  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.site-nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
}

function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  footer.innerHTML = `<span>© ${new Date().getFullYear()} ${SITE_NAME}</span> · <a href="admin.html">Admin</a>`;
}

renderHeader();
renderFooter();
