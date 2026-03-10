# 🛡️ ReelBlock

> **Take back your time.** ReelBlock completely blocks YouTube Shorts, Facebook Reels, and Instagram Reels — with a smart daily time limit system when you need a controlled allowance.

> *This extension was built with the help of [Claude AI](https://claude.ai) by Anthropic.*

---

## ✨ Features

- **Total block by default** — reels and shorts are fully blocked the moment you install
- **One toggle to allow** — flip the switch in the popup to enable time-limited access
- **Daily time limit** — set how many minutes per day you're allowed (default: 60 min)
- **Live timer in popup** — see exactly how much time you've used and how much is left, updating every second
- **Auto-block when limit hits** — once your daily time is up, the toggle locks and reels are blocked again automatically
- **SPA navigation blocked** — blocks in-page navigation on Facebook and Instagram too (not just direct URL loads)
- **Custom alert overlay** — get a beautiful in-page check-in alert every X minutes while watching
- **Daily reset** — your timer resets at a time you choose (midnight, noon, morning, or evening)
- **8 themes** — Default Dark, OLED Black, Purple, Blue, Green, Red, Slate, and White (light mode)
- **No ads, no tracking, no accounts** — everything is stored locally in your browser

---

## 📦 Download & Install

### Option 1 — Download ZIP (easiest)

**[⬇️ Download reelblock.zip from here](https://github.com/t4sn33m-s4h4t/ReelBlock/raw/refs/heads/main/reelblock.zip)**
 

1. Download the file
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer Mode** (toggle in the top-right corner)
4. Click **"Load unpacked"**
5. Select the `reelblock`
6. The 🛡️ ReelBlock icon will appear in your Chrome toolbar

---

### Option 2 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

Then follow steps 2–6 above, selecting the `reelblock` folder inside the cloned repo.

---

## 🚀 How to Use

### Basic blocking (default)
When you install the extension, **all reels and shorts are blocked immediately** — no setup needed. Visiting any of these URLs will redirect you to the site's homepage:
- `youtube.com/shorts/...`
- `facebook.com/reel/...`
- `instagram.com/reels/...`

### Allowing reels with a time limit
1. Click the 🛡️ icon in your Chrome toolbar
2. Flip the **toggle** from OFF → ON
3. Reels are now accessible, and your daily timer starts counting
4. When your daily limit is up, reels are blocked automatically and the toggle locks

### Settings (gear icon in popup)
Open the settings page to configure:

| Setting | Description |
|---|---|
| **Daily Time Limit** | How many minutes of reels you can watch per day (5 min – 3 hrs) |
| **Daily Reset Time** | When your timer resets each day (midnight, 6 AM, noon, 6 PM) |
| **Usage Alert Interval** | Get an in-page check-in popup every 5 / 10 / 15 / 30 minutes while watching |
| **Theme** | Choose from 8 themes — applies to both popup and settings page |
| **Reset Today's Data** | Manually reset your daily timer |

### Alert overlay
When you've been watching for the configured interval, a dark overlay appears on the reel page showing your time used and time left — with a **Continue** or **Go Home** button.

### When time runs out
- The toggle in the popup snaps back to OFF
- A message shows: *"⏱️ Daily limit reached — resets at [time]"*
- All reels are immediately blocked again
- The timer resets automatically at your chosen reset time

---

## 📁 File Structure

```
reelblock/
├── manifest.json         # Chrome extension config (Manifest V3)
├── background.js         # Service worker — blocking, timer, alarms
├── block_rules.json      # declarativeNetRequest redirect rules
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛠️ Technical Details

- Built with **Manifest V3** (the current Chrome extension standard)
- Uses `declarativeNetRequest` for network-level URL blocking/redirecting
- Uses `webNavigation.onHistoryStateUpdated` to catch SPA navigations on Facebook and Instagram
- Timer logic: starts on toggle ON, saves elapsed time on toggle OFF — stored in `chrome.storage.local`
- All data is local — nothing is sent anywhere

---

 