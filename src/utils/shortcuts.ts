document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-short]').forEach(el => {
    el.addEventListener('click', async e => {
      const url = (el as HTMLElement).getAttribute('data-short');
      const shadowRoot = window.parent.document.body.shadowRoot;
      const input = shadowRoot?.querySelector('#urlbar') as HTMLInputElement | null;
      if (url === '/gkm') {
        e.preventDefault();
        if (!input) return;
        input.value = 'lunar://games';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        return;
      }
      if (url) {
        e.preventDefault();
        if (!input) return;
        input.value = url;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      }
    });
  });
});
