/*
  Kore waitlist backend.
  Paste this into Extensions > Apps Script on your Google Sheet, then deploy
  as a Web App (see README.md). The sheet must have a tab named "Signups"
  with header row: Timestamp | Email | Code | ReferredBy
*/

const SHEET_NAME = "Signups";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/l to avoid confusion

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Email", "Code", "ReferredBy"]);
  }
  return sheet;
}

function getAllRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues()
    .map(r => ({ timestamp: r[0], email: String(r[1]).toLowerCase(), code: r[2], referredBy: r[3] }));
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

function computeStanding_(rows, targetEmail) {
  const referralCounts = {};
  rows.forEach(r => {
    if (r.referredBy) referralCounts[r.referredBy] = (referralCounts[r.referredBy] || 0) + 1;
  });

  const ranked = rows.slice().sort((a, b) => {
    const countDiff = (referralCounts[b.code] || 0) - (referralCounts[a.code] || 0);
    if (countDiff !== 0) return countDiff;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  const idx = ranked.findIndex(r => r.email === targetEmail.toLowerCase());
  const target = rows.find(r => r.email === targetEmail.toLowerCase());
  return {
    position: idx + 1,
    referralCount: referralCounts[target.code] || 0
  };
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
      const standing = computeStanding_(rows, email);
      return jsonOut_({ ok: true, email, code: existing.code, position: standing.position, referralCount: standing.referralCount });
    }

    const existingCodes = rows.map(r => r.code);
    if (!existingCodes.includes(referredBy)) referredBy = "";

    const code = generateCode_(existingCodes);
    const timestamp = new Date();
    sheet.appendRow([timestamp, email, code, referredBy]);

    const updatedRows = rows.concat([{ timestamp, email, code, referredBy }]);
    const standing = computeStanding_(updatedRows, email);

    return jsonOut_({ ok: true, email, code, position: standing.position, referralCount: standing.referralCount });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const code = String((e.parameter && e.parameter.code) || "").trim().toUpperCase();
  if (!code) return jsonOut_({ ok: false, error: "Missing code" });

  const sheet = getSheet_();
  const rows = getAllRows_(sheet);
  const target = rows.find(r => r.code === code);
  if (!target) return jsonOut_({ ok: false, error: "Code not found" });

  const standing = computeStanding_(rows, target.email);
  return jsonOut_({ ok: true, email: target.email, code: target.code, position: standing.position, referralCount: standing.referralCount });
}
