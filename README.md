# Our Tasks

[فارسی 🇮🇷](README.fa.md)

A Windows app that opens with a global hotkey (default `Ctrl+Shift+Enter`), shows a form with a "Requester Name" and "Description" field, and saves the entry straight into a Google Sheet when you click Submit.

- The hotkey can be changed from within the app.
- The app stays in the system tray (next to the clock) so the hotkey is always active.
- It can be set to launch automatically when Windows starts.
- Each user enters their own name once in Settings ("Recorder Name") so it's clear who submitted each row.
- Every entry also has an **Assignee** (picked from a shared team list), a **Priority** from 1 to 5, and a **Status** (Done / Not done).
- The main screen shows a small report at the bottom: a circular progress ring plus total / done / pending counts, read live from the Sheet.

---

## 1) Set up the Google Sheet destination (one-time)

1. Create a new Google Sheet (preferably a fresh, empty one — the column order is fixed, so it's best to start clean).
2. From the menu, open **Extensions → Apps Script**.
3. Copy the contents of `google-apps-script/Code.gs` (in this project) and paste it in place of the default code in the Apps Script editor.
4. (Optional) If you want a simple security check, fill in the `SECRET_TOKEN` value at the top of the file (e.g. a random string). Leave it empty if you don't need this.
5. Click **Deploy → New deployment**.
   - Set Type to **Web app**.
   - Set "Execute as" to **Me**.
   - Set "Who has access" to **Anyone** (so the app can send data without a Google login).
   - Click Deploy and approve the permissions.
6. Copy the generated URL (something like `https://script.google.com/macros/s/AKfycb.../exec`) — this is the "webhook URL" you'll enter in the app's settings.

On the first successful submission, the app automatically adds a header row in this order:

| Recorder Name | Requester Name | Assignee | Priority | Status | Description | Date | Time |
|---|---|---|---|---|---|---|---|

> Important: If you had previously deployed an older version of `Code.gs` (with different columns), make sure to create a new **New deployment** so the updated code runs. If your existing sheet has old columns, it's best to clear the sheet or start a new tab so the headers match the new layout.
>
> Also: the main data sheet (described above) must always be the **first tab** in your spreadsheet. Add the "اعضا" (Team) tab as a second/later tab, not the first.

### Team list for the "Assignee" dropdown

The **Assignee** field in the app is a dropdown, populated from a roster you maintain directly in the same Google Sheet — no app rebuild needed when your team changes.

1. In your Google Sheet, add a new tab and name it exactly **اعضا**.
2. In column A of that tab, list one team member's name per row (no header needed).
3. Whenever you add or remove someone, the app picks up the change automatically the next time it fetches the list, or immediately if you click the **↻** refresh button next to the Assignee dropdown.

---

## 2) Build the Windows installer (Setup.exe)

This project is built with **Electron**. To get a `Setup.exe`, use one of the two methods below:

### Method A) Build it on a Windows computer (simplest)

1. Install [Node.js](https://nodejs.org) version 18 or later.
2. Open this project's folder, open a terminal there (**Command Prompt**, not PowerShell — to avoid script-execution restrictions) and run:
   ```
   npm install
   npm run dist
   ```
3. Once it finishes, the installer will be created in the `dist` folder, named something like `Our Tasks Setup 1.0.0.exe`.
4. Copy that file to any computer you want and run it to install.

### Method B) Build automatically with GitHub Actions (no Windows machine needed)

A ready-made workflow lives at `.github/workflows/build.yml`.

1. Push this folder to a GitHub repository.
2. GitHub will automatically build the project on a Windows machine.
3. From the **Actions** tab of that repository, open the latest successful run and download the `Our-Tasks-Setup` file from **Artifacts** — that's your `.exe` installer.

---

## 3) Using the app

- After installing, the app launches and its icon appears in the system tray (next to the clock).
- Press **Ctrl+Shift+Enter** to open the form window (or click the tray icon).
- The first time you open the app, the **Settings** window opens automatically (since the webhook URL and recorder name aren't set yet). Fill in:
  - The **Google Apps Script webhook URL** from step 1.
  - **Recorder Name** — anyone using this computer should enter their own name here once. The Submit button won't work until this is filled in.
- From the same Settings panel you can also:
  - Change the hotkey by clicking **Record** and then pressing your desired key combination.
  - Enter the security code (if you set one in Apps Script).
  - Turn automatic startup with Windows on/off (default: on).
- **Priority** is picked with five numbered buttons (1 to 5) — one click, no dropdown to open (default: 3).
- **Status** is a simple on/off switch: defaults to "Not done"; turning it on records "Done" in the sheet.
- Filling in **Requester Name**, **Assignee**, **Priority**, **Status**, and **Description**, then clicking **Submit to Google Sheet**, adds a new row in this order:

  **Recorder Name | Requester Name | Assignee | Priority | Status | Description | Date | Time**

  "Recorder Name" is the value you entered in Settings (not your Windows username), and "Date"/"Time" are recorded automatically as two separate columns. The date is written in the Persian (Jalali/Shamsi) calendar, e.g. `۱۴۰۵/۰۵/۱۸`.
- The bottom of the main screen shows a small report: a circular progress ring for the percentage done, plus "Submitted" / "Done" / "Pending" counts. This is read live from the Sheet and refreshes via the **↻** button or whenever the window reopens.
- Closing the window (×) only hides it; the app stays in the tray. To fully quit, right-click the tray icon and choose **Exit**.
- The developer's name (Soran Esmaeilpouri) is shown at the bottom of the Settings window.

---

## Project structure

```
Our Tasks/
├─ main.js                  Electron main process (tray, hotkey, sends data to Google Sheets)
├─ preload.js                Secure bridge between the UI and main.js
├─ renderer/                 UI (HTML/CSS/JS)
├─ assets/                   App icons
├─ google-apps-script/Code.gs  Code to paste into Google Apps Script
├─ .github/workflows/build.yml  Builds Setup.exe automatically via GitHub Actions
└─ package.json
```
