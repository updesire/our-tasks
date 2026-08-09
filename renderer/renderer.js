(function () {
  const nameInput = document.getElementById('nameInput');
  const assigneeSelect = document.getElementById('assigneeSelect');
  const refreshAssigneesBtn = document.getElementById('refreshAssigneesBtn');
  const prioritySlider = document.getElementById('prioritySlider');
  const priorityFill = document.getElementById('priorityFill');
  const priorityThumb = document.getElementById('priorityThumb');
  const statusRow = document.getElementById('statusRow');
  const statusCheckbox = document.getElementById('statusCheckbox');
  const statusValueText = document.getElementById('statusValueText');
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
  let selectedPriority = '3';

  // ---------- Priority slider (۱ تا ۵، شبیه ولوم) ----------
  // عدد ۱ = بالاترین اولویت (سمت چپ نوار)، عدد ۵ = کم‌ترین اولویت (سمت راست نوار)
  const PRIORITY_EDGE = 17; // px inset matching .priority-thumb CSS

  function priorityValueToFraction(value) {
    return (value - 1) / 4; // ۱ → ۰ (چپ)، ۵ → ۱ (راست)
  }

  function applyPriorityVisual(fraction) {
    fraction = Math.max(0, Math.min(1, fraction));
    const width = prioritySlider.clientWidth;
    const usable = Math.max(0, width - PRIORITY_EDGE * 2);
    const px = PRIORITY_EDGE + fraction * usable;
    priorityThumb.style.left = px + 'px';
    // پر شدن خط برعکس موقعیت دسته است: هرچه به سمت ۱ (چپ) برویم خط پررنگ‌تر/پرتر می‌شود
    priorityFill.style.width = ((1 - fraction) * 100) + '%';
  }

  function setPriority(value) {
    value = Math.max(1, Math.min(5, Math.round(value)));
    selectedPriority = String(value);
    priorityThumb.textContent = toPersianDigits(value);
    priorityThumb.setAttribute('aria-valuenow', String(value));
    applyPriorityVisual(priorityValueToFraction(value));
  }

  function setPriorityFromClientX(clientX, snap) {
    const rect = prioritySlider.getBoundingClientRect();
    const usable = Math.max(1, rect.width - PRIORITY_EDGE * 2);
    let fraction = (clientX - rect.left - PRIORITY_EDGE) / usable;
    fraction = Math.max(0, Math.min(1, fraction));
    const value = Math.max(1, Math.min(5, Math.round(1 + fraction * 4)));
    selectedPriority = String(value);
    priorityThumb.textContent = toPersianDigits(value);
    priorityThumb.setAttribute('aria-valuenow', String(value));
    // While dragging, follow the cursor exactly (smooth); on release, snap to the exact slot.
    applyPriorityVisual(snap ? priorityValueToFraction(value) : fraction);
  }

  let draggingPriority = false;

  prioritySlider.addEventListener('pointerdown', (e) => {
    draggingPriority = true;
    prioritySlider.classList.add('dragging');
    prioritySlider.setPointerCapture(e.pointerId);
    priorityThumb.focus();
    setPriorityFromClientX(e.clientX, false);
  });
  prioritySlider.addEventListener('pointermove', (e) => {
    if (draggingPriority) setPriorityFromClientX(e.clientX, false);
  });
  function endPriorityDrag(e) {
    if (!draggingPriority) return;
    draggingPriority = false;
    prioritySlider.classList.remove('dragging');
    if (e && typeof e.clientX === 'number') {
      setPriorityFromClientX(e.clientX, true);
    } else {
      applyPriorityVisual(priorityValueToFraction(Number(selectedPriority)));
    }
  }
  prioritySlider.addEventListener('pointerup', endPriorityDrag);
  prioritySlider.addEventListener('pointercancel', endPriorityDrag);

  priorityThumb.addEventListener('keydown', (e) => {
    const current = Number(selectedPriority);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setPriority(current - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setPriority(current + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPriority(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      setPriority(5);
    }
  });

  // ---------- Status toggle (وضعیت اجرا) ----------
  function setDone(done) {
    statusCheckbox.checked = done;
    statusValueText.textContent = done ? 'انجام شده' : 'انجام نشده';
    statusRow.classList.toggle('done', done);
  }

  statusCheckbox.addEventListener('change', () => setDone(statusCheckbox.checked));

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
    refreshData(true);
  }

  async function refreshData(silent) {
    if (!silent) {
      refreshAssigneesBtn.disabled = true;
      refreshAssigneesBtn.classList.add('spinning');
    }
    const result = await window.api.refreshData();
    if (!silent) {
      refreshAssigneesBtn.disabled = false;
      refreshAssigneesBtn.classList.remove('spinning');
    }
    if (result.success) {
      populateAssignees(result.members);
      renderStats(result.stats);
      if (!silent) showToast('اطلاعات به‌روزرسانی شد.', 'success');
    } else if (!silent) {
      showToast(result.message || 'به‌روزرسانی ناموفق بود.', 'error');
    }
  }

  refreshAssigneesBtn.addEventListener('click', () => refreshData(false));

  // ---------- Report / stats ----------
  const RING_CIRCUMFERENCE = 326.7;
  const ringProgress = document.getElementById('ringProgress');
  const ringPercent = document.getElementById('ringPercent');
  const statTotal = document.getElementById('statTotal');
  const statDone = document.getElementById('statDone');
  const statPending = document.getElementById('statPending');

  function toPersianDigits(n) {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(n).replace(/[0-9]/g, (d) => digits[d]);
  }

  function renderStats(stats) {
    const s = stats || { total: 0, done: 0, notDone: 0 };
    const percent = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
    ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - percent / 100));
    ringPercent.textContent = toPersianDigits(percent) + '%';
    statTotal.textContent = toPersianDigits(s.total);
    statDone.textContent = toPersianDigits(s.done);
    statPending.textContent = toPersianDigits(s.notDone);
  }

  async function loadStats() {
    const cached = await window.api.getStats();
    renderStats(cached);
  }

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
      refreshData(true);
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

    const wasDone = statusCheckbox.checked;

    const result = await window.api.submitEntry({
      name,
      description,
      assignee: assigneeSelect.value,
      priority: selectedPriority,
      done: wasDone
    });

    submitBtn.disabled = false;
    submitLabel.textContent = 'ثبت در گوگل شیت';
    submitSpinner.classList.add('hidden');

    if (result.success) {
      showToast('با موفقیت ثبت شد ✅', 'success');
      nameInput.value = '';
      descInput.value = '';
      assigneeSelect.value = '';
      setPriority('3');
      setDone(false);
      nameInput.focus();

      // Optimistic local update so the report feels instant, then
      // reconcile with the sheet in the background.
      const current = await window.api.getStats();
      const next = {
        total: (current.total || 0) + 1,
        done: (current.done || 0) + (wasDone ? 1 : 0),
        notDone: (current.notDone || 0) + (wasDone ? 0 : 1)
      };
      renderStats(next);
      refreshData(true);
    } else {
      showToast(result.message || 'ثبت ناموفق بود.', 'error');
    }
  });

  descInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      submitBtn.click();
    }
  });

  setPriority(3);
  setDone(false);
  loadSettings();
  loadAssignees();
  loadStats();
})();
