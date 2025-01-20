// :3
const form = document.getElementById('fm') as HTMLFormElement | null;
const input = document.getElementById('inp') as HTMLInputElement | null;
const search = document.getElementById('sbtn') as HTMLButtonElement | null;
if (form && input) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim(); 
    console.log(value);
  });
} else {
  throw new Error('Form or input is not found.');
}

search?.addEventListener('click', (event) => {
    event.preventDefault();
    form?.dispatchEvent(new Event('submit')); 
})