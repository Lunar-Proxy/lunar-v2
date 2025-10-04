import { Search, createIcons } from 'lucide';
import ConfigAPI from './config';

const input = document.querySelector('input[type="text"]') as HTMLInputElement;

function showSuggestions(value: string) {
  let existingBox = document.getElementById('suggestion-box');
  if (existingBox) existingBox.remove();

  if (value) {
    fetch(`/api/query?q=${encodeURIComponent(value)}`)
      .then(response => response.json())
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          const box = document.createElement('div');
          box.id = 'suggestion-box';
          box.className =
            'font-inherit absolute z-[1000] rounded-2xl border-2 border-border-default bg-background-overlay px-0 py-1 shadow-xl backdrop-blur-md';

          const inputRect = input.getBoundingClientRect();
          box.style.left = `${inputRect.left + window.scrollX + 16}px`;
          box.style.top = `${inputRect.bottom + window.scrollY - 2}px`;
          box.style.width = `${inputRect.width - 32}px`;
          data.forEach((item: { phrase: string }) => {
            const suggestion = document.createElement('div');
            suggestion.className =
              'px-4 py-2 cursor-pointer font-linux text-text-header bg-transparent hover:bg-gray-100/10 hover:rounded-lg flex items-center gap-3 first:rounded-t-2xl last:rounded-b-2xl';

            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'search');
            icon.className = 'h-4 w-4 text-text-header';

            const textSpan = document.createElement('span');
            textSpan.textContent = item.phrase;

            suggestion.appendChild(icon);
            suggestion.appendChild(textSpan);
            suggestion.addEventListener('mousedown', () => {
              input.value = item.phrase;
              box.remove();
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            });

            box.appendChild(suggestion);
          });

          document.body.appendChild(box);

          createIcons({ icons: { Search } });
        }
      })
      .catch(error => {
        console.error('Error fetching suggestions:', error);
      });
  }
}

input?.addEventListener('input', event => {
  const value = (event.target as HTMLInputElement).value;
  showSuggestions(value);
});

input.addEventListener('keydown', async event => {
  if (event.key === 'Enter' && input.value.trim() !== '') {
    const box = document.getElementById('suggestion-box');
    if (box) {
      box.remove();
    }
    const query = encodeURIComponent(
      (await ConfigAPI.get('engine')) + encodeURI(input.value.trim()),
    );
    localStorage.setItem('last', query);
    window.location.href = `/tab`;
  }
});
input?.addEventListener('focus', () => {
  const value = input.value;
  if (value) {
    showSuggestions(value);
  }
});

document.addEventListener('click', e => {
  const box = document.getElementById('suggestion-box');
  if (box && !box.contains(e.target as Node) && e.target !== input) {
    box.remove();
  }
});
