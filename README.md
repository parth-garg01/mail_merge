# Smart Mail Merger

A free, self-hosted desktop app for personalized email outreach campaigns. Import a spreadsheet, write a template with merge fields, set a sending schedule, and let it run — no subscriptions, no spam triggers.

Built with Electron + React + Gmail API.

---

## Why This Exists

Paid tools like Mailmeteor Pro and GMass Pro charge monthly fees for basic throttling. This replaces them with a fully local tool that:

- Sends with a configurable interval (default: 5 min) to avoid spam filters
- Restricts sending to specific days and times (e.g. Mon–Fri, 08:00–15:00)
- Supports unlimited custom merge fields per recipient
- Persists campaign state across restarts — resume exactly where you left off

---

## Features

| Feature | Details |
|---|---|
| **Sheet Import** | `.xlsx`, `.xls`, `.csv` — first row auto-detected as headers |
| **Merge Fields** | `{{first_name}}`, `{{college}}`, any column — live preview per row |
| **Sending Interval** | 1–60 min slider, default 5 min, ±30s random jitter |
| **Daily Window** | Only sends between configured start/end times |
| **Day-of-Week Control** | Toggle any combination of Mon–Sun |
| **Scheduled Start** | Queue a campaign to begin at a future date/time |
| **Crash Recovery** | Queue state written to disk after every send |
| **Duplicate Detection** | Second occurrence of same email auto-skipped |
| **Send Logs** | Per-campaign JSON log, exportable as CSV |
| **Gmail OAuth** | Tokens stored locally, auto-refreshed — no SMTP ports |

---

## Screenshots

```
┌─────────────────────────────────────────────────────────────┐
│  Smart Mail   │  Dashboard                                   │
│  Merger       │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│               │  │  124     │ │   2      │ │   8      │    │
│  Dashboard    │  │  Sent    │ │ Running  │ │ Completed│    │
│  Import Sheet │  └──────────┘ └──────────┘ └──────────┘    │
│  Template     │                                              │
│  Schedule     │  Campaign Name          Status   Progress   │
│  Monitor      │  Prof Outreach Jun 26   Running  ████░ 68% │
│  Logs         │  Recruiter Blast May    Completed ████ 100% │
│  Settings     │                                              │
│               │                    [+ New Campaign]         │
│  ● connected  │                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop wrapper | Electron 29 |
| Build toolchain | electron-vite + Vite 5 |
| Frontend | React 18 + Tailwind CSS 3 |
| Email API | Gmail API via `googleapis` |
| Sheet parsing | SheetJS (`xlsx`) |
| State persistence | `electron-store` |
| Auth storage | `electron-store` (encrypted) |

---

## Prerequisites

```
Node.js >= 18
npm >= 9
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/parth-garg01/mail_merge.git
cd mail_merge
npm install
```

### 2. Create Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API** under APIs & Services → Library
4. Go to APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**
5. Select **Desktop App** as the application type
6. Add `http://localhost:3000/oauth2callback` as an authorized redirect URI
7. Copy the **Client ID** and **Client Secret**

### 3. Configure environment (optional)

```bash
cp .env.example .env
# Edit .env and fill in your credentials
```

Or enter credentials directly in the app under **Settings**.

### 4. Run in development

```bash
npm run dev
```

### 5. Build for distribution

```bash
npm run build:win    # Windows (.exe)
npm run build:mac    # macOS (.dmg)
```

---

## Usage

### Creating a Campaign

1. **Settings** → Paste your Google Client ID and Secret → **Save** → **Connect Gmail**
2. **Import Sheet** → Click to select your `.xlsx`/`.csv` file → Identify the email column
3. **Template Editor** → Write subject and body using `{{column_name}}` placeholders → Preview for each row
4. **Schedule** → Set campaign name, daily window, allowed days, and interval → **Start Campaign**
5. **Campaign Monitor** → Watch real-time progress, pause/resume anytime

### Merge Field Syntax

Any column header from your sheet becomes a merge field:

```
Dear {{first_name}},

I came across your work on {{custom_line}} at {{college}} and wanted
to reach out regarding a potential collaboration.
```

### Spreadsheet Format

| first_name | email | college | custom_line |
|---|---|---|---|
| Mausam | mausam@iitd.ac.in | IIT Delhi | your AutoMix paper |
| Partha | partha@iisc.ac.in | IISc | your work on LLM routing |

The first row is always treated as column headers. All other rows are recipients.

---

## Project Structure

```
smart-mail-merger/
├── src/
│   ├── main/                  # Electron main process (Node.js)
│   │   ├── index.js           # IPC handlers + campaign runner loop
│   │   ├── SheetParser.js     # Excel/CSV parsing via SheetJS
│   │   ├── TemplateEngine.js  # {{placeholder}} merge and validation
│   │   ├── ScheduleController.js  # Day/window/interval logic
│   │   ├── SendQueue.js       # Persistent queue with duplicate detection
│   │   ├── GmailClient.js     # OAuth 2.0 + Gmail API send
│   │   └── Logger.js          # JSON logs + CSV export
│   ├── preload/
│   │   └── index.js           # contextBridge IPC surface
│   └── renderer/              # React frontend
│       ├── index.html
│       └── src/
│           ├── App.jsx         # Root + AppContext + routing
│           ├── index.css       # Tailwind + custom component classes
│           ├── components/
│           │   ├── Sidebar.jsx
│           │   ├── StatusBadge.jsx
│           │   └── ProgressBar.jsx
│           └── pages/
│               ├── Dashboard.jsx
│               ├── ImportSheet.jsx
│               ├── TemplateEditor.jsx
│               ├── ScheduleConfig.jsx
│               ├── CampaignMonitor.jsx
│               ├── Logs.jsx
│               └── Settings.jsx
├── electron.vite.config.mjs
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Scheduling Logic

```js
// Sends only when all three conditions are true:
function shouldSendNow(config) {
  const day  = // 'Mon', 'Tue', ...
  const time = // 'HH:MM'
  if (!config.allowedDays.includes(day)) return false
  if (time < config.windowStart || time >= config.windowEnd) return false
  return true
}
```

When outside the window, the runner calculates the exact milliseconds until the next valid window opens and sleeps precisely until then — no wasted polling.

---

## Gmail Limits & Spam Safety

| Setting | Value | Why |
|---|---|---|
| Default interval | 5 minutes | Well within Gmail's 250 quota units/user/sec |
| Default window | 08:00–15:00 | Business hours only |
| Default days | Mon–Fri | Avoids weekend spam signals |
| Jitter | ±30 seconds | Prevents metronomic send pattern detection |

Gmail's personal account limit is ~500 emails/day. For large campaigns, use a Google Workspace account (2,000/day).

---

## Roadmap

- [x] Phase 1 — Core MVP (Gmail OAuth, Excel import, template merge, interval send)
- [x] Phase 2 — Scheduling (start time, daily window, day-of-week, crash recovery)
- [x] Phase 3 — UI (dashboard, monitor, logs, live preview)
- [ ] Phase 4 — Follow-up sequences and open/click tracking

---

## License

MIT — free to use, modify, and distribute.

---

*Built by [Parth Garg](https://github.com/parth-garg01), VIT Vellore*
