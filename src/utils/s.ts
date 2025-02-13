import { Settings } from '@src/utils/config';

const menuItems = document.querySelectorAll<HTMLLIElement>('#menu li');
const sections = document.querySelectorAll<HTMLDivElement>('.content-section');
const Confirm = document.getElementById('confirm') as HTMLButtonElement;

function switchSection(event: MouseEvent) {
  const target = event.currentTarget as HTMLLIElement;
  const sectionId = target.getAttribute('data-section');

  menuItems.forEach((item) => item.classList.remove('bg-gray-700'));
  sections.forEach((section) => section.classList.add('hidden'));

  target.classList.add('bg-gray-700');
  const activeSection = document.getElementById(sectionId!);
  if (activeSection) activeSection.classList.remove('hidden');
}

menuItems.forEach((item) => item.addEventListener('click', switchSection));

document.addEventListener('DOMContentLoaded', () => {
  const dropdownButtons = document.querySelectorAll('[id$="button"]');

  dropdownButtons.forEach(async (button) => {
    const text = button.querySelector('span');
    const dropdownId = button.id.replace('button', '');
    const dropdown = document.getElementById(dropdownId) as HTMLElement;

    if (!dropdown) {
      console.error(`Dropdown not found for button: ${button.id}`);
      return;
    }

    let currentSetting = '';
    const settingMapping: Record<string, Record<string, string>> = {
      ptype: {
        uv: 'Ultraviolet (Default)',
        default: 'Scramjet',
      },
      engine: {
        'https://www.google.com/search?q=': 'Google',
        'https://duckduckgo.com/?q=': 'DuckDuckGo (Default)',
      },
    };

    if (dropdown.id === 'ptype') {
      currentSetting = await Settings.get('backend');
      currentSetting =
        settingMapping.ptype[currentSetting] || settingMapping.ptype.default;
    } else if (dropdown.id === 'engine') {
      currentSetting = await Settings.get('engine');
      currentSetting =
        settingMapping.engine[currentSetting] || 'Unknown Engine';
    }

    if (text && currentSetting) {
      text.textContent = currentSetting;
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.dropdown').forEach((el) => {
        if (el !== dropdown) el.classList.add('hidden');
      });

      dropdown.classList.toggle('hidden');
      console.log('Dropdown toggled');
    });
    const options = dropdown.querySelectorAll('button');
    options.forEach((option) => {
      option.addEventListener('click', async (event) => {
        const selectedOption =
          (event.currentTarget as HTMLElement)?.textContent || '';
        console.log('Selected option:', selectedOption);

        if (dropdown.id === 'ptype') {
          await Settings.edit('backend', option.id);
        } else if (dropdown.id === 'engine') {
          await Settings.edit('engine', option.id);
        }

        text!.textContent = selectedOption;
        dropdown.classList.add('hidden');
      });
    });
  });

  document.addEventListener('click', (event) => {
    dropdownButtons.forEach((button) => {
      const dropdownId = button.id.replace('button', '');
      const dropdown = document.getElementById(dropdownId) as HTMLElement;
      if (dropdown && !dropdown.classList.contains('hidden')) {
        const isClickInside =
          button.contains(event.target as Node) ||
          dropdown.contains(event.target as Node);
        if (!isClickInside) {
          dropdown.classList.add('hidden');
        }
      }
    });
  });
});

Confirm.addEventListener('click', async () => {
  const currentSetting = await Settings.get('PreventClosing');
  await Settings.edit('PreventClosing', !currentSetting);
  console.log('toggled to', !currentSetting);
});
