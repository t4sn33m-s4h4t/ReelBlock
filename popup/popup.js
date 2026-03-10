// ReelBlock — Popup (live timer)

function fmt(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

async function getStatus() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'GET_STATUS' }, r));
}

let _settings = null;
let _limitSec = 3600;
let _baseLiveSec = 0;   // liveSeconds from background at last fetch
let _fetchedAt = 0;     // Date.now() when we last fetched
let _allowed = false;

async function fetchAndSync() {
  const { settings, dailyData } = await getStatus() || {};
  _settings  = settings;
  _allowed   = settings?.allowReels ?? false;
  _limitSec  = (settings?.dailyLimitMinutes ?? 60) * 60;
  _baseLiveSec = dailyData?.liveSeconds ?? dailyData?.totalSeconds ?? 0;
  _fetchedAt = Date.now();
  // Apply theme from settings
  document.documentElement.setAttribute('data-theme', settings?.theme || 'dark-default');
}

function currentUsed() {
  if (!_allowed) return _baseLiveSec; // timer paused, no local advance
  const localElapsed = (Date.now() - _fetchedAt) / 1000;
  return Math.min(_baseLiveSec + localElapsed, _limitSec);
}

function renderUI() {
  const usedSec = currentUsed();
  const leftSec = Math.max(0, _limitSec - usedSec);
  const pct     = Math.min((usedSec / _limitSec) * 100, 100);

  const label = document.getElementById('toggleLabel');
  const sub   = document.getElementById('toggleSub');
  const stats = document.getElementById('statsSection');
  const fill  = document.getElementById('pbarFill');

  if (_allowed) {
    label.textContent = 'Reels Allowed';
    label.className   = 'toggle-label allowed';
    sub.textContent   = 'Time-limited access is on';
    stats.classList.remove('hidden');
  } else {
    label.textContent = 'Reels Blocked';
    label.className   = 'toggle-label blocked';
    sub.textContent   = 'All reels & shorts are blocked';
    stats.classList.add('hidden');
  }

  document.getElementById('statUsed').textContent  = fmt(usedSec);
  document.getElementById('statLeft').textContent  = fmt(leftSec);
  document.getElementById('statLimit').textContent = fmt(_limitSec);

  fill.style.width = pct + '%';
  fill.className = 'pbar-fill' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');

  const h = _settings?.resetHour ?? 12;
  const hl = h === 0 ? '12:00 AM' : h === 12 ? '12:00 PM' : h > 12 ? `${h-12}:00 PM` : `${h}:00 AM`;
  document.getElementById('footerLabel').textContent = `Resets at ${hl}`;
}

async function init() {
  await fetchAndSync();

  const toggle = document.getElementById('masterToggle');
  toggle.checked = _allowed;
  renderUI();

  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    const res = await new Promise(r => chrome.runtime.sendMessage({ type: 'SET_ALLOW', value: toggle.checked }, r));
    if (res?.reason === 'limit_reached') {
      toggle.checked = false;
      // Show message
      const msg = document.getElementById('limitMsg');
      const h = _settings?.resetHour ?? 12;
      const hl = h === 0 ? '12:00 AM' : h === 12 ? '12:00 PM' : h > 12 ? `${h-12}:00 PM` : `${h}:00 AM`;
      msg.textContent = `⏱️ Daily limit reached — resets at ${hl}`;
      msg.classList.add('show');
      setTimeout(() => msg.classList.remove('show'), 4000);
    }
    await fetchAndSync();
    renderUI();
    toggle.disabled = false;
  });

  document.getElementById('optBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Tick every second for smooth live display
  setInterval(renderUI, 1000);

  // Re-sync with background every 10s to stay accurate
  setInterval(fetchAndSync, 10000);
}

document.addEventListener('DOMContentLoaded', init);
