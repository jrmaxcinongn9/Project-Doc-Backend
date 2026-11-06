/**
 * ส่งเมลจาก Gmail ให้ระบบ Project-Doc
 *
 * วิธีติดตั้ง
 * 1. เปิด https://script.google.com ด้วยบัญชี Gmail ที่จะใช้ส่ง แล้วกด New project
 * 2. ลบโค้ดเดิม วางไฟล์นี้ทั้งไฟล์
 * 3. Project Settings > Script Properties > Add property
 *      ชื่อ SECRET  ค่า = ข้อความลับยาว ๆ (ค่าเดียวกับ GMAIL_SCRIPT_SECRET ใน Render)
 * 4. Deploy > New deployment > Select type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    กด Deploy แล้วอนุญาตสิทธิ์ส่งเมล
 * 5. คัดลอก Web app URL ไปใส่ GMAIL_SCRIPT_URL ใน Render
 *
 * แก้โค้ดทีหลังต้อง Deploy > Manage deployments > แก้ deployment เดิมเป็น New version
 * URL จะได้ไม่เปลี่ยน
 */
function doPost(e) {
  var out = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };

  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');

    // ไม่มีรหัสลับที่ถูกต้อง ไม่ส่ง ไม่อย่างนั้นใครก็ใช้ Gmail ของเราส่งสแปมได้
    if (!secret || body.secret !== secret) {
      return out({ ok: false, error: 'unauthorized' });
    }

    if (!body.to || !body.subject || !body.html) {
      return out({ ok: false, error: 'missing to, subject or html' });
    }

    MailApp.sendEmail({
      to: String(body.to),
      subject: String(body.subject),
      htmlBody: String(body.html),
      name: String(body.name || 'Document Internship'),
    });

    return out({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
