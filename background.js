// ReelBlock v2.7

const RULESET_ID = 'block_rules';

const SITES = [
  { regex: /^https?:\/\/(www\.)?youtube\.com\/shorts(\/|$)/i,   home: 'https://www.youtube.com'   },
  { regex: /^https?:\/\/(www\.)?facebook\.com\/reel(\/|$)/i,    home: 'https://www.facebook.com'  },
  { regex: /^https?:\/\/(www\.)?instagram\.com\/reels?(\/|$)/i, home: 'https://www.instagram.com' }
];

const DEFAULTS = { allowReels: false, dailyLimitMinutes: 60, resetHour: 12, alertIntervalMinutes: 15 };

// ── Storage ───────────────────────────────────────────────────────────────────

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

async function getData() {
  const { dailyData } = await chrome.storage.local.get('dailyData');
  return dailyData || { totalSeconds: 0, lastResetMs: 0, timerStartMs: null };
}

async function saveData(d) {
  await chrome.storage.local.set({ dailyData: d });
}

async function getLiveSeconds() {
  const d = await getData();
  if (!d.timerStartMs) return d.totalSeconds || 0;
  const extra = Math.floor((Date.now() - d.timerStartMs) / 1000);
  return (d.totalSeconds || 0) + extra;
}

// ── Timer ─────────────────────────────────────────────────────────────────────

async function startTimer() {
  const d = await getData();
  if (d.timerStartMs) return;
  d.timerStartMs = Date.now();
  await saveData(d);
}

async function stopTimer() {
  const d = await getData();
  if (!d.timerStartMs) return;
  const elapsed = Math.floor((Date.now() - d.timerStartMs) / 1000);
  d.totalSeconds = (d.totalSeconds || 0) + elapsed;
  d.timerStartMs = null;
  await saveData(d);
}

// ── Enforce limit: called whenever we need to check if time is up ─────────────

async function enforceLimitIfNeeded() {
  const s = await getSettings();
  if (!s.allowReels) return false; // already blocked

  const usedSec = await getLiveSeconds();
  const limitSec = s.dailyLimitMinutes * 60;

  if (usedSec >= limitSec) {
    // Time is up — stop timer, force block, turn off toggle
    await stopTimer();
    s.allowReels = false;
    await chrome.storage.local.set({ settings: s });
    await setRuleset(true);
    await reloadSiteTabs();
    return true; // limit was hit
  }
  return false;
}

// ── Ruleset ───────────────────────────────────────────────────────────────────

async function setRuleset(enabled) {
  try {
    if (enabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [RULESET_ID], disableRulesetIds: []
      });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [], disableRulesetIds: [RULESET_ID]
      });
    }
  } catch (e) { console.error('ruleset:', e); }
}

async function syncRuleset() {
  const s = await getSettings();
  if (!s.allowReels) { await setRuleset(true); return; }
  const usedSec = await getLiveSeconds();
  const limitSec = s.dailyLimitMinutes * 60;
  if (usedSec >= limitSec) {
    await enforceLimitIfNeeded();
  } else {
    await setRuleset(false);
  }
}

// ── Reload site tabs ──────────────────────────────────────────────────────────

async function reloadSiteTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    if (/facebook\.com|youtube\.com|instagram\.com/i.test(tab.url)) {
      try { chrome.tabs.reload(tab.id); } catch(e) {}
    }
  }
}

// ── SPA nav blocking ──────────────────────────────────────────────────────────

async function handleReelNav(tabId, url) {
  const s = await getSettings();
  const reelSite = SITES.find(p => p.regex.test(url));
  if (!reelSite) return;

  if (!s.allowReels) {
    chrome.tabs.update(tabId, { url: reelSite.home });
    return;
  }
  // Check limit
  const hit = await enforceLimitIfNeeded();
  if (hit) {
    chrome.tabs.update(tabId, { url: reelSite.home });
  }
}

chrome.webNavigation.onHistoryStateUpdated.addListener(async (det) => {
  if (det.frameId !== 0) return;
  if (SITES.some(p => p.regex.test(det.url))) await handleReelNav(det.tabId, det.url);
});

chrome.webNavigation.onCommitted.addListener(async (det) => {
  if (det.frameId !== 0) return;
  if (SITES.some(p => p.regex.test(det.url))) await handleReelNav(det.tabId, det.url);
});

// ── Daily reset ───────────────────────────────────────────────────────────────

async function checkReset() {
  const s = await getSettings();
  const d = await getData();
  const now = Date.now();
  const todayReset = new Date();
  todayReset.setHours(s.resetHour, 0, 0, 0);
  const resetMs = todayReset.getTime();

  if (now >= resetMs && (d.lastResetMs || 0) < resetMs) {
    const wasRunning = !!d.timerStartMs;
    await saveData({
      totalSeconds: 0,
      lastResetMs: now,
      timerStartMs: wasRunning ? Date.now() : null
    });
    // Re-enable toggle if it was force-disabled by limit
    if (!s.allowReels) {
      // keep it off — user must manually re-enable
    }
    await syncRuleset();
    chrome.notifications.create('reset-' + Date.now(), {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'ReelBlock — Daily Reset',
      message: `Limit reset. You have ${s.dailyLimitMinutes} minutes today.`
    });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: DEFAULTS });
  const { dailyData } = await chrome.storage.local.get('dailyData');
  if (!dailyData) await saveData({ totalSeconds: 0, lastResetMs: 0, timerStartMs: null });
  await syncRuleset();
  setupAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  const d = await getData();
  if (d.timerStartMs) {
    const elapsed = Math.floor((Date.now() - d.timerStartMs) / 1000);
    d.totalSeconds = (d.totalSeconds || 0) + elapsed;
    d.timerStartMs = Date.now();
    await saveData(d);
  }
  await checkReset();
  await enforceLimitIfNeeded();
  await syncRuleset();
  setupAlarms();
});

