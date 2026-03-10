// ReelBlock — Options

function fmt(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

let _baseLiveSec = 0;
let _fetchedAt = 0;
let _allowed = false;
let _limitSec = 3600;

async function fetchStatus() {
  return new Promise(r => chrome.runtime.sendMessage({ type: 'GET_STATUS' }, r));
}

function currentUsed() {
  if (!_allowed) return _baseLiveSec;
  const elapsed = (Date.now() - _fetchedAt) / 1000;
  return Math.min(_baseLiveSec + elapsed, _limitSec);
}

async function syncStatus() {
  const { settings, dailyData } = await fetchStatus() || {};
  _allowed   = settings?.allowReels ?? false;
  _limitSec  = (settings?.dailyLimitMinutes ?? 60) * 60;
  _baseLiveSec = dailyData?.liveSeconds ?? dailyData?.totalSeconds ?? 0;
  _fetchedAt = Date.now();
}

async function init() {
  const { settings, dailyData } = await new Promise(r =>
    chrome.storage.local.get(['settings', 'dailyData'], r)
  );

  const s = settings || { dailyLimitMinutes: 60, resetHour: 12 };

  // Slider
  const slider = document.getElementById('limitSlider');
  const sliderVal = document.getElementById('limitVal');
  slider.value = s.dailyLimitMinutes ?? 60;
  sliderVal.textContent = slider.value + ' minutes';
  slider.addEventListener('input', () => {
    sliderVal.textContent = slider.value + ' minutes';
  });

  // Alert interval radios
  document.querySelectorAll('input[name="alertInterval"]').forEach(r => {
    if (parseInt(r.value) === (s.alertIntervalMinutes ?? 15)) r.checked = true;
  });

  // Reset radios
  document.querySelectorAll('input[name="reset"]').forEach(r => {
    if (parseInt(r.value) === (s.resetHour ?? 12)) r.checked = true;
  });

  // Theme swatches
  document.querySelectorAll('input[name="theme"]').forEach(r => {
    if (r.value === (s.theme || 'dark-default')) r.checked = true;
    r.addEventListener('change', () => {
      document.documentElement.setAttribute('data-theme', r.value);
    });
  });
  document.documentElement.setAttribute('data-theme', s.theme || 'dark-default');

  // Set limit display (no longer shown in usage section)

  // Live usage tick
  await syncStatus();
  document.getElementById('usageUsed').textContent = fmt(currentUsed());

  setInterval(() => {
    document.getElementById('usageUsed').textContent = fmt(currentUsed());
  }, 1000);

  setInterval(syncStatus, 10000);

  // Reset today
  document.getElementById('resetBtn').addEventListener('click', async () => {
    await new Promise(r => chrome.runtime.sendMessage({ type: 'RESET_TODAY' }, r));
    await syncStatus();
    document.getElementById('usageUsed').textContent = fmt(0);
    toast('✓ Today\'s data reset');
  });

  // Save
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const resetRadio = document.querySelector('input[name="reset"]:checked');
    const alertRadio = document.querySelector('input[name="alertInterval"]:checked');
    s.dailyLimitMinutes = parseInt(slider.value);
    s.resetHour = resetRadio ? parseInt(resetRadio.value) : 12;
    s.alertIntervalMinutes = alertRadio ? parseInt(alertRadio.value) : 15;
    const themeRadio = document.querySelector('input[name="theme"]:checked');
    s.theme = themeRadio ? themeRadio.value : 'dark-default';
    await chrome.storage.local.set({ settings: s });
    _limitSec = s.dailyLimitMinutes * 60;
    toast('✓ Settings saved');
  });
}

document.addEventListener('DOMContentLoaded', init);
