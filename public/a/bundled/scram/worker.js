(() => {
  'use strict';
  let e;
  class t {
    handle;
    origin;
    syncToken;
    promises;
    messageChannel;
    connected;
    constructor(e, t) {
      (this.handle = e),
        (this.origin = t),
        (this.syncToken = 0),
        (this.promises = {}),
        (this.messageChannel = new MessageChannel()),
        (this.connected = !1),
        this.messageChannel.port1.addEventListener('message', (e) => {
          'scramjet$type' in e.data &&
            ('init' === e.data.scramjet$type ? (this.connected = !0) : this.handleMessage(e.data));
        }),
        this.messageChannel.port1.start(),
        this.handle.postMessage(
          { scramjet$type: 'init', scramjet$port: this.messageChannel.port2 },
          [this.messageChannel.port2],
        );
    }
    handleMessage(e) {
      let t = this.promises[e.scramjet$token];
      t && (t(e), delete this.promises[e.scramjet$token]);
    }
    async fetch(e) {
      let t = this.syncToken++,
        n = {
          scramjet$type: 'fetch',
          scramjet$token: t,
          scramjet$request: {
            url: e.url,
            body: e.body,
            headers: Array.from(e.headers.entries()),
            method: e.method,
            mode: e.mode,
            destinitation: e.destination,
          },
        },
        r = e.body ? [e.body] : [];
      this.handle.postMessage(n, r);
      let { scramjet$response: i } = await new Promise((e) => {
        this.promises[t] = e;
      });
      return (
        !!i &&
        new Response(i.body, { headers: i.headers, status: i.status, statusText: i.statusText })
      );
    }
  }
  '$scramjet' in self ||
    (self.$scramjet = {
      version: { build: 'fd346e8', version: '1.0.2-dev' },
      codec: {},
      flagEnabled: function (e, t) {
        let r = n.config.flags[e];
        for (let r in n.config.siteFlags) {
          let i = n.config.siteFlags[r];
          if (new RegExp(r).test(t.href) && e in i) return i[e];
        }
        return r;
      },
    });
  let n = self.$scramjet,
    r = Function,
    {
      util: { BareClient: i, ScramjetHeaders: o, BareMuxConnection: s },
      url: { rewriteUrl: a, unrewriteUrl: c, rewriteBlob: l, unrewriteBlob: d },
      rewrite: {
        rewriteCss: u,
        unrewriteCss: f,
        rewriteHtml: g,
        unrewriteHtml: h,
        rewriteSrcset: b,
        rewriteJs: m,
        rewriteHeaders: p,
        rewriteWorkers: w,
        htmlRules: y,
      },
      CookieStore: _,
    } = n.shared;
  function v(e) {
    return { origin: e, base: e };
  }
  async function x(e, t) {
    try {
      let r = new URL(e.url),
        i = '';
      if (
        (r.searchParams.has('type') &&
          ((i = r.searchParams.get('type')), r.searchParams.delete('type')),
        r.searchParams.has('dest') && r.searchParams.delete('dest'),
        r.pathname === this.config.files.wasm)
      )
        return fetch(this.config.files.wasm).then(async (e) => {
          let t = await e.arrayBuffer(),
            n = btoa(
              new Uint8Array(t).reduce((e, t) => (e.push(String.fromCharCode(t)), e), []).join(''),
            ),
            r = '';
          return (
            (r += `if ('document' in self && document.currentScript) { document.currentScript.remove(); }
self.WASM = '${n}';`),
            new Response(r, { headers: { 'content-type': 'text/javascript' } })
          );
        });
      if (
        r.pathname.startsWith(this.config.prefix + 'blob:') ||
        r.pathname.startsWith(this.config.prefix + 'data:')
      ) {
        let n,
          o = r.pathname.substring(this.config.prefix.length);
        o.startsWith('blob:') && (o = d(o));
        let s = await fetch(o, {}),
          a = o.startsWith('blob:') ? o : '(data url)';
        (s.finalURL = a),
          s.body &&
            (n = await S(
              s,
              t
                ? { base: new URL(new URL(t.url).origin), origin: new URL(new URL(t.url).origin) }
                : v(new URL(c(e.referrer))),
              e.destination,
              i,
              this.cookieStore,
            ));
        let l = Object.fromEntries(s.headers.entries());
        return (
          crossOriginIsolated &&
            ((l['Cross-Origin-Opener-Policy'] = 'same-origin'),
            (l['Cross-Origin-Embedder-Policy'] = 'require-corp')),
          new Response(n, { status: s.status, statusText: s.statusText, headers: l })
        );
      }
      let s = new URL(c(r)),
        a = this.serviceWorkers.find((e) => e.origin === s.origin);
      if (a && a.connected && 'swruntime' !== r.searchParams.get('from')) {
        let t = await a.fetch(e);
        if (t) return t;
      }
      if (s.origin == new URL(e.url).origin)
        throw Error(
          'attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting',
        );
      let l = new o();
      for (let [t, n] of e.headers.entries()) l.set(t, n);
      if (t && new URL(t.url).pathname.startsWith(n.config.prefix)) {
        let e = new URL(c(t.url));
        e.toString().includes('youtube.com') ||
          (l.set('Referer', e.toString()),
          l.set('Origin', e.origin ? `${e.protocol}//${e.host}` : 'null'));
      }
      let u = this.cookieStore.getCookies(s, !1);
      u.length && l.set('Cookie', u),
        l.set('Sec-Fetch-Dest', e.destination),
        l.set('Sec-Fetch-Site', 'same-origin'),
        l.set('Sec-Fetch-Mode', 'cors' === e.mode ? e.mode : 'same-origin');
      let f = new C(s, l.headers, e.body, e.method, e.destination, t);
      this.dispatchEvent(f);
      let g =
        f.response ||
        (await this.client.fetch(f.url, {
          method: f.method,
          body: f.body,
          headers: f.requestHeaders,
          credentials: 'omit',
          mode: 'cors' === e.mode ? e.mode : 'same-origin',
          cache: e.cache,
          redirect: 'manual',
          duplex: 'half',
        }));
      return await k(s, i, e.destination, g, this.cookieStore, t, this);
    } catch (r) {
      let t = {
        message: r.message,
        url: e.url,
        destination: e.destination,
        timestamp: new Date().toISOString(),
      };
      if (
        (r.stack && (t.stack = r.stack),
        console.error('ERROR FROM SERVICE WORKER FETCH: ', t),
        !['document', 'iframe'].includes(e.destination))
      )
        return new Response(void 0, { status: 500 });
      return (function (e, t) {
        return fetch('/404', { headers: { 'content-type': 'text/html' } });
      })(
        Object.entries(t)
          .map(([e, t]) => `${e.charAt(0).toUpperCase() + e.slice(1)}: ${t}`)
          .join('\n\n'),
        c(e.url),
      );
    }
  }
  async function k(e, t, n, r, i, o, s) {
    let a;
    let c = p(r.rawHeaders, v(e)),
      l = c['set-cookie'] || [];
    for (let t in l) o && o.postMessage({ scramjet$type: 'cookie', cookie: t, url: e.href });
    for (let t in (await i.setCookies(l instanceof Array ? l : [l], e), c))
      Array.isArray(c[t]) && (c[t] = c[t][0]);
    if ((r.body && (a = await S(r, v(e), n, t, i)), ['document', 'iframe'].includes(n))) {
      let e = c['content-disposition'];
      if (!/\s*?((inline|attachment);\s*?)filename=/i.test(e)) {
        let t = /^\s*?attachment/i.test(e) ? 'attachment' : 'inline',
          [n] = new URL(r.finalURL).pathname.split('/').slice(-1);
        c['content-disposition'] = `${t}; filename=${JSON.stringify(n)}`;
      }
    }
    'text/event-stream' === c.accept && (c['content-type'] = 'text/event-stream'),
      delete c['permissions-policy'],
      crossOriginIsolated &&
        ['document', 'iframe', 'worker', 'sharedworker', 'style', 'script'].includes(n) &&
        ((c['Cross-Origin-Embedder-Policy'] = 'require-corp'),
        (c['Cross-Origin-Opener-Policy'] = 'same-origin'));
    let d = new R(a, c, r.status, r.statusText, n, e, r, o);
    return (
      s.dispatchEvent(d),
      new Response(d.responseBody, {
        headers: d.responseHeaders,
        status: d.status,
        statusText: d.statusText,
      })
    );
  }
  async function S(e, t, n, r, i) {
    switch (n) {
      case 'iframe':
      case 'document':
        if (e.headers.get('content-type')?.startsWith('text/html'))
          return g(await e.text(), i, t, !0);
        return e.body;
      case 'script':
        return m(await e.arrayBuffer(), e.finalURL, t, 'module' === r);
      case 'style':
        return u(await e.text(), t);
      case 'sharedworker':
      case 'worker':
        return w(await e.arrayBuffer(), r, e.finalURL, t);
      default:
        return e.body;
    }
  }
  n.config;
  class R extends Event {
    responseBody;
    responseHeaders;
    status;
    statusText;
    destination;
    url;
    rawResponse;
    client;
    constructor(e, t, n, r, i, o, s, a) {
      super('handleResponse'),
        (this.responseBody = e),
        (this.responseHeaders = t),
        (this.status = n),
        (this.statusText = r),
        (this.destination = i),
        (this.url = o),
        (this.rawResponse = s),
        (this.client = a);
    }
  }
  class C extends Event {
    url;
    requestHeaders;
    body;
    method;
    destination;
    client;
    constructor(e, t, n, r, i, o) {
      super('request'),
        (this.url = e),
        (this.requestHeaders = t),
        (this.body = n),
        (this.method = r),
        (this.destination = i),
        (this.client = o);
    }
    response;
  }
  function T(t) {
    let n = e.__externref_table_alloc();
    return e.__wbindgen_export_2.set(n, t), n;
  }
  function j(t, n) {
    try {
      return t.apply(this, n);
    } catch (n) {
      let t = T(n);
      e.__wbindgen_exn_store(t);
    }
  }
  let E =
    'undefined' != typeof TextDecoder
      ? new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })
      : {
          decode: () => {
            throw Error('TextDecoder not available');
          },
        };
  'undefined' != typeof TextDecoder && E.decode();
  let L = null;
  function O() {
    return (null === L || L.buffer !== e.memory.buffer) && (L = new Uint8Array(e.memory.buffer)), L;
  }
  function $(e, t) {
    return (e >>>= 0), E.decode(O().slice(e, e + t));
  }
  let U = 0,
    W =
      'undefined' != typeof TextEncoder
        ? new TextEncoder('utf-8')
        : {
            encode: () => {
              throw Error('TextEncoder not available');
            },
          },
    A = function (e, t) {
      let n = W.encode(e);
      return t.set(n), { read: e.length, written: n.length };
    };
  function M(e, t, n) {
    if (void 0 === n) {
      let n = W.encode(e),
        r = t(n.length, 1) >>> 0;
      return (
        O()
          .subarray(r, r + n.length)
          .set(n),
        (U = n.length),
        r
      );
    }
    let r = e.length,
      i = t(r, 1) >>> 0,
      o = O(),
      s = 0;
    for (; s < r; s++) {
      let t = e.charCodeAt(s);
      if (t > 127) break;
      o[i + s] = t;
    }
    if (s !== r) {
      0 !== s && (e = e.slice(s)), (i = n(i, r, (r = s + 3 * e.length), 1) >>> 0);
      let t = A(e, O().subarray(i + s, i + r));
      (s += t.written), (i = n(i, r, s, 1) >>> 0);
    }
    return (U = s), i;
  }
  let I = null;
  function B() {
    return (null === I || I.buffer !== e.memory.buffer) && (I = new DataView(e.memory.buffer)), I;
  }
  function P(e) {
    return null == e;
  }
  async function F(e, t) {
    if ('function' == typeof Response && e instanceof Response) {
      if ('function' == typeof WebAssembly.instantiateStreaming)
        try {
          return await WebAssembly.instantiateStreaming(e, t);
        } catch (t) {
          if ('application/wasm' != e.headers.get('Content-Type'))
            console.warn(
              '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
              t,
            );
          else throw t;
        }
      let n = await e.arrayBuffer();
      return await WebAssembly.instantiate(n, t);
    }
    {
      let n = await WebAssembly.instantiate(e, t);
      return n instanceof WebAssembly.Instance ? { instance: n, module: e } : n;
    }
  }
  async function D(t, n) {
    var r, i;
    let o;
    if (void 0 !== e) return e;
    void 0 !== t &&
      (Object.getPrototypeOf(t) === Object.prototype
        ? ({ module_or_path: t, memory: n, thread_stack_size: o } = t)
        : console.warn(
            'using deprecated parameters for the initialization function; pass a single object instead',
          )),
      void 0 === t && (t = new URL('wasm_bg.wasm', ''));
    let s = (function () {
      let t = {};
      return (
        (t.wbg = {}),
        (t.wbg.__wbg_call_672a4d21634d4a24 = function () {
          return j(function (e, t) {
            return e.call(t);
          }, arguments);
        }),
        (t.wbg.__wbg_call_7cccdd69e0791ae2 = function () {
          return j(function (e, t, n) {
            return e.call(t, n);
          }, arguments);
        }),
        (t.wbg.__wbg_call_833bed5770ea2041 = function () {
          return j(function (e, t, n, r) {
            return e.call(t, n, r);
          }, arguments);
        }),
        (t.wbg.__wbg_get_67b2ba62fc30de12 = function () {
          return j(function (e, t) {
            return Reflect.get(e, t);
          }, arguments);
        }),
        (t.wbg.__wbg_new_405e22f390576ce2 = function () {
          return {};
        }),
        (t.wbg.__wbg_new_78feb108b6472713 = function () {
          return [];
        }),
        (t.wbg.__wbg_new_9ffbe0a71eff35e3 = function () {
          return j(function (e, t) {
            return new URL($(e, t));
          }, arguments);
        }),
        (t.wbg.__wbg_newnoargs_105ed471475aaf50 = function (e, t) {
          return Function($(e, t));
        }),
        (t.wbg.__wbg_newwithbase_161c299e7a34e2eb = function () {
          return j(function (e, t, n, r) {
            return new URL($(e, t), $(n, r));
          }, arguments);
        }),
        (t.wbg.__wbg_now_d18023d54d4e5500 = function (e) {
          return e.now();
        }),
        (t.wbg.__wbg_scramtag_bd98edaa0eaec45e = function (t) {
          let n = M(scramtag(), e.__wbindgen_malloc, e.__wbindgen_realloc),
            r = U;
          B().setInt32(t + 4, r, !0), B().setInt32(t + 0, n, !0);
        }),
        (t.wbg.__wbg_set_bb8cecf6a62b9f46 = function () {
          return j(function (e, t, n) {
            return Reflect.set(e, t, n);
          }, arguments);
        }),
        (t.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function () {
          let e = 'undefined' == typeof global ? null : global;
          return P(e) ? 0 : T(e);
        }),
        (t.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function () {
          let e = 'undefined' == typeof globalThis ? null : globalThis;
          return P(e) ? 0 : T(e);
        }),
        (t.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function () {
          let e = 'undefined' == typeof self ? null : self;
          return P(e) ? 0 : T(e);
        }),
        (t.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function () {
          let e = 'undefined' == typeof window ? null : window;
          return P(e) ? 0 : T(e);
        }),
        (t.wbg.__wbg_toString_5285597960676b7b = function (e) {
          return e.toString();
        }),
        (t.wbg.__wbg_toString_c813bbd34d063839 = function (e) {
          return e.toString();
        }),
        (t.wbg.__wbindgen_boolean_get = function (e) {
          return 'boolean' == typeof e ? +!!e : 2;
        }),
        (t.wbg.__wbindgen_error_new = function (e, t) {
          return Error($(e, t));
        }),
        (t.wbg.__wbindgen_init_externref_table = function () {
          let t = e.__wbindgen_export_2,
            n = t.grow(4);
          t.set(0, void 0),
            t.set(n + 0, void 0),
            t.set(n + 1, null),
            t.set(n + 2, !0),
            t.set(n + 3, !1);
        }),
        (t.wbg.__wbindgen_is_function = function (e) {
          return 'function' == typeof e;
        }),
        (t.wbg.__wbindgen_is_undefined = function (e) {
          return void 0 === e;
        }),
        (t.wbg.__wbindgen_number_new = function (e) {
          return e;
        }),
        (t.wbg.__wbindgen_string_get = function (t, n) {
          let r = 'string' == typeof n ? n : void 0;
          var i = P(r) ? 0 : M(r, e.__wbindgen_malloc, e.__wbindgen_realloc),
            o = U;
          B().setInt32(t + 4, o, !0), B().setInt32(t + 0, i, !0);
        }),
        (t.wbg.__wbindgen_string_new = function (e, t) {
          return $(e, t);
        }),
        (t.wbg.__wbindgen_throw = function (e, t) {
          throw Error($(e, t));
        }),
        (t.wbg.__wbindgen_uint8_array_new = function (t, n) {
          var r,
            i = ((r = t >>> 0), O().subarray(r / 1, r / 1 + n)).slice();
          return e.__wbindgen_free(t, +n, 1), i;
        }),
        t
      );
    })();
    ('string' == typeof t ||
      ('function' == typeof Request && t instanceof Request) ||
      ('function' == typeof URL && t instanceof URL)) &&
      (t = fetch(t)),
      (r = s),
      (i = n),
      (r.wbg.memory = i || new WebAssembly.Memory({ initial: 18, maximum: 16384, shared: !0 }));
    let { instance: a, module: c } = await F(await t, s);
    return (function (t, n, r) {
      if (
        ((e = t.exports),
        (D.__wbindgen_wasm_module = n),
        (I = null),
        (L = null),
        void 0 !== r && ('number' != typeof r || 0 === r || r % 65536 != 0))
      )
        throw 'invalid stack size';
      return e.__wbindgen_start(r), e;
    })(a, c, o);
  }
  async function q() {
    let e = await fetch(n.config.files.wasm).then((e) => e.arrayBuffer());
    self.REAL_WASM = new Uint8Array(e);
  }
  self.WASM && (self.REAL_WASM = Uint8Array.from(atob(self.WASM), (e) => e.charCodeAt(0))),
    (Error.stackTraceLimit = 50),
    new TextDecoder();
  class H extends EventTarget {
    client;
    config;
    syncPool = {};
    synctoken = 0;
    cookieStore = new n.shared.CookieStore();
    serviceWorkers = [];
    constructor() {
      super(), (this.client = new n.shared.util.BareClient());
      let e = indexedDB.open('$scramjet', 1);
      (e.onsuccess = () => {
        let t = e.result.transaction('cookies', 'readonly').objectStore('cookies').get('cookies');
        t.onsuccess = () => {
          t.result && this.cookieStore.load(t.result);
        };
      }),
        addEventListener('message', async ({ data: n }) => {
          if ('scramjet$type' in n) {
            if ('registerServiceWorker' === n.scramjet$type) {
              this.serviceWorkers.push(new t(n.port, n.origin));
              return;
            }
            'cookie' === n.scramjet$type &&
              (this.cookieStore.setCookies([n.cookie], new URL(n.url)),
              e.result
                .transaction('cookies', 'readwrite')
                .objectStore('cookies')
                .put(JSON.parse(this.cookieStore.dump()), 'cookies')),
              'loadConfig' === n.scramjet$type && (this.config = n.config);
          }
        });
    }
    async loadConfig() {
      if (this.config) return;
      let e = indexedDB.open('$scramjet', 1);
      return new Promise((t, i) => {
        (e.onsuccess = async () => {
          let o = e.result.transaction('config', 'readonly').objectStore('config').get('config');
          (o.onsuccess = async () => {
            (this.config = o.result),
              (n.config = o.result),
              (n.codec.encode = r('url', n.config.codec.encode)),
              (n.codec.decode = r('url', n.config.codec.decode)),
              await q(),
              t();
          }),
            (o.onerror = () => i(o.error));
        }),
          (e.onerror = () => i(e.error));
      });
    }
    route({ request: e }) {
      return (
        !!e.url.startsWith(location.origin + this.config.prefix) ||
        !!e.url.startsWith(location.origin + this.config.files.wasm)
      );
    }
    async fetch({ request: e, clientId: t }) {
      let n = await self.clients.get(t);
      return x.call(this, e, n);
    }
  }
  self.ScramjetServiceWorker = H;
})();
//# sourceMappingURL=scramjet.worker.js.map
