const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_ACCELERATOR = 'Control+Shift+Return';
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

let mainWindow = null;
let tray = null;
let currentConfig = null;

// ---------- Config ----------
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Object.assign(
      {
        accelerator: DEFAULT_ACCELERATOR,
        webhookUrl: '',
        secretToken: '',
        startAtLogin: true,
        submitterLabel: '',
        assignees: [],
        stats: { total: 0, done: 0, notDone: 0 }
      },
      parsed
    );
  } catch (e) {
    return {
      accelerator: DEFAULT_ACCELERATOR,
      webhookUrl: '',
      secretToken: '',
      startAtLogin: true,
      submitterLabel: '',
      assignees: [],
      stats: { total: 0, done: 0, notDone: 0 }
    };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  currentConfig = cfg;
}

// ---------- Window ----------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 800,
    useContentSize: true,
    resizable: false,
    center: true,
    show: false,
    autoHideMenuBar: true,
    title: 'Our Tasks',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Instead of quitting, hide the window when the user closes it,
  // so the app keeps running in the tray and the hotkey keeps working.
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    mainWindow.once('ready-to-show', () => mainWindow.show());
    return;
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    mainWindow.once('ready-to-show', () => mainWindow.show());
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

// ---------- Global shortcut ----------
function registerShortcut(accelerator) {
  globalShortcut.unregisterAll();
  try {
    const ok = globalShortcut.register(accelerator, () => {
      toggleWindow();
    });
    return ok;
  } catch (e) {
    return false;
  }
}

// ---------- Tray ----------
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    image = nativeImage.createEmpty();
  }
  tray = new Tray(image);
  tray.setToolTip('Our Tasks');
  updateTrayMenu();
  tray.on('click', () => showWindow());
}

function updateTrayMenu() {
  const cfg = currentConfig || loadConfig();
  const menu = Menu.buildFromTemplate([
    { label: 'باز کردن فرم', click: () => showWindow() },
    { label: `کلید میانبر: ${humanizeAccelerator(cfg.accelerator)}`, enabled: false },
    { type: 'separator' },
    {
      label: 'اجرا در استارتاپ ویندوز',
      type: 'checkbox',
      checked: cfg.startAtLogin,
      click: (item) => {
        cfg.startAtLogin = item.checked;
        saveConfig(cfg);
        applyLoginItemSettings(cfg.startAtLogin);
      }
    },
    { type: 'separator' },
    {
      label: 'خروج',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

function humanizeAccelerator(acc) {
  return (acc || '').replace('Control', 'Ctrl').replace('Return', 'Enter').replace(/\+/g, ' + ');
}

// ---------- Auto start ----------
function applyLoginItemSettings(enabled) {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
}

// ---------- HTTP POST with redirect following (Google Apps Script) ----------
function postJson(targetUrl, payload, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(targetUrl);
    } catch (e) {
      reject(new Error('آدرس وب‌هوک نامعتبر است.'));
      return;
    }

    const body = JSON.stringify(payload);
    const lib = urlObj.protocol === 'http:' ? http : https;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = lib.request(options, (res) => {
      // Google Apps Script sometimes responds with a redirect to the actual result.
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        maxRedirects > 0
      ) {
        res.resume();
        const nextUrl = new URL(res.headers.location, urlObj).toString();
        followGet(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`سرور خطای ${res.statusCode} برگرداند.`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function followGet(targetUrl, maxRedirects) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const lib = urlObj.protocol === 'http:' ? http : https;
    const req = lib.get(targetUrl, (res) => {
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        maxRedirects > 0
      ) {
        res.resume();
        const nextUrl = new URL(res.headers.location, urlObj).toString();
        followGet(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`سرور خطای ${res.statusCode} برگرداند.`));
        }
      });
    });
    req.on('error', reject);
  });
}

function getJson(targetUrl) {
  let urlObj;
  try {
    urlObj = new URL(targetUrl);
  } catch (e) {
    return Promise.reject(new Error('آدرس وب‌هوک نامعتبر است.'));
  }
  return followGet(urlObj.toString(), 5);
}

// ---------- IPC ----------
ipcMain.handle('get-settings', () => {
  const cfg = currentConfig || loadConfig();
  return cfg;
});

