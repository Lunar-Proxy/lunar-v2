import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import http from 'http';
import { execSync } from 'child_process';
import fs from 'node:fs';

const ROUTES = ['/', '/math', '/new', '/st', '/welcome'];
const OUT_DIR = './dist/static';
const CLIENT_DIR = './dist/client';
const COPY_FILES = ['sw.js', 'robots.txt', 'favicon.ico'];
const COPY_DIRS = ['tmp', 'lc', 'ep', 'data', 'bm', 'a', '_astro'];
const wisp = 'wss://lunaron.top/w/'; // change to wtv to change wisp server

if (!fs.existsSync('dist')) {
console.log('Building...\n');
execSync('pnpm build --static --wisp ' + wisp, { stdio: 'inherit' });
}


console.log('\nBuild complete, generating pages...\n');

const { handler } = await import('./dist/server/entry.mjs');
const server = http.createServer(handler);

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
console.log(`Server on port ${port}, generating pages...\n`);
mkdirSync(OUT_DIR, { recursive: true });

function fetchPage(route) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: route }, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

function copyClientAssets() {
  if (!fs.existsSync(CLIENT_DIR)) {
    console.warn(`! ${CLIENT_DIR} not found, skipping asset copy`);
    return;
  }

  for (const file of COPY_FILES) {
    const src = join(CLIENT_DIR, file);
    const dest = join(OUT_DIR, file);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, dest, { force: true });
    console.log(`✓ asset file copied: ${dest}`);
  }

  for (const dir of COPY_DIRS) {
    const src = join(CLIENT_DIR, dir);
    const dest = join(OUT_DIR, dir);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`✓ asset dir copied: ${dest}`);
  }
}

