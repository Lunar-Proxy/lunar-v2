document.addEventListener('DOMContentLoaded', () => {
  const hoursEl = document.getElementById('hours') as HTMLElement | null;
  const minutesEl = document.getElementById('minutes') as HTMLElement | null;
  const secondsEl = document.getElementById('seconds') as HTMLElement | null;
  const ampmEl = document.getElementById('ampm') as HTMLElement | null;
  const serverEl = document.getElementById('sl') as HTMLElement | null;
  const refreshBtn = document.getElementById('refresh') as HTMLElement | null;

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

  setInterval(updateClock, 1000);
  updateClock();

  interface PingResult {
    status: 'OK' | 'Fail';
    latency: number | 'N/A';
  }

  function pingServer(url: string): Promise<PingResult> {
    return new Promise(resolve => {
      // doing wisp server ping was so inaccurate atp lets just do the actual server
      const start = performance.now();

      fetch(url, { method: 'HEAD', cache: 'no-cache' })
        .then(() => resolve({ status: 'OK', latency: Math.round(performance.now() - start) }))
        .catch(() => resolve({ status: 'Fail', latency: 'N/A' }));

      setTimeout(() => resolve({ status: 'Fail', latency: 'N/A' }), 3000);
    });
  }

  async function updatePing() {
    if (!serverEl) return;
    serverEl.textContent = 'Pinging...';
    serverEl.className = 'text-md cursor-default font-medium text-white/70';

    try {
      const result = await pingServer(window.location.origin);

      if (result.status === 'OK') {
        let colorClass = 'text-green-400';
        if (typeof result.latency === 'number') {
          if (result.latency >= 300) colorClass = 'text-red-500';
          else if (result.latency >= 100) colorClass = 'text-yellow-400';
        }
        serverEl.innerHTML = `Server latency: <span class="${colorClass} ml-1">${result.latency} ms</span>`;
      } else {
        serverEl.textContent = 'Ping failed';
      }
    } catch (err) {
      console.error('Failed to ping the server:', err);
      serverEl.textContent = 'Ping failed';
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
