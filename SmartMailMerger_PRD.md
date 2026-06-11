# Smart Mail Merger — Product Requirements Document

**Author:** Parth Garg, VIT Vellore
**Version:** 1.0
**Status:** Draft
**Last Updated:** June 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Technical Architecture](#5-technical-architecture)
6. [Key User Flows](#6-key-user-flows)
7. [Data Model](#7-data-model)
8. [UI Screens](#8-ui-screens)
9. [Milestones & Phases](#9-milestones--phases)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Environment & Setup Notes for Developers](#12-environment--setup-notes-for-developers)
13. [Git Commit Protocol](#13-git-commit-protocol)

---

## 1. Product Overview

### 1.1 Purpose

Smart Mail Merger is a standalone desktop or web application that automates personalized email outreach campaigns. It imports recipient data from an Excel sheet, merges custom fields into email templates, and sends emails through Gmail with full control over sending intervals, daily schedules, and day-of-week restrictions.

This product is built to replace paid services like Mailmeteor Pro and GMass Pro for users who need interval-controlled, fully personalized bulk email without subscription costs.

### 1.2 Problem Statement

Existing free email merge tools either:

- Do not support sending intervals (all emails fire at once, triggering spam filters)
- Do not allow scheduling by time of day or day of week
- Require expensive monthly subscriptions for basic throttling features
- Do not support fully custom merge fields beyond just first name

This product solves all four problems in a single free, self-hosted tool.

### 1.3 Goals

- Import any Excel or Google Sheets file as the data source
- Support unlimited custom merge fields per recipient
- Send emails with a configurable interval (default: 5 minutes between each email)
- Schedule the campaign to start at a specific time and date
- Restrict sending to specific days of the week (e.g., Monday through Friday only)
- Automatically pause and resume across sessions if the campaign spans multiple days
- Log sent status, timestamps, and errors back into the source sheet

### 1.4 Non-Goals

- This product does not build its own SMTP server
- This product does not track email opens or link clicks (Phase 1)
- This product does not support non-Gmail providers in Phase 1
- This product does not manage unsubscribe lists automatically in Phase 1

---

## 2. User Personas

| Persona | Description | Primary Need |
|---|---|---|
| Research Student | B.Tech / M.Tech student reaching out to professors for collaboration | Send 200+ personalized cold emails without being marked as spam |
| Job Seeker | Recent graduate sending outreach to recruiters and hiring managers | Personalize each email with company name and role without manual effort |
| Startup Founder | Founder doing cold sales outreach to potential customers or investors | Schedule campaigns during business hours and avoid weekends |
| Academic Researcher | PhD student contacting collaborators at other universities | Personalize with each recipient's recent paper or research area |

---

## 3. Functional Requirements

### 3.1 Excel / Sheet Import

#### FR-1: File Import

- The app must accept `.xlsx`, `.xls`, and `.csv` file uploads
- The app must also support linking directly to a Google Sheets URL
- On import, the app parses the first row as column headers (merge field names)
- All subsequent rows are treated as individual recipient records

#### FR-2: Column Mapping

- The app must display all detected column headers to the user
- The user must be able to map any column to any merge placeholder
- Required column: `email` (the recipient address column must be identified)
- All other columns are optional custom fields

> **Note:** Example columns: `first_name`, `full_name`, `email`, `college`, `recent_paper`, `custom_line`. All become available as `{{first_name}}`, `{{college}}` etc. in the template.

---

### 3.2 Email Template

#### FR-3: Template Editor

- The app must provide a rich text or plain text editor for the email body
- The subject line must also support merge field placeholders
- Merge fields use double-brace syntax: `{{column_name}}`
- A live preview panel must show the rendered output for a selected row
- The user must be able to save and reload templates

#### FR-4: Merge Field Validation

- Before sending, the app checks that all `{{placeholders}}` in the template exist as columns in the imported sheet
- Any unmatched placeholder triggers a warning with the option to proceed or cancel
- Empty merge field values in a row are replaced with a blank string, not the placeholder literal

---

### 3.3 Sending Interval

#### FR-5: Interval Control

- The user must be able to set a sending interval in minutes (minimum: 1 minute, maximum: 60 minutes)
- Default interval is **5 minutes**
- The interval applies between every consecutive email sent
- The app must display a countdown timer showing when the next email will be sent

#### FR-6: Interval Persistence

- If the app is closed mid-campaign, the interval and queue state must be saved to disk
- On relaunch, the app resumes from where it left off

---

### 3.4 Schedule Control

#### FR-7: Start Time

- The user must be able to set a specific date and time for the campaign to begin
- If the start time is in the future, the app queues the campaign and waits
- Default: send immediately on confirmation

#### FR-8: Daily Sending Window

- The user must be able to set a daily start time and end time (e.g., `08:00` to `15:00`)
- The app must not send any email outside this window
- If a send would fall outside the window, the app waits until the next valid window opens

#### FR-9: Day of Week Control

- The user must be able to select which days of the week are allowed for sending
- Default: **Monday through Friday only**
- Saturday and Sunday are excluded by default
- The app must skip non-allowed days automatically and resume on the next allowed day

---

### 3.5 Gmail Authentication

#### FR-10: OAuth 2.0 Login

- The app must authenticate with Gmail via Google OAuth 2.0
- The user logs in once and the token is stored securely for future sessions
- The app uses the Gmail API (not SMTP) to send emails to avoid port blocking
- Required OAuth scope: `https://www.googleapis.com/auth/gmail.send`

---

### 3.6 Campaign Management

#### FR-11: Queue View

- The app must show a list of all recipients with their send status: `Pending`, `Sent`, `Failed`, `Skipped`
- The user must be able to pause and resume the campaign at any time
- The user must be able to remove individual recipients from the queue before sending

#### FR-12: Progress Tracking

- The app displays: total recipients, sent count, remaining count, estimated completion time
- A progress bar updates in real time as emails are sent

---

### 3.7 Logging

#### FR-13: Send Log

- After each send attempt, the app logs: recipient email, timestamp, status (success/fail), error message if any
- The log must be exportable as a CSV file
- The app must write sent status back to a new column in the original sheet (if editing is permitted)

#### FR-14: Duplicate Prevention

- The app tracks which email addresses have been sent to in the current campaign
- If a duplicate email address appears in the sheet, the second occurrence is marked `Skipped` by default
- The user can override this behavior to allow duplicates

---

## 4. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | App must load a 1000-row Excel file in under 3 seconds | < 3s load time |
| Reliability | Campaign state must survive app crash or system sleep | Zero lost queue items |
| Security | OAuth tokens stored in encrypted local storage, never in plaintext | AES-256 encryption |
| Usability | Non-technical user can set up and start a campaign in under 10 minutes | < 10 min setup |
| Compatibility | Works on Windows 10+, macOS 12+, and modern Chromium browsers | Cross-platform |
| Spam Safety | Default interval and sending window designed to avoid Gmail spam flags | 5 min interval, weekday-only |

---

## 5. Technical Architecture

### 5.1 Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend / UI | React + Tailwind CSS (Electron wrapper for desktop) | Cross-platform desktop app with web tech |
| Backend / Logic | Node.js | Native Google API libraries, async scheduling |
| Email API | Gmail API via `googleapis` npm package | Official API, no SMTP port issues |
| Sheet Parsing | SheetJS (`xlsx` npm package) | Handles .xlsx, .xls, .csv without a server |
| Scheduling | `node-cron` + custom interval queue | Precise time-based triggering |
| State Persistence | JSON file on disk (or SQLite) | Survive crashes and restarts |
| Auth Storage | `keytar` (OS keychain) or `electron-store` encrypted | Secure token storage |

### 5.2 Core Modules

| Module | Responsibility |
|---|---|
| `SheetParser` | Reads Excel/CSV, extracts headers and rows, validates email column |
| `TemplateEngine` | Parses `{{placeholders}}`, merges values per row, validates fields |
| `ScheduleController` | Manages start time, daily window, day-of-week filter, interval timer |
| `SendQueue` | Ordered list of pending recipients with status tracking and persistence |
| `GmailClient` | OAuth 2.0 auth, token refresh, send via Gmail API, error handling |
| `Logger` | Writes per-send log to disk and optionally back to sheet |
| `UILayer` | React components for import, template editor, schedule config, queue view |

### 5.3 Scheduling Logic

```js
function shouldSendNow(config) {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short' }); // 'Mon', 'Tue' etc.
  const time = now.toTimeString().slice(0, 5); // 'HH:MM'

  if (!config.allowedDays.includes(day)) return false;
  if (time < config.windowStart || time >= config.windowEnd) return false;
  return true;
}

async function runCampaign(queue, config) {
  while (queue.hasPending()) {
    if (shouldSendNow(config)) {
      const recipient = queue.next();
      const result = await gmailClient.send(recipient);
      logger.log(recipient, result);
      await sleep(config.intervalMinutes * 60 * 1000);
    } else {
      await sleep(untilNextValidWindow(config));
    }
  }
}
```

### 5.4 Gmail API Send Example

```js
const { google } = require('googleapis');

async function sendEmail(auth, to, subject, body) {
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = createRawMessage(to, subject, body); // base64url encoded
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });
}
```

### 5.5 Template Merge Example

```js
function mergeTemplate(template, fields) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return fields[key] !== undefined ? fields[key] : '';
  });
}

// Usage:
const body = mergeTemplate(
  "Dear {{first_name}}, given {{custom_line}}...",
  { first_name: "Mausam", custom_line: "your AutoMix paper..." }
);
```

---

## 6. Key User Flows

### 6.1 Campaign Setup Flow

1. User opens app and clicks **Connect Gmail**. OAuth window opens, user grants permission.
2. User clicks **Import Sheet** and selects their `.xlsx` file. App parses headers and shows column list.
3. User identifies the `email` column. All other columns are available as merge fields automatically.
4. User opens the **Template Editor**, pastes their email body with `{{placeholders}}`. Live preview renders for the first row.
5. User sets schedule: start date/time, daily window (e.g., `08:00` to `15:00`), allowed days (Mon–Fri), interval (5 min).
6. User clicks **Start Campaign**. App queues all rows and begins sending at the scheduled time.
7. User monitors the **Queue View** with live progress. Can pause, skip rows, or stop at any time.

### 6.2 Resume After Restart Flow

1. App detects saved campaign state on launch.
2. User is shown: X emails sent, Y remaining, next scheduled send at [time].
3. User clicks **Resume**. App picks up from the next pending recipient.

### 6.3 Follow-up Flow (Phase 4)

1. After a configurable number of days (e.g., 3 working days), the app checks which recipients have not replied.
2. App sends a follow-up email using a separate follow-up template.
3. If a reply is detected (via Gmail API labels), the recipient is marked `Replied` and excluded from follow-ups.

---

## 7. Data Model

### 7.1 Campaign Config

```json
{
  "id": "uuid-string",
  "name": "Professor Outreach - June 2026",
  "sheetPath": "/path/to/sheet.xlsx",
  "emailColumn": "email",
  "subjectTemplate": "Collaboration Request on Hybrid Transformer-Mamba Research",
  "bodyTemplate": "Dear {{first_name}}, given {{custom_line}}...",
  "schedule": {
    "startAt": "2026-06-12T08:00:00",
    "windowStart": "08:00",
    "windowEnd": "15:00",
    "allowedDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "intervalMinutes": 5
  },
  "status": "running",
  "createdAt": "2026-06-11T22:00:00",
  "updatedAt": "2026-06-12T09:35:00"
}
```

### 7.2 Recipient Record

```json
{
  "rowIndex": 3,
  "email": "mausam@cse.iitd.ac.in",
  "fields": {
    "first_name": "Mausam",
    "full_name": "Prof. Mausam",
    "college": "IIT Delhi",
    "custom_line": "your AutoMix paper on dynamically mixing language models..."
  },
  "status": "sent",
  "sentAt": "2026-06-12T08:05:00",
  "errorMessage": null
}
```

### 7.3 Recipient Status Values

| Status | Meaning |
|---|---|
| `pending` | Not yet sent |
| `sent` | Successfully delivered to Gmail API |
| `failed` | API returned an error; will retry once |
| `skipped` | Duplicate email or manually removed by user |
| `replied` | Reply detected (Phase 4 only) |

---

## 8. UI Screens

### 8.1 Screen List

| Screen | Purpose | Key Components |
|---|---|---|
| Dashboard | Campaign overview and quick actions | Campaign list, Create New button, status badges |
| Import Sheet | Upload and map Excel columns | File picker, column list, email column selector, row preview table |
| Template Editor | Write subject and body with merge fields | Subject input, body editor, merge field chip inserter, live preview pane |
| Schedule Config | Set all timing parameters | Date/time picker, window start/end time inputs, day-of-week checkboxes, interval slider |
| Campaign Monitor | Real-time queue view during sending | Progress bar, countdown timer, recipient status table, pause/stop buttons |
| Logs | View and export send history | Filterable log table, export CSV button, error details modal |
| Settings | Gmail account and app preferences | Connected account display, revoke token button, default schedule presets |

### 8.2 Schedule Config Screen — Field Spec

```
Start Date & Time    [Date Picker]  [Time Picker]
Daily Window         From [08:00]   To [15:00]
Allowed Days         [x] Mon  [x] Tue  [x] Wed  [x] Thu  [x] Fri  [ ] Sat  [ ] Sun
Sending Interval     [5] minutes between each email
                     ← slider: 1 min ────────────── 60 min →
```

---

## 9. Milestones & Phases

| Phase | Name | Deliverables | Duration |
|---|---|---|---|
| Phase 1 | Core MVP | Gmail OAuth, Excel import, template merge, manual send with interval | 3 weeks |
| Phase 2 | Scheduling | Start time, daily window, day-of-week filter, queue persistence across restarts | 2 weeks |
| Phase 3 | UI Polish | Full dashboard, campaign monitor screen, logs screen, live merge preview | 2 weeks |
| Phase 4 | Advanced Features | Open/click tracking, follow-up sequences, multi-account support | 3 weeks |

**Total estimated timeline: 10 weeks**

---

## 10. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Gmail API rate limits (250 quota units/user/second) | High | 5-minute interval keeps usage well within limits. Add exponential backoff on 429 errors. |
| Gmail spam detection on bulk sends | High | Enforce interval, weekday-only window, and personalized bodies. Never send identical emails. |
| OAuth token expiry mid-campaign | Medium | Auto-refresh token before each send. Prompt re-auth if refresh fails. |
| Excel file format edge cases (.xls, merged cells) | Medium | Use SheetJS with strict parsing. Show validation errors before campaign starts. |
| User closes app mid-campaign | Low | Persist queue state to disk after every send. Resume on next launch automatically. |
| Gmail account flagged for unusual activity | Medium | Keep interval at 5+ minutes. Add a randomized jitter of ±30 seconds per send. |

---

## 11. Acceptance Criteria

| ID | Criteria |
|---|---|
| AC-1 | A user can import a 200-row Excel file and see all rows in the queue within 5 seconds |
| AC-2 | A template with 5 custom merge fields renders correctly for every row with no unfilled placeholders |
| AC-3 | Emails are sent no faster than the configured interval under any circumstances |
| AC-4 | No email is sent outside the configured daily time window or on a non-allowed day |
| AC-5 | If the app is force-closed, relaunching resumes from the exact next unsent recipient |
| AC-6 | All sent emails appear with correct personalization in the Gmail Sent folder |
| AC-7 | The log exports as a valid CSV with correct timestamps and statuses for all rows |
| AC-8 | A non-technical user completes full setup (import, template, schedule, send) in under 10 minutes |

---

## 12. Environment & Setup Notes for Developers

### Prerequisites

```bash
node >= 18
npm >= 9
```

### Key Dependencies

```bash
npm install googleapis xlsx node-cron electron electron-store keytar react tailwindcss
```

### Google Cloud Setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Gmail API**
3. Create OAuth 2.0 credentials (Desktop App type)
4. Download `credentials.json` and place in project root
5. Add `http://localhost` as an authorized redirect URI

### Environment Variables

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

---

---

## 13. Git Commit Protocol

> **This section is a mandatory instruction for any AI IDE (Cursor, Windsurf, GitHub Copilot, etc.) working on this project. Every feature addition, bug fix, or configuration change must be committed to GitHub before moving to the next task.**

### 13.1 Rule

After completing every feature, sub-feature, or meaningful code change, the AI IDE must:

1. Stage all changed files
2. Write a descriptive commit message following the convention below
3. Push to the remote GitHub repository

No feature should be left uncommitted. If a feature spans multiple files, all related files must be committed together in a single atomic commit.

### 13.2 Commit Message Convention

Use the following format for every commit:

```
<type>(<scope>): <short description>

<optional body — what was done and why>
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature or user-facing functionality |
| `fix` | A bug fix |
| `chore` | Setup, config, dependency changes |
| `refactor` | Code restructure with no behavior change |
| `style` | UI/CSS changes only |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |

**Examples:**

```bash
feat(sheet-parser): add Excel and CSV import with header detection

feat(template-engine): implement {{placeholder}} merge with validation

feat(schedule-controller): add daily window and day-of-week filtering

feat(send-queue): persist queue state to disk for crash recovery

feat(gmail-client): OAuth 2.0 login and token refresh via Gmail API

feat(logger): write send log to CSV and update status in source sheet

feat(ui): add campaign monitor screen with live progress bar

fix(schedule-controller): prevent send outside daily window on DST change

chore: add googleapis, xlsx, node-cron, electron dependencies
```

### 13.3 Commit Triggers — When to Commit

The AI IDE must commit after each of the following:

- [ ] Project scaffolding and initial setup complete
- [ ] `SheetParser` module complete (FR-1, FR-2)
- [ ] `TemplateEngine` module complete (FR-3, FR-4)
- [ ] `ScheduleController` module complete (FR-7, FR-8, FR-9)
- [ ] `SendQueue` with persistence complete (FR-5, FR-6)
- [ ] `GmailClient` OAuth and send complete (FR-10)
- [ ] `Logger` module complete (FR-13, FR-14)
- [ ] Campaign management UI complete (FR-11, FR-12)
- [ ] Dashboard screen complete
- [ ] Import Sheet screen complete
- [ ] Template Editor screen complete
- [ ] Schedule Config screen complete
- [ ] Campaign Monitor screen complete
- [ ] Logs screen complete
- [ ] Settings screen complete
- [ ] End-to-end integration test passing
- [ ] Each Phase milestone completed (Phase 1, 2, 3, 4)
- [ ] Any bug fix, however small

### 13.4 Git Setup Commands

Run these once at project start:

```bash
git init
git remote add origin https://github.com/<your-username>/smart-mail-merger.git
git branch -M main
```

### 13.5 Standard Commit Commands

The AI IDE must run these after every feature:

```bash
git add .
git commit -m "feat(<scope>): <description>"
git push origin main
```

### 13.6 Branch Strategy (Recommended)

| Branch | Purpose |
|---|---|
| `main` | Stable, working code only |
| `dev` | Active development branch |
| `feature/<name>` | Individual feature branches (optional for larger features) |

For solo development, committing directly to `main` is acceptable as long as every commit is atomic and the code is working at the time of commit.

### 13.7 .gitignore

The following must be excluded from all commits:

```gitignore
node_modules/
.env
credentials.json
token.json
*.log
dist/
build/
.DS_Store
Thumbs.db
```

---

*Smart Mail Merger PRD | Parth Garg, VIT Vellore | v1.0 | June 2026*
