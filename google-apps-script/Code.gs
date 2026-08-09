/**
 * این کد را داخل Google Apps Script (متصل به گوگل شیت خودتان) قرار دهید
 * و به‌صورت «Web app» دیپلوی کنید. راهنمای کامل در فایل README.md است.
 *
 * ترتیب ستون‌های شیت اصلی (اولین/چپ‌ترین برگهٔ شیت شما):
 * نام ثبت‌کننده | نام درخواست‌کننده | مسئول اجرا | اولویت | وضعیت اجرا | توضیحات | تاریخ | ساعت
 *
 * نکته مهم: برگهٔ اصلی داده‌ها باید همیشه اولین برگهٔ (Tab) شیت شما باشد.
 * برای لیست «مسئول اجرا»، یک برگهٔ دیگر با اسم دقیق «اعضا» بسازید
 * و در ستون A آن، هر ردیف یک اسم از اعضای تیم را بنویسید (بدون سرستون).
 */

// اگر می‌خواهید یک کد امنیتی ساده هم بررسی شود، همینجا مقداردهی کنید
// و همان مقدار را در تنظیمات برنامه، در قسمت «کد امنیتی» وارد کنید.
// اگر نمی‌خواهید بررسی شود، این مقدار را خالی '' بگذارید.
var SECRET_TOKEN = '';

// اسم دقیق برگه‌ای که لیست اعضای تیم (مسئولین اجرا) در آن نوشته می‌شود.
var TEAM_SHEET_NAME = 'اعضا';

var STATUS_DONE = 'انجام شده';
var STATUS_NOT_DONE = 'انجام نشده';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (SECRET_TOKEN && data.token !== SECRET_TOKEN) {
      return jsonResponse({ status: 'error', message: 'Unauthorized' });
    }

    var sheet = getMainSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['نام ثبت‌کننده', 'نام درخواست‌کننده', 'مسئول اجرا', 'اولویت', 'وضعیت اجرا', 'توضیحات', 'تاریخ', 'ساعت']);
    }

    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var dateStr = getShamsiDateString(now, tz);
    var timeStr = Utilities.formatDate(now, tz, 'HH:mm:ss');

    sheet.appendRow([
      data.submittedBy || '',
      data.name || '',
      data.assignee || '',
      data.priority || '',
      data.status || STATUS_NOT_DONE,
      data.description || '',
      dateStr,
      timeStr
    ]);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

// اپ با یک درخواست GET ساده، لیست اعضای تیم و آمار خلاصهٔ گزارش‌ها را می‌گیرد.
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var teamSheet = ss.getSheetByName(TEAM_SHEET_NAME);
    var members = [];

    if (teamSheet) {
      var teamLastRow = teamSheet.getLastRow();
      if (teamLastRow > 0) {
        var teamValues = teamSheet.getRange(1, 1, teamLastRow, 1).getValues();
        members = teamValues
          .map(function (row) { return String(row[0] || '').trim(); })
          .filter(function (name) { return name.length > 0; });
      }
    }

    var stats = computeStats();

    return jsonResponse({ status: 'ok', members: members, stats: stats });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

function computeStats() {
  var sheet = getMainSheet();
  var lastRow = sheet.getLastRow();
  var total = 0;
  var done = 0;

  if (lastRow > 1) {
    var statusValues = sheet.getRange(2, 5, lastRow - 1, 1).getValues(); // ستون ۵ = وضعیت اجرا
    total = statusValues.length;
    for (var i = 0; i < statusValues.length; i++) {
      if (String(statusValues[i][0]).trim() === STATUS_DONE) {
        done++;
      }
    }
  }

  return { total: total, done: done, notDone: total - done };
}

// همیشه اولین برگهٔ (Tab) شیت را به‌عنوان محل داده‌های اصلی در نظر می‌گیرد،
// تا با اضافه شدن برگهٔ «اعضا»، داده‌ها اشتباهی در برگهٔ دیگری نوشته/خوانده نشوند.
function getMainSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- تبدیل تاریخ میلادی به شمسی (جلالی) ----------
// چون Utilities.formatDate فقط تقویم میلادی را پشتیبانی می‌کند، تاریخ را با
// همان الگوریتم دقیق و شناخته‌شدهٔ کتابخانهٔ jalaali-js (بر پایهٔ چرخهٔ ۳۳ ساله)
// به شمسی تبدیل می‌کنیم و در ستون «تاریخ» ثبت می‌کنیم.
var JALALI_BREAKS_ = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function div_(a, b) { return Math.trunc(a / b); }
function mod_(a, b) { return a - Math.trunc(a / b) * b; }

function jalCal_(jy) {
  var bl = JALALI_BREAKS_.length, gy = jy + 621, leapJ = -14, jp = JALALI_BREAKS_[0], jm, jump, leap, leapG, march, n, i;
  for (i = 1; i < bl; i += 1) {
    jm = JALALI_BREAKS_[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div_(jump, 33) * 8 + div_(mod_(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div_(n, 33) * 8 + div_(mod_(n, 33) + 3, 4);
  if (mod_(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  leapG = div_(gy, 4) - div_((div_(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div_(jump + 4, 33) * 33;
  leap = mod_(mod_(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap: leap, gy: gy, march: march };
}

function g2d_(gy, gm, gd) {
  var d = div_((gy + div_(gm - 8, 6) + 100100) * 1461, 4)
    + div_(153 * mod_(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div_(div_(gy + 100100 + div_(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g_(jdn) {
  var j, i, gd, gm, gy;
  j = 4 * jdn + 139361631;
  j = j + div_(div_(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  i = div_(mod_(j, 1461), 4) * 5 + 308;
  gd = div_(mod_(i, 153), 5) + 1;
  gm = mod_(div_(i, 153), 12) + 1;
  gy = div_(j, 1461) - 100100 + div_(8 - gm, 6);
  return { gy: gy, gm: gm, gd: gd };
}

function d2j_(jdn) {
  var gy = d2g_(jdn).gy, jy = gy - 621, r = jalCal_(jy), jdn1f = g2d_(gy, 3, r.march), jd, jm, k;
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div_(k, 31);
      jd = mod_(k, 31) + 1;
      return { jy: jy, jm: jm, jd: jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div_(k, 30);
  jd = mod_(k, 30) + 1;
  return { jy: jy, jm: jm, jd: jd };
}

function gregorianToJalali_(gy, gm, gd) {
  var j = d2j_(g2d_(gy, gm, gd));
  return [j.jy, j.jm, j.jd];
}

function pad2_(n) {
  n = String(n);
  return n.length < 2 ? '0' + n : n;
}

function toPersianDigits_(str) {
  var fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, function (d) { return fa[d]; });
}

// خروجی نمونه: ۱۴۰۵/۰۵/۱۸
function getShamsiDateString(dateObj, tz) {
  var gy = parseInt(Utilities.formatDate(dateObj, tz, 'yyyy'), 10);
  var gm = parseInt(Utilities.formatDate(dateObj, tz, 'MM'), 10);
  var gd = parseInt(Utilities.formatDate(dateObj, tz, 'dd'), 10);
  var j = gregorianToJalali_(gy, gm, gd);
  var formatted = j[0] + '/' + pad2_(j[1]) + '/' + pad2_(j[2]);
  return toPersianDigits_(formatted);
}
