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
    var dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
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
