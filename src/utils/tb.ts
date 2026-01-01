import ConfigAPI from './config'
import { scramjetWrapper } from './pro'
import { vWrapper } from './pro'
import * as baremux from "@mercuryworkshop/bare-mux"

type Tab = {
  id: number
  title: string
  favicon: string
  iframe: HTMLIFrameElement
  el?: HTMLDivElement
  titleTimer?: number
}

const links: Record<string, string> = {
  'lunar://settings': '/st',
  'lunar://new': '/new',
  'lunar://games': '/math',
  'lunar://apps': '/sci',
}

const moonIcon = '/a/moon.svg'
const iconUrl = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url='
const connection = new baremux.BareMuxConnection("/bm/worker.js")
const client = new baremux.BareClient()

let tabs: Tab[] = []
let current: number | null = null
let nextId = 1
let urlTimer: ReturnType<typeof setInterval> | null = null
let loadTimeout: ReturnType<typeof setTimeout> | null = null
let loading = false
let lastWatchedHref = ''
let urlChangeCallback: ((href: string) => void) | null = null

const bar = document.getElementById('tcontainer') as HTMLDivElement
const frames = document.getElementById('fcontainer') as HTMLDivElement

function getId() {
  return nextId++
}

function getDecoded(path: string) {
  const scramjetPrefix = scramjetWrapper.getConfig().prefix
  const vrapperPrefix = vWrapper.getConfig().prefix
  if (path.startsWith(scramjetPrefix)) return decodeURIComponent(scramjetWrapper.getConfig().codec.decode(path.slice(scramjetPrefix.length)) || '')
  if (path.startsWith(vrapperPrefix)) return vWrapper.getConfig().decodeUrl(path.slice(vrapperPrefix.length))
  return ''
}

async function getEncoded(url: string) {
  const backend = await ConfigAPI.get('backend')
  if (backend === 'sc') {
    const config = scramjetWrapper.getConfig()
    return config.prefix + config.codec.encode(url)
  }
  if (backend === 'u') {
    const config = vWrapper.getConfig()
    return config.prefix + config.encodeUrl(url)
  }
  return url
}

function cut(text: string, max = 18) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

async function getIcon(url: string) {
  try {
    if (await connection.getTransport() !== '/lc/index.mjs') {
      await connection.setTransport('/lc/index.mjs', [{ wisp: await ConfigAPI.get('wispUrl') }])
    }
    const response = await client.fetch(iconUrl + encodeURIComponent(url))
    if (!response.ok) throw 0
    const blob = await response.blob()
    return await new Promise<string>(resolve => {
      const fileReader = new FileReader()
      fileReader.onloadend = () => resolve(fileReader.result as string)
      fileReader.readAsDataURL(blob)
    })
  } catch {
    return moonIcon
  }
}

function refresh(tab: Tab, what: 'title' | 'icon') {
  if (!tab.el) return
  if (what === 'title') {
    const span = tab.el.querySelector('.tab-title') as HTMLSpanElement
    if (span) span.textContent = cut(tab.title)
  } else {
    const img = tab.el.querySelector('.tab-favicon') as HTMLImageElement
    if (img && img.src !== tab.favicon) img.src = tab.favicon
  }
}

function watchTitle(tab: Tab) {
  clearInterval(tab.titleTimer)
  tab.titleTimer = window.setInterval(() => {
    try {
      const doc = tab.iframe.contentDocument
      if (!doc) return
      const title = doc.title?.trim()
      if (title && title !== tab.title) {
        tab.title = title
        refresh(tab, 'title')
      }
    } catch {}
  }, 500)
}

async function loaded(tab: Tab) {
  try {
    const doc = tab.iframe.contentDocument
    if (!doc) return
    tab.title = doc.title?.trim() || 'New Tab'
    refresh(tab, 'title')
    watchTitle(tab)
    const pathname = new URL(tab.iframe.src, location.origin).pathname
    const decoded = getDecoded(pathname)
    if (!decoded) {
      tab.favicon = moonIcon
      refresh(tab, 'icon')
      return
    }
    const icon = await getIcon(decoded)
    tab.favicon = icon
    refresh(tab, 'icon')
  } catch {
    tab.favicon = moonIcon
    refresh(tab, 'icon')
  }
}

function makeFrame(id: number, url?: string) {
  const frame = document.createElement('iframe')
  frame.id = `frame-${id}`
  frame.src = url ?? 'new'
  frame.className = 'w-full z-0 h-full hidden'
  frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-modals allow-top-navigation allow-pointer-lock allow-same-origin allow-forms')
  frame.addEventListener('load', () => {
    try {
      const win = frame.contentWindow
      if (!win) return
      win.open = (openUrl?: string | URL) => {
        if (!openUrl) return null
        console.log("opening" + openUrl + "in new tab")
        getEncoded(openUrl.toString()).then(open)
        return null
      }
    } catch {}
  })
  return frame
}

