(function () {
  const nameInput = document.getElementById('nameInput');
  const assigneeSelect = document.getElementById('assigneeSelect');
  const refreshAssigneesBtn = document.getElementById('refreshAssigneesBtn');
  const prioritySelect = document.getElementById('prioritySelect');
  const descInput = document.getElementById('descInput');
  const submitBtn = document.getElementById('submitBtn');
  const submitLabel = document.getElementById('submitLabel');
  const submitSpinner = document.getElementById('submitSpinner');
  const hotkeyHint = document.getElementById('hotkeyHint');
  const toast = document.getElementById('toast');

  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const webhookInput = document.getElementById('webhookInput');
  const tokenInput = document.getElementById('tokenInput');
  const submitterInput = document.getElementById('submitterInput');
  const hotkeyInput = document.getElementById('hotkeyInput');
  const recordBtn = document.getElementById('recordBtn');
  const startupCheckbox = document.getElementById('startupCheckbox');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsMsg = document.getElementById('settingsMsg');

  let currentAccelerator = 'Control+Shift+Return';
  let pendingAccelerator = null;
  let isRecording = false;
  let toastTimer = null;

  function humanize(acc) {
    return (acc || '')
      .replace('Control', 'Ctrl')
      .replace('Return', 'Enter')
      .split('+')
      .join(' + ');
  }

  function showToast(message, type) {
    toast.textContent = message;
    toast.className = 'toast ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  }

  async function loadSettings() {
    const cfg = await window.api.getSettings();
    currentAccelerator = cfg.accelerator;
    hotkeyHint.textContent = humanize(cfg.accelerator);
    webhookInput.value = cfg.webhookUrl || '';
    tokenInput.value = cfg.secretToken || '';
    submitterInput.value = cfg.submitterLabel || '';
    hotkeyInput.value = humanize(cfg.accelerator);
    startupCheckbox.checked = !!cfg.startAtLogin;

    // First run / incomplete setup: open settings automatically so the
    // user sets their name and the webhook before trying to submit.
    if (!cfg.submitterLabel || !cfg.webhookUrl) {
      openSettings();
    }
  }

  function openSettings() {
    settingsMsg.classList.add('hidden');
    hotkeyInput.value = humanize(currentAccelerator);
    pendingAccelerator = null;
    settingsOverlay.classList.remove('hidden');
  }

  function closeSettings() {
    stopRecording();
    settingsOverlay.classList.add('hidden');
  }

  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // ---------- Hotkey recording ----------
  function mainKeyName(e) {
    const modifierCodes = [
      'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight',
      'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'
    ];
    if (modifierCodes.includes(e.code)) return null;

    const namedKeys = {
      Enter: 'Return',
      Escape: 'Escape',
      ' ': 'Space',
      Tab: 'Tab',
      Backspace: 'Backspace',
      Delete: 'Delete',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown'
    };
    if (namedKeys[e.key] !== undefined) return namedKeys[e.key];
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) return e.key;
    if (/^[a-zA-Z]$/.test(e.key)) return e.key.toUpperCase();
    if (/^[0-9]$/.test(e.key)) return e.key;
    if (e.key.length === 1) return e.key;
    return null;
  }

  function eventToAccelerator(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    const key = mainKeyName(e);
    if (!key || parts.length === 0) return null;
    parts.push(key);
    return parts.join('+');
  }

  function onRecordKeydown(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      stopRecording();
      hotkeyInput.value = humanize(currentAccelerator);
      return;
    }

    const acc = eventToAccelerator(e);
    if (!acc) return; // just a modifier, wait for a full combo

    pendingAccelerator = acc;
    hotkeyInput.value = humanize(acc);
    stopRecording();
  }

  function startRecording() {
    isRecording = true;
    recordBtn.textContent = 'در حال ضبط... (Esc لغو)';
    recordBtn.classList.add('recording');
    hotkeyInput.value = 'کلیدها را فشار دهید...';
    window.addEventListener('keydown', onRecordKeydown, true);
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    recordBtn.textContent = 'ضبط';
    recordBtn.classList.remove('recording');
    window.removeEventListener('keydown', onRecordKeydown, true);
  }

  recordBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
      hotkeyInput.value = humanize(currentAccelerator);
    } else {
      startRecording();
    }
  });

  // ---------- Assignees (مسئول اجرا) ----------
  function populateAssignees(members, preserveValue) {
    const previousValue = preserveValue !== undefined ? preserveValue : assigneeSelect.value;
    assigneeSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— انتخاب کنید —';
    assigneeSelect.appendChild(placeholder);

    (members || []).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      assigneeSelect.appendChild(opt);
    });

    if (previousValue && members && members.includes(previousValue)) {
      assigneeSelect.value = previousValue;
    }
  }

  async function loadAssignees() {
    const cached = await window.api.getAssignees();
    populateAssignees(cached);
    // Refresh quietly in the background so the list stays current
    // without blocking the window from opening.
    refreshAssignees(true);
  }

  async function refreshAssignees(silent) {
    if (!silent) {
      refreshAssigneesBtn.disabled = true;
      refreshAssigneesBtn.classList.add('spinning');
    }
    const result = await window.api.refreshAssignees();
    if (!silent) {
      refreshAssigneesBtn.disabled = false;
      refreshAssigneesBtn.classList.remove('spinning');
    }
    if (result.success) {
      populateAssignees(result.members);
      if (!silent) showToast('لیست مسئولین به‌روزرسانی شد.', 'success');
    } else if (!silent) {
      showToast(result.message || 'به‌روزرسانی لیست ناموفق بود.', 'error');
    }
  }

  refreshAssigneesBtn.addEventListener('click', () => refreshAssignees(false));

  // ---------- Save settings ----------
  saveSettingsBtn.addEventListener('click', async () => {
    settingsMsg.classList.add('hidden');
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'در حال ذخیره...';

    const payload = {
      webhookUrl: webhookInput.value,
      secretToken: tokenInput.value,
      submitterLabel: submitterInput.value,
      startAtLogin: startupCheckbox.checked
    };
    if (pendingAccelerator) {
      payload.accelerator = pendingAccelerator;
    }

    const result = await window.api.saveSettings(payload);

    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = 'ذخیره';

    if (result.success) {
      currentAccelerator = result.config.accelerator;
      hotkeyHint.textContent = humanize(currentAccelerator);
      pendingAccelerator = null;
      settingsMsg.textContent = 'تنظیمات ذخیره شد.';
      settingsMsg.className = 'settings-msg success';
      settingsMsg.classList.remove('hidden');
      refreshAssignees(true);
      setTimeout(closeSettings, 900);
    } else {
      settingsMsg.textContent = result.message || 'ذخیره تنظیمات ناموفق بود.';
      settingsMsg.className = 'settings-msg error';
      settingsMsg.classList.remove('hidden');
    }
  });

  // ---------- Submit entry ----------
  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
      showToast('نام را وارد کنید.', 'error');
      nameInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitLabel.textContent = 'در حال ارسال...';
    submitSpinner.classList.remove('hidden');

    const result = await window.api.submitEntry({
      name,
      description,
      assignee: assigneeSelect.value,
      priority: prioritySelect.value
    });

    submitBtn.disabled = false;
    submitLabel.textContent = 'ثبت در گوگل شیت';
    submitSpinner.classList.add('hidden');

    if (result.success) {
      showToast('با موفقیت ثبت شد ✅', 'success');
      nameInput.value = '';
      descInput.value = '';
      assigneeSelect.value = '';
      prioritySelect.value = 'متوسط';
      nameInput.focus();
    } else {
      showToast(result.message || 'ثبت ناموفق بود.', 'error');
    }
  });

  descInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      submitBtn.click();
    }
  });

  loadSettings();
  loadAssignees();
})();