function patchStaticJsUrls() {
  const astroDir = join(OUT_DIR, '_astro');
  if (!fs.existsSync(astroDir)) return;

  const prefixes = [
    '/_astro/',
    '/bm/',
    '/tmp/',
    '/data/',
    '/lc/',
    '/ep/',
    '/a/',
    '/sw.js',
    '/robots.txt',
    '/favicon.ico',
    '/welcome',
    '/new',
    '/st',
    '/math',
  ];

  const files = fs.readdirSync(astroDir).filter(name => name.endsWith('.js'));
  for (const file of files) {
    const filePath = join(astroDir, file);
    let code = readFileSync(filePath, 'utf-8');
    let next = code.replace(/fetch\((['"])\/welcome\1\)/g, 'fetch("./welcome.html")');
    next = next.replace(
      /fetch\((['"])\.\/welcome\.html\1\)\.then\(s=>s\.text\(\)\)/g,
      'Promise.resolve(window.__WELCOME_HTML__||"")'
    );

    for (const prefix of prefixes) {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      next = next.replace(new RegExp(`(["'])${escaped}`, 'g'), `$1.${prefix}`);
    }

    if (next !== code) {
      writeFileSync(filePath, next, 'utf-8');
    }
  }
}

function normalizeWelcomeForShadow(html) {
  if (!html) return html;

  const outerHead = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const outerBodyAttrs = html.match(/<body([^>]*)>/i)?.[1] || '';

  const innerHtmlMatch = html.match(/<html[^>]*>[\s\S]*?<\/html>/i);
  let innerHead = '';
  let innerBody = '';
  let trailingScripts = '';

  if (innerHtmlMatch) {
    const inner = innerHtmlMatch[0];
    innerHead = inner.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    innerBody = inner.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';

    const tail = html.slice(html.indexOf(inner) + inner.length);
    trailingScripts = Array.from(tail.matchAll(/<script\b[\s\S]*?<\/script>/gi))
      .map(m => m[0])
      .join('');
  }

  let head = `${outerHead}\n${innerHead}`;
  head = head.replace(/<script\b[^>]*type=("|')module\1[^>]*src=("|')[^"']*\/page\.[^"']*\2[^>]*><\/script>/gi, '');
  head = rewriteLocalLinks(head);
  const body = rewriteLocalLinks(`${innerBody}${trailingScripts}`);

  return `<!DOCTYPE html><html><head>${head}</head><body${outerBodyAttrs}>${body}</body></html>`;
}

function normalizeXml(html) {
  let out = html;
  out = out.replace(/&copy;/g, '&#169;');
  out = out.replace(/&nbsp;/g, '&#160;');
  out = out.replace(
    /\sdata-astro[\w-]*(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,
    ''
  );
  out = out.replace(/\s(async|defer|crossorigin|nomodule)(?=[\s>])/gi, (_, attr) => {
    return ` ${attr}="${attr}"`;
  });
  out = out.replace(
    /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^<>]*?)?>/gi,
    (match, tag, attrs = '') => {
      return /\/>$/.test(match) ? match : `<${tag}${attrs || ''} />`;
    }
  );
  out = out.replace(
    /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,
    '&amp;'
  );
  return out;
}

function toLocalUrl(url) {
  if (!url) return url;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url) || url.startsWith('//')) return url;
  if (url.startsWith('/')) return `./${url.slice(1)}`;
  return url;
}

function rewriteLocalLinks(html) {
  return html.replace(/\b(src|href)=("([^"]*)"|'([^']*)')/gi, (_, attr, whole, d, s) => {
    const quote = whole[0];
    const raw = d ?? s ?? '';
    return `${attr}=${quote}${toLocalUrl(raw)}${quote}`;
  });
}

function rewriteModuleScripts(html) {
  return html.replace(
    /<script\b([^>]*?)type=("|')module\2([^>]*?)>\s*<\/script>/gi,
    (full, pre, _q, post) => {
      const attrs = `${pre} ${post}`;
      const srcMatch = attrs.match(/\bsrc=("|')([^"']+)\1/i);
      if (!srcMatch) return '';
      const src = toLocalUrl(srcMatch[2]);
      if (/\/_astro\/page\./.test(src)) return '';
      return `<script><![CDATA[(function(){var done=false;var ready=function(){return !!(document.body&&typeof document.body.attachShadow==="function");};var run=function(){if(done||!ready())return;done=true;import(${JSON.stringify(src)}).catch(function(e){console.error(e);});};if(ready()){run();return;}var tick=function(){if(ready()){run();}else{setTimeout(tick,25);}};window.addEventListener("load",run,{once:true});setTimeout(tick,0);})();]]></script>`;
    }
  );
}

function generateStaticSvg() {
  const indexPath = join(OUT_DIR, 'index.html');
  const welcomePath = join(OUT_DIR, 'welcome.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`! ${indexPath} not found, skipping static.svg generation`);
    return;
  }

  const html = readFileSync(indexPath, 'utf-8');
  const welcomeHtml = fs.existsSync(welcomePath)
    ? normalizeWelcomeForShadow(readFileSync(welcomePath, 'utf-8'))
    : '';
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (!headMatch || !bodyMatch) {
    console.warn('! Could not parse <head>/<body>, skipping static.svg generation');
    return;
  }

  const headNodes = [];
  for (const match of headMatch[1].matchAll(
    /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<link\b[^>]*>/gi
  )) {
    headNodes.push(match[0]);
  }

  const headAssets = headNodes.filter(node => !/^\s*<script\b/i.test(node));
  const headScripts = headNodes.filter(node => /^\s*<script\b/i.test(node));

  const bodyAttrs = normalizeXml(rewriteLocalLinks(bodyMatch[1] || '')).trim();
  const bodyInner = normalizeXml(rewriteLocalLinks(bodyMatch[2] || ''));
  const bodyAttrChunk = bodyAttrs ? ` ${bodyAttrs}` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position: fixed; top: 0; left: 0;">
  <style><![CDATA[
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background: transparent;
    }
  ]]></style>
  <foreignObject x="0" y="0" width="100%" height="100%">
    <body xmlns="http://www.w3.org/1999/xhtml"${bodyAttrChunk}>
      <script><![CDATA[(function() {
  var ns = "http://www.w3.org/1999/xhtml";
  var pageMap = {
    "/": "./index.html",
    "/welcome": "./welcome.html",
    "/new": "./new.html",
    "/st": "./st.html",
    "/math": "./math.html"
  };
  var embeddedWelcomeHtml = ${JSON.stringify(welcomeHtml)};
  window.__WELCOME_HTML__ = embeddedWelcomeHtml;
  var isWelcomePath = function(pathname) {
    return !!pathname && (pathname.endsWith('/welcome') || pathname.endsWith('/welcome.html'));
  };
  var basePath = "/";
  try {
    var currentPath = (window.location && window.location.pathname) || "/";
    basePath = currentPath.slice(0, currentPath.lastIndexOf("/") + 1) || "/";
  } catch (_) {}
  var withBase = function(pathname) {
    var clean = String(pathname || "");
    while (clean.charAt(0) === "/") clean = clean.slice(1);
    return basePath + clean;
  };
  var toStaticUrl = function(input) {
    if (!input) return input;
    var raw = String(input);
    var lower = raw.toLowerCase();
    if (
      raw.charAt(0) === "#" ||
      lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("ws://") ||
      lower.startsWith("wss://") ||
      lower.startsWith("data:") ||
      lower.startsWith("blob:") ||
      lower.startsWith("javascript:") ||
      lower.startsWith("file:")
    ) {
      return raw;
    }

    try {
      var parsed = new URL(raw, window.location.href);
      var isAbsoluteHttp = lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//");
      if (isAbsoluteHttp) {
        if (parsed.origin !== window.location.origin) return raw;
        if (parsed.pathname && parsed.pathname.startsWith(basePath)) return raw;
        if (parsed.pathname && parsed.pathname.startsWith('/')) {
          var mappedAbsPath = pageMap[parsed.pathname]
            ? withBase(pageMap[parsed.pathname])
            : withBase(parsed.pathname);
          return parsed.origin + mappedAbsPath + (parsed.search || "") + (parsed.hash || "");
        }
      }
    } catch (_) {}

    if (!raw.startsWith('/')) return raw;
    var hashIndex = raw.indexOf('#');
    var searchIndex = raw.indexOf('?');
    var cut = raw.length;
    if (searchIndex !== -1 && searchIndex < cut) cut = searchIndex;
    if (hashIndex !== -1 && hashIndex < cut) cut = hashIndex;
    var pathname = raw.slice(0, cut);
    var suffix = raw.slice(cut);
    var mapped = pageMap[pathname]
      ? withBase(pageMap[pathname])
      : withBase(pathname);
    return mapped + suffix;
  };

  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    var getRequestPath = function(resource) {
      try {
        var raw = typeof resource === "string" ? resource : resource && resource.url ? resource.url : "";
        if (!raw) return "";
        var mapped = toStaticUrl(raw);
        return new URL(mapped, window.location.href).pathname;
      } catch (_) {
        return "";
      }
    };
    window.fetch = function(resource, init) {
      if (embeddedWelcomeHtml && typeof Response !== "undefined") {
        var reqPath = getRequestPath(resource);
        if (isWelcomePath(reqPath)) {
          return Promise.resolve(
            new Response(embeddedWelcomeHtml, {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" },
            })
          );
        }
      }
      if (typeof resource === "string") {
        return origFetch(toStaticUrl(resource), init);
      }
      if (resource && typeof resource.url === "string") {
        return origFetch(new Request(toStaticUrl(resource.url), resource), init);
      }
      return origFetch(resource, init);
    };
  }

  var origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = toStaticUrl(url);
    return origXhrOpen.apply(this, args);
  };

  var origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    var n = String(name).toLowerCase();
    if (n === "src" || n === "href" || n === "action" || n === "poster") {
      value = toStaticUrl(value);
    }
    return origSetAttribute.call(this, name, value);
  };

  var patchUrlProp = function(proto, prop) {
    if (!proto) return;
    var desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || !desc.get || !desc.set) return;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: function() {
        return desc.get.call(this);
      },
      set: function(value) {
        return desc.set.call(this, toStaticUrl(value));
      }
    });
  };
  patchUrlProp(HTMLScriptElement && HTMLScriptElement.prototype, "src");
  patchUrlProp(HTMLLinkElement && HTMLLinkElement.prototype, "href");
  patchUrlProp(HTMLImageElement && HTMLImageElement.prototype, "src");
  patchUrlProp(HTMLIFrameElement && HTMLIFrameElement.prototype, "src");
  patchUrlProp(HTMLAnchorElement && HTMLAnchorElement.prototype, "href");
  patchUrlProp(HTMLFormElement && HTMLFormElement.prototype, "action");

  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    var origSwRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = function(scriptURL, options) {
      return origSwRegister(toStaticUrl(scriptURL), options);
    };
  }

  if (window.Worker) {
    var OrigWorker = window.Worker;
    window.Worker = function(url, options) {
      return new OrigWorker(toStaticUrl(url), options);
    };
    window.Worker.prototype = OrigWorker.prototype;
  }

  var origOpen = window.open;
  if (origOpen) {
    window.open = function(url, name, features) {
      return origOpen.call(window, toStaticUrl(url), name, features);
    };
  }

  var locAssign = Location.prototype.assign;
  var locReplace = Location.prototype.replace;
  Location.prototype.assign = function(url) {
    return locAssign.call(this, toStaticUrl(url));
  };
  Location.prototype.replace = function(url) {
    return locReplace.call(this, toStaticUrl(url));
  };

  var body = document.querySelector("foreignObject > body");
  if (!body) {
    body = document.querySelector("body");
  }
  if (!body) return;
  var head = document.createElementNS(ns, "head");
  body.prepend(head);
  var base = document.createElementNS(ns, "base");
  var baseHref = "./";
  try {
    baseHref = new URL(".", window.location.href).href;
  } catch (_) {}
  base.setAttribute("href", baseHref);
  head.appendChild(base);
  Object.defineProperty(document, "head", {
    get: function() {
      return head;
    },
    configurable: true
  });
  Object.defineProperty(document, "body", {
    get: function() {
      return body;
    },
    configurable: true
  });
  document.createElement = function(tag, opts) {
    return document.createElementNS(ns, tag, opts);
  };
})();]]></script>
      ${normalizeXml(rewriteLocalLinks(headAssets.join('\n      ')))}
      ${bodyInner}
      ${rewriteModuleScripts(normalizeXml(rewriteLocalLinks(headScripts.join('\n      '))))}
    </body>
  </foreignObject>
</svg>
`;

  const svgPath = join(OUT_DIR, 'static.svg');
  writeFileSync(svgPath, svg, 'utf-8');
  console.log(`✓ svg generated: ${svgPath}`);
}

for (const route of ROUTES) {
  try {
    const html = await fetchPage(route);
    if (!html || html.length < 100) {
      console.error(`✗ ${route}: empty`);
      continue;
    }
    const slug = route.replace(/^\/+|\/+$/g, '');
    const fileName = slug ? `${slug.replace(/\//g, '-')}.html` : 'index.html';
    const filePath = join(OUT_DIR, fileName);
    writeFileSync(filePath, html, 'utf-8');
    console.log(`✓ ${route} → ${filePath} (${html.length} bytes)`);
  } catch (e) {
    console.error(`✗ ${route}: ${e.message}`);
  }
}

copyClientAssets();
patchStaticJsUrls();
generateStaticSvg();

server.close();
console.log('\nDone! Serve dist/static/ with any static host.');
process.exit(0);
