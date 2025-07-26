document.addEventListener('DOMContentLoaded', () => {
  const search = document.querySelector('[data-input]') as HTMLInputElement;
  const container = document.querySelector('[data-container]') as HTMLDivElement;
  const random = document.querySelector('[data-random]') as HTMLButtonElement;
  const cards = container?.querySelectorAll('.card') ?? [];

  if (!search || !container || !random) return;

  random.addEventListener('click', () => {
    const assetCards = Array.from(cards).filter(card => {
      return (card as HTMLElement).style.display !== 'none';
    });

    if (assetCards.length === 0) return; // this should NOT happen

    const randomCard = assetCards[Math.floor(Math.random() * assetCards.length)];
    randomCard.dispatchEvent(new Event('click'));
  });

  search.addEventListener('input', () => {
    const query = search.value.toLowerCase().trim();

    cards.forEach(card => {
      const name = (card.querySelector('h2')?.textContent ?? '').toLowerCase();
      const desc = (card.querySelector('p')?.textContent ?? '').toLowerCase();

      if (name.includes(query) || desc.includes(query)) {
        (card as HTMLElement).style.display = '';
      } else {
        (card as HTMLElement).style.display = 'none';
      }
    });
  });

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const assetUrl = card.getAttribute('data-href');
      console.log('card was clicked', assetUrl);
      // todo: implement the game => p0xxy
    });
  });
});