ipcMain.handle('save-settings', (event, newSettings) => {
  const cfg = currentConfig || loadConfig();

  if (newSettings.accelerator && newSettings.accelerator !== cfg.accelerator) {
    const ok = registerShortcut(newSettings.accelerator);
    if (!ok) {
      return { success: false, message: 'این ترکیب کلید توسط برنامه دیگری استفاده می‌شود یا نامعتبر است.' };
    }
    cfg.accelerator = newSettings.accelerator;
  }

  if (typeof newSettings.webhookUrl === 'string') {
    cfg.webhookUrl = newSettings.webhookUrl.trim();
  }
  if (typeof newSettings.secretToken === 'string') {
    cfg.secretToken = newSettings.secretToken.trim();
  }
  if (typeof newSettings.startAtLogin === 'boolean') {
    cfg.startAtLogin = newSettings.startAtLogin;
    applyLoginItemSettings(cfg.startAtLogin);
  }
  if (typeof newSettings.submitterLabel === 'string') {
    cfg.submitterLabel = newSettings.submitterLabel.trim();
  }

  saveConfig(cfg);
  updateTrayMenu();
  return { success: true, config: cfg };
});

ipcMain.handle('submit-entry', async (event, entry) => {
  const cfg = currentConfig || loadConfig();
  if (!cfg.webhookUrl) {
    return { success: false, message: 'آدرس گوگل شیت (وب‌هوک) هنوز تنظیم نشده. از بخش تنظیمات آن را وارد کنید.' };
  }
  if (!entry.name || !entry.name.trim()) {
    return { success: false, message: 'نام را وارد کنید.' };
  }
  if (!cfg.submitterLabel || !cfg.submitterLabel.trim()) {
    return { success: false, message: 'ابتدا «اسم ثبت‌کننده» را از بخش تنظیمات وارد کنید.' };
  }
  try {
    await postJson(cfg.webhookUrl, {
      name: entry.name.trim(),
      description: (entry.description || '').trim(),
      token: cfg.secretToken || '',
      submittedBy: cfg.submitterLabel.trim(),
      assignee: (entry.assignee || '').trim(),
      priority: entry.priority || '',
      status: entry.done ? 'انجام شده' : 'انجام نشده'
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: 'ارسال به گوگل شیت ناموفق بود: ' + err.message };
  }
});

ipcMain.handle('get-assignees', () => {
  const cfg = currentConfig || loadConfig();
  return cfg.assignees || [];
});

ipcMain.handle('get-stats', () => {
  const cfg = currentConfig || loadConfig();
  return cfg.stats || { total: 0, done: 0, notDone: 0 };
});

ipcMain.handle('refresh-data', async () => {
  const cfg = currentConfig || loadConfig();
  if (!cfg.webhookUrl) {
    return { success: false, message: 'ابتدا آدرس وب‌هوک را از تنظیمات وارد کنید.' };
  }
  try {
    const raw = await getJson(cfg.webhookUrl);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error('پاسخ نامعتبر از Apps Script دریافت شد.');
    }
    const members = Array.isArray(parsed.members) ? parsed.members : [];
    const stats = parsed.stats && typeof parsed.stats === 'object'
      ? {
          total: Number(parsed.stats.total) || 0,
          done: Number(parsed.stats.done) || 0,
          notDone: Number(parsed.stats.notDone) || 0
        }
      : { total: 0, done: 0, notDone: 0 };
    cfg.assignees = members;
    cfg.stats = stats;
    saveConfig(cfg);
    return { success: true, members, stats };
  } catch (err) {
    return { success: false, message: 'به‌روزرسانی اطلاعات ناموفق بود: ' + err.message };
  }
});

ipcMain.handle('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

// ---------- App lifecycle ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(() => {
    currentConfig = loadConfig();
    saveConfig(currentConfig); // ensure file exists with defaults on first run

    createMainWindow();
    createTray();

    const ok = registerShortcut(currentConfig.accelerator);
    if (!ok) {
      registerShortcut(DEFAULT_ACCELERATOR);
      currentConfig.accelerator = DEFAULT_ACCELERATOR;
      saveConfig(currentConfig);
    }

    applyLoginItemSettings(currentConfig.startAtLogin);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    // Keep running in tray; do not quit.
  });

  app.on('before-quit', () => {
    app.isQuiting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
