document.addEventListener('DOMContentLoaded', () => {
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const ampmEl = document.getElementById('ampm');
  const serverEl = document.getElementById('sl');
  const refreshBtn = document.getElementById('refresh');

  let clockInterval: ReturnType<typeof setInterval> | null = null;
  let spinTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    hoursEl && (hoursEl.textContent = hours.toString().padStart(2, '0'));
    minutesEl && (minutesEl.textContent = minutes.toString().padStart(2, '0'));
    secondsEl && (secondsEl.textContent = seconds.toString().padStart(2, '0'));
    ampmEl && (ampmEl.textContent = ampm);
  }

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

  function handleRefreshClick() {
    if (!refreshBtn) return;
    refreshBtn.classList.add('animate-spin');
    updatePing().finally(() => {
      if (spinTimeout) clearTimeout(spinTimeout);
      spinTimeout = setTimeout(() => refreshBtn.classList.remove('animate-spin'), 800);
    });
  }

  function cleanup() {
    if (clockInterval) clearInterval(clockInterval);
    if (spinTimeout) clearTimeout(spinTimeout);
    refreshBtn?.removeEventListener('click', handleRefreshClick);
  }

  // Start clock
  clockInterval = setInterval(updateClock, 1000);
  updateClock();

  // Setup refresh button
  refreshBtn?.addEventListener('click', handleRefreshClick);

  // Initial ping
  updatePing();

  // Cleanup on unload
  window.addEventListener('unload', cleanup);
});
