import { icons as lucideIcons } from 'lucide';

export const shadow = document.body.attachShadow({ mode: 'open' });

const style = document.createElement('style');
shadow.appendChild(style);

export const app = document.createElement('div');
app.style.cssText = 'position:fixed;inset:0;z-index:10;overflow:auto;';
shadow.appendChild(app);

let onReady: () => void;
export const ready = new Promise<void>(r => {
  onReady = r;
});

export function replaceIcons(root: ParentNode = app) {
  root.querySelectorAll('[data-lucide]').forEach(el => {
    const name = el.getAttribute('data-lucide');
    if (!name) return;
    const key = name.replace(/(^|[-])(\w)/g, (_a, _b, c) => c.toUpperCase());
    const iconData = (lucideIcons as Record<string, any>)[key];
    if (!iconData) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.entries({
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }).forEach(([attr, val]) => svg.setAttribute(attr, val));
    svg.setAttribute('data-lucide', name);
    el.getAttributeNames().forEach(attr => {
      if (attr !== 'data-lucide') svg.setAttribute(attr, el.getAttribute(attr)!);
    });
    for (const [tag, attrs] of iconData) {
      const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([k, v]) => child.setAttribute(k, v));
      svg.appendChild(child);
    }
    el.parentNode?.replaceChild(svg, el);
  });
}

fetch('/welcome')
  .then(r => r.text())
  .then(html => {
    const css = Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules)
            .filter(rule => !(rule instanceof CSSImportRule))
            .map(rule => rule.cssText);
        } catch {
          return [];
        }
      })
      .join('\n');

    style.textContent = css;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const scripts: HTMLScriptElement[] = [];

    doc.head.querySelectorAll('style').forEach(s => {
      style.textContent += '\n' + s.textContent;
    });
    doc.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = link.getAttribute('href') || '';
      shadow.insertBefore(l, style.nextSibling);
    });

    doc.body.childNodes.forEach(node => {
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === 'SCRIPT') {
        const script = document.createElement('script');
        const scriptEl = el as HTMLScriptElement;
        const origType = scriptEl.type;
        if (origType) script.type = origType;
        if (scriptEl.src) script.src = scriptEl.src;
        else script.textContent = el.textContent;
        scripts.push(script);
      } else if (tag === 'META' || tag === 'LINK' || tag === 'TITLE') {
        // skip; fuck you
      } else {
        app.appendChild(document.importNode(node, true));
      }
    });

    scripts.forEach(script => app.appendChild(script));

    replaceIcons();
    app.classList.add('loaded');
    onReady();
  });
