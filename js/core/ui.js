// In-page replacements for the browser's alert() and confirm() pop-ups.

let toastRegion = null;

/** Show a short message at the bottom of the screen. type: 'info' | 'success' | 'error' */
export function toast(message, type = 'info', duration = 4000) {
  if (!toastRegion) {
    toastRegion = document.createElement('div');
    toastRegion.className = 'toast-region';
    toastRegion.setAttribute('role', 'status');
    toastRegion.setAttribute('aria-live', 'polite');
    document.body.append(toastRegion);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  toastRegion.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/**
 * Ask the user to confirm an action. Resolves to true if they confirm.
 *   if (await confirmDialog({ title: 'Delete photo?', message: '…', confirmLabel: 'Delete', danger: true })) …
 */
export function confirmDialog({ title, message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.innerHTML = `
      <form method="dialog" class="modal-body">
        <h2></h2>
        <p class="muted"></p>
        <div class="modal-actions">
          <button class="btn" value="cancel"></button>
          <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" value="confirm"></button>
        </div>
      </form>`;
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('p').textContent = message;
    const [cancelBtn, confirmBtn] = dialog.querySelectorAll('button');
    cancelBtn.textContent = cancelLabel;
    confirmBtn.textContent = confirmLabel;

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
    // For destructive actions, start on "Cancel" so Enter doesn't delete by accident.
    (danger ? cancelBtn : confirmBtn).focus();
  });
}

/** Markup for an inline loading indicator. */
export function loadingHtml(text = 'Loading…') {
  return `<div class="loading"><span class="spinner" aria-hidden="true"></span><span>${text}</span></div>`;
}
