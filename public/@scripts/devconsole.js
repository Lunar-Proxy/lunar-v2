// Auto-built from src/utils/devconsole.ts by Astro
// DevConsole logic
let consoleOpen = false;
const frame = document.getElementById('frame');
const input = document.getElementById('js-input');
const output = document.getElementById('output-log');
const execBtn = document.getElementById('exec-btn');
const closeBtn = document.getElementById('close-console');
const clearBtn = document.getElementById('clear-log');
const toggleBtn = document.getElementById('devtools-toggle');

function toggleConsole() {
  consoleOpen = !consoleOpen;
  const consoleEl = document.querySelector('.fixed.bottom-0');
  if (consoleEl) {
    consoleEl.style.transform = consoleOpen ? 'translateY(0)' : 'translateY(100%)';
    consoleEl.style.opacity = consoleOpen ? '1' : '0';
    consoleEl.style.pointerEvents = consoleOpen ? 'auto' : 'none';
  }
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  output.innerHTML += `<div>[${time}] ${msg}</div>`;
  output.scrollTop = output.scrollHeight;
}

function execCode(code) {
  if (!frame.contentWindow) {
    log('Iframe not ready');
    return;
  }
  frame.contentWindow.postMessage({type: 'DEV_EXEC', code}, '*');
}

if (input) input.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') execBtn.click();
});

if (execBtn) execBtn.addEventListener('click', () => {
  const code = input.value.trim();
  if (code) {
    log(`>> ${code}`);
    execCode(code);
    input.value = '';
  }
});

if (closeBtn) closeBtn.addEventListener('click', toggleConsole);
if (clearBtn) clearBtn.addEventListener('click', () => output.innerHTML = 'Console cleared.');
if (toggleBtn) toggleBtn.addEventListener('click', toggleConsole);

// Shortcut
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    toggleConsole();
  }
});

// Results
window.addEventListener('message', e => {
  if (e.data.type === 'DEV_RESULT') {
    log(e.data.result || e.data.error || 'Executed');
  }
});
