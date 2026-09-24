// Full-screen photo viewer with previous / next, keyboard arrows and swipe.
import { icon } from './icons.js';

let lightbox = null;
let items = [];
let current = 0;

function showItem(index) {
  current = (index + items.length) % items.length;
  const item = items[current];
  const img = lightbox.querySelector('img');
  img.src = item.src;
  img.alt = item.caption;
  lightbox.querySelector('.lightbox-caption').textContent =
    items.length > 1 ? `${item.caption} · ${current + 1} of ${items.length}` : item.caption;
}

function buildLightbox() {
  lightbox = document.createElement('dialog');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('aria-label', 'Photo viewer');
  lightbox.innerHTML = `
    <div class="lightbox-stage">
      <img alt="">
      <p class="lightbox-caption"></p>
    </div>
    <button class="lightbox-btn lightbox-close" type="button" aria-label="Close">${icon('close')}</button>
    <button class="lightbox-btn lightbox-prev" type="button" aria-label="Previous photo">${icon('chevronLeft')}</button>
    <button class="lightbox-btn lightbox-next" type="button" aria-label="Next photo">${icon('chevronRight')}</button>`;

  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => showItem(current - 1));
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => showItem(current + 1));
  // Clicking the dark area around the photo closes the viewer.
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-stage')) lightbox.close();
  });
  lightbox.addEventListener('keydown', (e) => {
    if (items.length < 2) return;
    if (e.key === 'ArrowLeft') showItem(current - 1);
    if (e.key === 'ArrowRight') showItem(current + 1);
  });
  // Swipe left/right on touch screens.
  let startX = null;
  lightbox.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  lightbox.addEventListener('pointerup', (e) => {
    if (startX === null || items.length < 2) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) showItem(current + (dx < 0 ? 1 : -1));
  });
  document.body.append(lightbox);
}

/** Open the viewer. list: [{ src, caption }] */
export function openLightbox(list, startIndex = 0) {
  if (!lightbox) buildLightbox();
  items = list;
  const single = items.length < 2;
  lightbox.querySelector('.lightbox-prev').hidden = single;
  lightbox.querySelector('.lightbox-next').hidden = single;
  showItem(startIndex);
  lightbox.showModal();
}
