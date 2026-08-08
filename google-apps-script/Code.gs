/**
 * این کد را داخل Google Apps Script (متصل به گوگل شیت خودتان) قرار دهید
 * و به‌صورت «Web app» دیپلوی کنید. راهنمای کامل در فایل README.md است.
 *
 * ترتیب ستون‌های شیت:
 * نام ثبت‌کننده | نام درخواست‌کننده | توضیحات | تاریخ | ساعت
 */

// اگر می‌خواهید یک کد امنیتی ساده هم بررسی شود، همینجا مقداردهی کنید
// و همان مقدار را در تنظیمات برنامه، در قسمت «کد امنیتی» وارد کنید.
// اگر نمی‌خواهید بررسی شود، این مقدار را خالی '' بگذارید.
var SECRET_TOKEN = '';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (SECRET_TOKEN && data.token !== SECRET_TOKEN) {
      return jsonResponse({ status: 'error', message: 'Unauthorized' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['نام ثبت‌کننده', 'نام درخواست‌کننده', 'توضیحات', 'تاریخ', 'ساعت']);
    }

    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, tz, 'HH:mm:ss');

    sheet.appendRow([
      data.submittedBy || '',
      data.name || '',
      data.description || '',
      dateStr,
      timeStr
    ]);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
