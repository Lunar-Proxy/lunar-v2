function updateTime() {
    const time = document.getElementById('time');
    if (!time) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    time.textContent = `${hours}:${minutes} ${ampm}`;
  }
  
  setInterval(updateTime, 1000);
  updateTime();