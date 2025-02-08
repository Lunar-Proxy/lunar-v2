import { launch2 } from '@src/utils/frame.ts';

export type Asset = {
  name: string;
  link: { name: string; url: string }[] | string;
  image: string;
  error: boolean | string;
};

const input = document.getElementById('input') as HTMLInputElement | null;
const buttons = document.querySelectorAll<HTMLButtonElement>("[id='data-2']");

if (input) {
  input.addEventListener('input', () => {
    const searchTerm = input.value.toLowerCase();
    buttons.forEach((button) => {
      const json = button.getAttribute('data-json');
      if (json) {
        try {
          const asset: Asset = JSON.parse(json);
          if (asset.name.toLowerCase().includes(searchTerm)) {
            button.classList.remove('hidden');
          } else {
            button.classList.add('hidden');
          }
        } catch (error) {
          console.error('Failed to parse JSON:', error);
        }
      }
    });
  });
}
buttons.forEach((button) => {
  button.addEventListener('click', async () => {
    const json = button.getAttribute('data-json');
    if (json) {
      try {
        const asset: Asset = JSON.parse(json);
        if (asset.error) {
          alert(asset.error);
          return;
        }
        if (Array.isArray(asset.link)) {
          const choice = prompt(
            `Please choose a link by entering a number:\n${asset.link
              .map((item, index) => `${index + 1}. ${item.name}`)
              .join('\n')}`
          );

          if (choice) {
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < asset.link.length) {
              launch2(asset.link[index].url);
            } else {
              alert('Invalid choice.');
            }
          } else {
            alert('No choice made.');
          }
        } else {
          launch2(asset.link as string);
        }
      } catch (error) {
        console.error('Failed to parse JSON:', error);
      }
    }
  });
});
