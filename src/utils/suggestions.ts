import { createIcons, icons } from 'lucide';

createIcons({ icons });
document.addEventListener('astro:page-load', () => createIcons({ icons }));
document.addEventListener('astro:after-swap', () => createIcons({ icons }));

const bar = document.getElementById('urlbar') as HTMLInputElement | null;

const links = {
  'lunar://settings': 'Settings',
  'lunar://new': 'New Page',
  'lunar://games': 'Games',
  'lunar://apps': 'Apps',
};

function isLunar(x: string) {
  return x.startsWith('lunar://');
}

function matchLinks(x: string) {
  const q = x.toLowerCase();
  return Object.entries(links).filter(([k]) => k.toLowerCase().includes(q));
}

async function getSuggest(q: string) {
  if (!q) return [];
  try {
    const r = await fetch(`/api/query?q=${encodeURIComponent(q)}`);
    if (!r.ok) throw 0;
    const j = await r.json();
    return Array.isArray(j.suggestions) ? j.suggestions : [];
  } catch {
    return [];
  }
}

function isMathExpr(x: string) {
  const v = x.trim();
  if (!/^[0-9+\-*/().%^√\s]+$/.test(v)) return false;
  if (/^[0-9.]+$/.test(v)) return false;
  return /[+\-*/%^√()]/.test(v);
}

function calcExpr(x: string) {
  try {
    const expr = x.replace(/√/g, 'Math.sqrt').replace(/\^/g, '**');
    const out = Function(`"use strict";return(${expr})`)();
    return typeof out === 'number' && isFinite(out) ? out.toString() : null;
  } catch {
    return null;
  }
}

function makeDrop() {
  const d = document.createElement('div');
  d.id = 'suggestions';
  d.className =
    'absolute top-full z-50 mt-0 mb-28 w-full rounded-xl border border-[#3a3758] bg-[#1f1f30]/90 shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-y-auto opacity-0 hidden';
  bar?.parentElement?.appendChild(d);
  return d;
}

function showDrop(d: HTMLDivElement) {
  d.classList.remove('opacity-0', 'hidden');
  if (!bar) return;
  const r = bar.getBoundingClientRect();
  const h = window.innerHeight - r.bottom - 12;
  d.style.maxHeight = `${h}px`;
}

function hideDrop() {
  const d = document.getElementById('suggestions');
  if (d) d.remove();
}

window.addEventListener('blur', () => {
  setTimeout(() => {
    if (document.activeElement instanceof HTMLIFrameElement) hideDrop();
  }, 0);
});

function pick(v: string) {
  if (!bar) return;
  bar.value = v;
  hideDrop();
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  bar.dispatchEvent(e);
}

function drawDrop(
  results: string[],
  lunar: [string, string][],
  math: string | null,
  query: string,
) {
  hideDrop();
  if (!bar) return;
  const max = 7;
  const list = results.slice(0, max);
  const showLunar = isLunar(query);
  if (!list.length && !lunar.length && !math) return;
  const d = makeDrop();
  const html: string[] = [];
  if (math) {
    html.push(`
      <div class="flex items-center space-x-2 px-6 py-3 text-[var(--text-header)] font-semibold cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md" data-value="${math}">
        <i data-lucide="calculator" class="h-5 w-5"></i><span>${math}</span>
      </div>
    `);
  }
  if (list.length) {
    html.push(
      `<div class="px-5 py-2 text-xs uppercase tracking-wider text-[var(--text-secondary)]">Search Results</div>`,
    );
    html.push(
      ...list.map(
        r => `
        <div class="flex items-center space-x-3 px-6 py-2 text-[var(--text-header)] cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md transition" data-value="${r}">
          <i data-lucide="search" class="h-4 w-4 text-[var(--text-secondary)]"></i><span>${r}</span>
        </div>`,
      ),
    );
  }
  if (showLunar && lunar.length) {
    html.push(
      `<div class="px-5 py-2 text-xs uppercase tracking-wider text-[var(--text-secondary)] border-t border-[var(--border)]">Lunar Links</div>`,
    );
    lunar.forEach(([k, l]) => {
      html.push(`
        <div class="flex items-center justify-between px-6 py-2 text-[var(--text-header)] cursor-pointer hover:bg-[#2a293f] hover:text-white rounded-md transition" data-value="${k}">
          <div class="flex items-center space-x-2">
            <i data-lucide="globe" class="h-5 w-5 text-purple-400"></i><span>${k}</span>
          </div>
          <span class="text-xs text-[var(--text-secondary)]">${l}</span>
        </div>
      `);
    });
  }
  d.innerHTML = html.join('');
  d.querySelectorAll<HTMLElement>('[data-value]').forEach(el =>
    el.addEventListener('click', () => pick(el.dataset.value || '')),
  );
  createIcons({ icons });
  showDrop(d);
}

async function updateDrop() {
  if (!bar) return;
  const v = bar.value.trim();
  if (!v) return hideDrop();
  const [results, math] = await Promise.all([getSuggest(v), isMathExpr(v) ? calcExpr(v) : null]);
  const lunar = isLunar(v) ? matchLinks(v) : [];
  drawDrop(results, lunar, math, v);
}

if (bar) {
  let timer: number | null = null;
  bar.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => updateDrop(), 200);
  });
  bar.addEventListener('focus', () => {
    if (bar.value.trim()) updateDrop();
  });
  bar.addEventListener('keydown', e => {
    if (e.key === 'Enter') hideDrop();
  });
}

window.addEventListener('resize', () => {
  const d = document.getElementById('suggestions') as HTMLDivElement | null;
  if (d) showDrop(d);
});

document.addEventListener('mousedown', e => {
  const t = e.target as HTMLElement;
  if (!t.closest('#urlbar') && !t.closest('#suggestions')) hideDrop();
});
