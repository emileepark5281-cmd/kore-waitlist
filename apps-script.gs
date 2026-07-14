/*
  Kore waitlist backend.
  Paste this into Extensions > Apps Script on your Google Sheet, then deploy
  as a Web App (see README.md). The sheet must have a tab named "Signups".
  Columns (auto-created/migrated): Timestamp | Email | Code | ReferredBy | Position

  Queue model: position is a persisted integer, not recomputed from a
  global sort. New signups join at the back of the line. Each successful
  referral swaps the referrer with whoever is directly one spot ahead of
  them — one bump per referral, not a jump to the top.
*/

const SHEET_NAME = "Signups";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/l to avoid confusion

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Email", "Code", "ReferredBy", "Position"]);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf("Position") === -1) {
    const posCol = headers.length + 1;
    sheet.getRange(1, posCol).setValue("Position");
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const positions = [];
      for (let i = 2; i <= lastRow; i++) positions.push([i - 1]);
      sheet.getRange(2, posCol, positions.length, 1).setValues(positions);
    }
  }
  return sheet;
}

function getAllRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 5).getValues()
    .map((r, i) => ({
      rowIndex: i + 2,
      timestamp: r[0],
      email: String(r[1]).toLowerCase(),
      code: r[2],
      referredBy: r[3],
      position: r[4]
    }));
}

function generateCode_(existingCodes) {
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
  } while (existingCodes.includes(code));
  return code;
}

function referralCountFor_(rows, code) {
  return rows.filter(r => r.referredBy === code).length;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    const email = String(body.email || "").trim().toLowerCase();
    let referredBy = String(body.referredBy || "").trim().toUpperCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonOut_({ ok: false, error: "Invalid email" });
    }

    const sheet = getSheet_();
    const rows = getAllRows_(sheet);

    const existing = rows.find(r => r.email === email);
    if (existing) {
      return jsonOut_({ ok: true, email, code: existing.code, position: existing.position, referralCount: referralCountFor_(rows, existing.code) });
    }

    const existingCodes = rows.map(r => r.code);
    if (!existingCodes.includes(referredBy)) referredBy = "";

    const code = generateCode_(existingCodes);
    const timestamp = new Date();
    const position = rows.length + 1;
    sheet.appendRow([timestamp, email, code, referredBy, position]);

    if (referredBy) {
      const referrer = rows.find(r => r.code === referredBy);
      if (referrer && referrer.position > 1) {
        const ahead = rows.find(r => r.position === referrer.position - 1);
        if (ahead) {
          sheet.getRange(referrer.rowIndex, 5).setValue(referrer.position - 1);
          sheet.getRange(ahead.rowIndex, 5).setValue(ahead.position + 1);
        }
      }
    }

    return jsonOut_({ ok: true, email, code, position, referralCount: 0 });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const code = String((e.parameter && e.parameter.code) || "").trim().toUpperCase();
    if (!code) return jsonOut_({ ok: false, error: "Missing code" });

    const sheet = getSheet_();
    const rows = getAllRows_(sheet);
    const target = rows.find(r => r.code === code);
    if (!target) return jsonOut_({ ok: false, error: "Code not found" });

    return jsonOut_({ ok: true, email: target.email, code: target.code, position: target.position, referralCount: referralCountFor_(rows, target.code) });
  } finally {
    lock.releaseLock();
  }
}
