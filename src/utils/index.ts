// :3
import { Search } from '../utils/search';
const form = document.getElementById('fm') as HTMLFormElement | null;
const input = document.getElementById('inp') as HTMLInputElement | null;
const search = document.getElementById('sbtn') as HTMLButtonElement | null;
if (form && input) {
  input.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    let url = Search(value);
    localStorage.setItem('@lunar/search', `/p/${UltraConfig.encodeUrl(url)}`);
    console.log('the url is:', url);
   window.location.href = `/browse`;
  });
} else {
  throw new Error('Form or input is not found.');
}

search?.addEventListener('click', (event) => {
  event.preventDefault();
  form?.dispatchEvent(new Event('submit'));
});