function setupAlarms() {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create('tick',   { periodInMinutes: 1 });
    chrome.alarms.create('notify', { periodInMinutes: 1 });
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tick') {
    await checkReset();
    await enforceLimitIfNeeded(); // auto-block + flip toggle when time is up
  }
  if (alarm.name === 'notify') {
    await checkAndShowAlert();
  }
});

// ── Alert overlay ─────────────────────────────────────────────────────────────

const lastAlertTime = {};

async function checkAndShowAlert() {
  const s = await getSettings();
  if (!s.allowReels) return;
  const intervalMin = s.alertIntervalMinutes ?? 15;
  if (intervalMin === 0) return;

  const now = Date.now();
  const intervalMs = intervalMin * 60 * 1000;
  const usedSec = await getLiveSeconds();
  const usedMin = Math.floor(usedSec / 60);
  if (usedMin === 0) return;

  const limitMin = s.dailyLimitMinutes;
  const leftMin = Math.max(0, limitMin - usedMin);

  const tabs = await chrome.tabs.query({ active: true });
  for (const tab of tabs) {
    if (!tab.url || !SITES.some(p => p.regex.test(tab.url))) continue;
    if ((now - (lastAlertTime[tab.id] || 0)) < intervalMs) continue;
    lastAlertTime[tab.id] = now;
    injectAlert(tab.id, usedMin, leftMin, limitMin);
  }
}

async function injectAlert(tabId, usedMin, leftMin, limitMin) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (usedMin, leftMin, limitMin) => {
        const existing = document.getElementById('rb-alert');
        if (existing) existing.remove();
        const pct = Math.round((usedMin / limitMin) * 100);
        const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#6c8ef5';
        const overlay = document.createElement('div');
        overlay.id = 'rb-alert';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,system-ui,sans-serif';
        overlay.innerHTML = `
          <div style="background:#111318;border:1px solid #1e2230;border-radius:18px;padding:36px 44px;text-align:center;max-width:360px;width:90%">
            <div style="font-size:40px;margin-bottom:14px">🛡️</div>
            <div style="color:#8892a4;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">ReelBlock Check-in</div>
            <div style="color:#e8eaf0;font-size:19px;font-weight:700;margin-bottom:18px">Still watching?</div>
            <div style="display:flex;justify-content:center;gap:24px;margin-bottom:18px">
              <div>
                <div style="color:#6c8ef5;font-size:24px;font-weight:700">${usedMin}m</div>
                <div style="color:#4a5568;font-size:11px;text-transform:uppercase;letter-spacing:.5px">used</div>
              </div>
              <div style="width:1px;background:#1e2230"></div>
              <div>
                <div style="color:${barColor};font-size:24px;font-weight:700">${leftMin}m</div>
                <div style="color:#4a5568;font-size:11px;text-transform:uppercase;letter-spacing:.5px">left</div>
              </div>
            </div>
            <div style="background:#1a1d27;border-radius:6px;height:6px;margin-bottom:20px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px"></div>
            </div>
            <button id="rb-continue" style="background:#6c8ef5;border:none;border-radius:9px;padding:11px 32px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px;font-family:inherit">Continue</button>
            <button id="rb-gohome" style="background:#1e2230;border:1px solid #252836;border-radius:9px;padding:11px 24px;color:#8892a4;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Go Home</button>
          </div>`;
        document.body.appendChild(overlay);
        document.getElementById('rb-continue').onclick = () => overlay.remove();
        document.getElementById('rb-gohome').onclick = () => {
          overlay.remove();
          const h = location.hostname;
          window.location.href = h.includes('youtube') ? 'https://www.youtube.com' : h.includes('facebook') ? 'https://www.facebook.com' : 'https://www.instagram.com';
        };
      },
      args: [usedMin, leftMin, limitMin]
    });
  } catch(e) {}
}

// ── Messages ──────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'GET_STATUS') {
      const settings = await getSettings();
      const dailyData = await getData();
      dailyData.liveSeconds = await getLiveSeconds();
      sendResponse({ settings, dailyData });
    }

    if (msg.type === 'SET_ALLOW') {
      const s = await getSettings();

      // Block re-enabling if daily limit already used up
      if (msg.value === true) {
        const usedSec = await getLiveSeconds();
        const limitSec = s.dailyLimitMinutes * 60;
        if (usedSec >= limitSec) {
          sendResponse({ ok: false, reason: 'limit_reached' });
          return;
        }
      }

      s.allowReels = msg.value;
      await chrome.storage.local.set({ settings: s });
      if (msg.value) {
        await startTimer();
        await setRuleset(false);
      } else {
        await stopTimer();
        await setRuleset(true);
      }
      await reloadSiteTabs();
      sendResponse({ ok: true });
    }

    if (msg.type === 'SAVE_SETTINGS') {
      await chrome.storage.local.set({ settings: msg.settings });
      await syncRuleset();
      sendResponse({ ok: true });
    }

    if (msg.type === 'RESET_TODAY') {
      const d = await getData();
      const wasRunning = !!d.timerStartMs;
      await saveData({ totalSeconds: 0, lastResetMs: Date.now(), timerStartMs: wasRunning ? Date.now() : null });
      await syncRuleset();
      sendResponse({ ok: true });
    }
  })();
  return true;
});
