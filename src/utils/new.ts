const $ = (id: string) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  const hoursEl = $('hours');
  const minutesEl = $('minutes');
  const secondsEl = $('seconds');
  const ampmEl = $('ampm');
  const serverEl = $('sl');
  const refreshBtn = $('refresh');

  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
    if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
    if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
    if (ampmEl) ampmEl.textContent = ampm;
  }

  setInterval(updateClock, 1000);
  updateClock();

  async function pingServer(url: string) {
    const start = performance.now();
    try {
      await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      return { ok: true, latency: Math.round(performance.now() - start) };
    } catch {
      return { ok: false, latency: 0 };
    }
  }

  async function updatePing() {
    if (!serverEl) return;
    serverEl.textContent = 'Pinging...';

    const result = await pingServer(window.location.origin);

    if (result.ok) {
      const color =
        result.latency >= 300
          ? 'text-red-500'
          : result.latency >= 100
            ? 'text-yellow-400'
            : 'text-green-400';
      serverEl.innerHTML = `Server: <span class="${color} ml-1">${result.latency}ms</span>`;
    } else {
      serverEl.textContent = 'Offline';
    }
  }

  refreshBtn?.addEventListener('click', () => {
    refreshBtn.classList.add('animate-spin');
    updatePing().finally(() => {
      setTimeout(() => refreshBtn.classList.remove('animate-spin'), 800);
    });
  });

  updatePing();
});