function makeTab(tab: Tab) {
  const element = document.createElement('div')
  const active = tab.id === current
  element.className = `
    tab flex items-center justify-between h-10 min-w-[220px] px-3 py-2 rounded-t-2xl cursor-pointer select-none
    transition-all duration-200 shadow-sm relative z-10
    ${active ? 'bg-[#34324d] shadow-[0_0_8px_#5c59a5] border-t-2 border-[#5c59a5]' : 'bg-[#2a283e] hover:bg-[#323048]'}
  `
  const left = document.createElement('div')
  left.className = 'flex items-center gap-2 overflow-hidden h-full'
  const img = document.createElement('img')
  img.className = 'tab-favicon w-4 h-4'
  img.src = tab.favicon
  const titleSpan = document.createElement('span')
  titleSpan.className = 'tab-title truncate'
  titleSpan.textContent = cut(tab.title)
  left.append(img, titleSpan)
  const closeBtn = document.createElement('button')
  closeBtn.className = 'text-lg hover:text-red-400 transition-colors'
  closeBtn.textContent = '✕'
  closeBtn.onclick = event => {
    event.stopPropagation()
    kill(tab.id)
  }
  element.append(left, closeBtn)
  element.onclick = () => swap(tab.id)
  tab.el = element
  return element
}

function draw() {
  bar.innerHTML = ''
  tabs.forEach(tab => bar.appendChild(tab.el ?? makeTab(tab)))
}

function highlight() {
  tabs.forEach(tab => {
    if (!tab.el) return
    const active = tab.id === current
    tab.el.className = `
      tab flex items-center justify-between h-10 min-w-[220px] px-3 py-2 rounded-t-2xl cursor-pointer select-none
      transition-all duration-200 shadow-sm relative z-10
      ${active ? 'bg-[#34324d] shadow-[0_0_8px_#5c59a5] border-t-2 border-[#5c59a5]' : 'bg-[#2a283e] hover:bg-[#323048]'}
    `
  })
}

function kill(id: number) {
  const index = tabs.findIndex(tab => tab.id === id)
  if (index === -1) return
  
  if (tabs.length <= 1) {
    open()
  }
  
  clearInterval(tabs[index].titleTimer)
  tabs[index].iframe.remove()
  tabs.splice(index, 1)
  
  if (current === id && tabs.length > 0) {
    swap(tabs[Math.max(0, index - 1)].id)
  }
  draw()
}

function showLoad() {
  const loader = document.getElementById('loading-bar') as HTMLDivElement | null
  if (!loader || loading) return
  loading = true
  loader.style.display = 'block'
  loader.style.opacity = '1'
  loader.style.width = '0%'
  loader.style.transition = 'none'
  setTimeout(() => {
    if (!loading) return
    loader.style.transition = 'width 0.5s cubic-bezier(.4,0,.2,1)'
    loader.style.width = '80%'
  }, 10)
  loadTimeout = setTimeout(() => {
    if (loading && loader) {
      loader.style.transition = 'width 0.3s cubic-bezier(.4,0,.2,1)'
      loader.style.width = '90%'
    }
  }, 1200)
}

function doneLoad() {
  const loader = document.getElementById('loading-bar') as HTMLDivElement | null
  if (!loader || !loading) return
  loader.style.transition = 'width 0.2s cubic-bezier(.4,0,.2,1)'
  loader.style.width = '100%'
  setTimeout(() => {
    if (!loader) return
    loader.style.opacity = '0'
    loader.style.display = 'none'
    loader.style.width = '0%'
    loading = false
  }, 180)
}

function resetLoad() {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  doneLoad()
}

function open(url?: string) {
  const id = getId()
  const frame = makeFrame(id, url)
  frames.appendChild(frame)
  const tab: Tab = { id, title: 'New Tab', favicon: moonIcon, iframe: frame }
  tabs.push(tab)
  draw()
  swap(id)
  
  frame.addEventListener('load', () => {
    loaded(tab)
    resetLoad()
  })
  frame.addEventListener('error', () => resetLoad())
}

function swap(id: number) {
  clearInterval(urlTimer!)
  current = id
  tabs.forEach(tab => tab.iframe.classList.toggle('hidden', tab.id !== id))
  highlight()
  resetLoad()
  lastWatchedHref = ''
  
  const input = document.getElementById('urlbar') as HTMLInputElement | null
  urlTimer = setInterval(() => {
    try {
      const tab = tabs.find(tab => tab.id === id)
      const href = tab?.iframe.contentWindow?.location.href
      if (!href || href === lastWatchedHref) return
      lastWatchedHref = href
      
      if (input) {
        const pathname = new URL(href, location.origin).pathname
        const quickLink = Object.entries(links).find(([, value]) => value === pathname)
        input.value = quickLink ? quickLink[0] : getDecoded(pathname)
      }
    
      if (urlChangeCallback) urlChangeCallback(href)
    } catch {}
  }, 300)
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add')?.addEventListener('click', () => {
    open()
  })
  
  const urlbar = document.getElementById('urlbar') as HTMLInputElement | null
  urlbar?.addEventListener('keydown', event => {
    if (event.key === 'Enter') showLoad()
  })
  
  setInterval(() => {
    if (loading) {
      const tab = tabs.find(tab => tab.id === current)
      if (tab?.iframe?.contentDocument?.readyState === 'complete') {
        resetLoad()
      }
    }
  }, 500)
  
  open()
})

export const TabManager = {
  get activeTabId() {
    return current
  },
  set activeTabId(id: number | null) {
    if (id !== null) swap(id)
  },
  openTab: (url?: string) => {
    open(url)
  },
  onUrlChange: (callback: (href: string) => void) => {
    urlChangeCallback = callback
  },
}