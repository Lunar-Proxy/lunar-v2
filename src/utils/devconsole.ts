let consoleOpen = false;
const frame = document.getElementById('frame') as HTMLIFrameElement;
const input = document.getElementById('js-input') as HTMLTextAreaElement;
const output = document.getElementById('output-log') as HTMLDivElement;
const execBtn = document.getElementById('exec-btn') as HTMLButtonElement;
const closeBtn = document.getElementById('close-console') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-log') as HTMLButtonElement;
const toggleBtn = document.getElementById('devtools-toggle') as HTMLButtonElement;

export function toggleConsole() {
  consoleOpen = !consoleOpen;
  const consoleEl = document.querySelector('.fixed.bottom-0') as HTMLElement;
  if (consoleEl) {
    consoleEl.style.transform = consoleOpen ? 'translateY(0) !important' : 'translateY(100%) !important';
    consoleEl.style.opacity = consoleOpen ? '1 !important' : '0 !important';
    consoleEl.style.pointerEvents = consoleOpen ? 'auto' : 'none';
  }
  return consoleOpen;
}

export function execCode(code: string) {
  if (!frame.contentWindow) {
    log('Iframe not ready');
    return;
  }
  // Safe postMessage for cross-origin
  frame.contentWindow.postMessage({
    type: 'DEV_EXEC',
    code: code
  }, '*');
}

function log(msg: string) {
  const time = new Date().toLocaleTimeString();
  output.innerHTML += `<div>[${time}] ${msg}</div>`;
  output.scrollTop = output.scrollHeight;
}

input?.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') execBtn.click();
});

execBtn?.addEventListener('click', () => {
  const code = input.value.trim();
  if (code) {
    log(`>> ${code}`);
    execCode(code);
    input.value = '';
  }
});

closeBtn?.addEventListener('click', () => toggleConsole());

clearBtn?.addEventListener('click', () => {
  output.innerHTML = 'Console cleared.';
});

toggleBtn?.addEventListener('click', toggleConsole);

// Global shortcut
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    toggleConsole();
  }
});

// Listen for results from iframe
window.addEventListener('message', (e) => {
  if (e.data.type === 'DEV_RESULT') {
    log(e.data.result || e.data.error || 'Executed');
  }
});

