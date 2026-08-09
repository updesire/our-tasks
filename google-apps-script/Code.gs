/**
 * این کد را داخل Google Apps Script (متصل به گوگل شیت خودتان) قرار دهید
 * و به‌صورت «Web app» دیپلوی کنید. راهنمای کامل در فایل README.md است.
 *
 * ترتیب ستون‌های شیت اصلی:
 * نام ثبت‌کننده | نام درخواست‌کننده | مسئول اجرا | اولویت | توضیحات | تاریخ | ساعت
 *
 * برای لیست «مسئول اجرا»، یک برگهٔ (Sheet/Tab) دیگر با اسم دقیق «اعضا» بسازید
 * و در ستون A آن، هر ردیف یک اسم از اعضای تیم را بنویسید (بدون سرستون).
 * هر وقت این لیست را در «اعضا» تغییر بدهید، اپ با زدن دکمهٔ بروزرسانی، لیست تازه را می‌گیرد.
 */

// اگر می‌خواهید یک کد امنیتی ساده هم بررسی شود، همینجا مقداردهی کنید
// و همان مقدار را در تنظیمات برنامه، در قسمت «کد امنیتی» وارد کنید.
// اگر نمی‌خواهید بررسی شود، این مقدار را خالی '' بگذارید.
var SECRET_TOKEN = '';

// اسم دقیق برگه‌ای که لیست اعضای تیم (مسئولین اجرا) در آن نوشته می‌شود.
var TEAM_SHEET_NAME = 'اعضا';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (SECRET_TOKEN && data.token !== SECRET_TOKEN) {
      return jsonResponse({ status: 'error', message: 'Unauthorized' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['نام ثبت‌کننده', 'نام درخواست‌کننده', 'مسئول اجرا', 'اولویت', 'توضیحات', 'تاریخ', 'ساعت']);
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
      data.description || '',
      dateStr,
      timeStr
    ]);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

// اپ با یک درخواست GET ساده، لیست فعلی اعضای تیم را از برگهٔ «اعضا» می‌گیرد.
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var teamSheet = ss.getSheetByName(TEAM_SHEET_NAME);
    var members = [];

    if (teamSheet) {
      var lastRow = teamSheet.getLastRow();
      if (lastRow > 0) {
        var values = teamSheet.getRange(1, 1, lastRow, 1).getValues();
        members = values
          .map(function (row) { return String(row[0] || '').trim(); })
          .filter(function (name) { return name.length > 0; });
      }
    }

    return jsonResponse({ status: 'ok', members: members });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
