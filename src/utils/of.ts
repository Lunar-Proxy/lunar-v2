const face = new FontFace('E', "url('/f.ttf')");
Promise.all([fetch('/map.json').then(r => r.json()), face.load()]).then(
  ([map]: [Record<string, number>, FontFace]) => {
    document.fonts.add(face);
    const s = document.createElement('style');
    s.textContent =
      "*:not(#clock):not(#hours):not(#minutes):not(#seconds){font-family:'E',Outfit,sans-serif!important}h1,h2,h3,h4,h5,h6{font-family:'E',Prompt,sans-serif!important}";
    document.head.appendChild(s);
    const e: Record<string, string> = {};
    const d: Record<string, string> = {};
    for (const [ch, cp] of Object.entries(map)) {
      const encoded = String.fromCodePoint(cp);
      e[ch] = encoded;
      d[encoded] = ch;
    }
    const enc = (t: string) =>
      Array.from(t)
        .map(c => e[c] ?? c)
        .join('');
    const dec = (t: string) =>
      Array.from(t)
        .map(c => d[c] ?? c)
        .join('');
    function walk(node: Node) {
      if (node.nodeType === 3 && node.textContent?.trim()) {
        node.textContent = enc(node.textContent);
        return;
      }
      node.childNodes.forEach(walk);
    }
    walk(document.body);
    new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('copy', ev => {
      const sel = document.getSelection()?.toString();
      if (!sel) return;
      ev.preventDefault();
      ev.clipboardData?.setData('text/plain', dec(sel));
    });
  },
);
