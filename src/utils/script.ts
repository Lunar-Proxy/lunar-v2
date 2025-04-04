const frameNavigator = document.getElementById('frame') as HTMLIFrameElement;
const Navigation = [
  { btn: 'Home', url: './welcome' },
  { btn: 'Search', url: './browse' },
  { btn: 'Games', url: './gm' },
  { btn: 'Apps', url: './ap' },
  { btn: 'Settings', url: './st' },
];

Navigation.forEach(({ btn, url }) => {
  const button =
    Array.from(document.querySelectorAll('span'))
      .find((el) => el.textContent?.trim() === btn)
      ?.previousElementSibling?.querySelector('button') || null;

  if (button) {
    button!.addEventListener('click', () => {
      if (frameNavigator) {
        frameNavigator.src = url;
      }
    });
  }
});
