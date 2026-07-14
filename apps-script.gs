// Kore waitlist backend.
// Sheet tab "Signups" needs these headers somewhere in row 1 (any column
// order is fine - columns are found by header name, not position):
// Timestamp, Email, Code, ReferredBy, Position
// Queue model: position is a persisted integer. New signups join at the back
// of the line. Each successful referral swaps the referrer with whoever is
// directly one spot ahead of them - one bump per referral, not a jump to the top.

const SHEET_NAME = "Signups";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/l to avoid confusion
const REQUIRED_HEADERS = ["Timestamp", "Email", "Code", "ReferredBy", "Position"];

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(REQUIRED_HEADERS);
  }
  return sheet;
}

function getColumnMap_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headerRow.forEach((h, i) => { if (h) map[h] = i + 1; });

  REQUIRED_HEADERS.forEach(name => {
    if (!map[name]) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(name);
      map[name] = newCol;
      if (name === "Position") {
        const lastRow = sheet.getLastRow();
        if (lastRow >= 2) {
          const positions = [];
          for (let i = 2; i <= lastRow; i++) positions.push([i - 1]);
          sheet.getRange(2, newCol, positions.length, 1).setValues(positions);
        }
      }
    }
  });
  return map;
}

function getAllRows_(sheet, cols) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map((r, i) => ({
    rowIndex: i + 2,
    email: String(r[cols["Email"] - 1]).toLowerCase(),
    code: r[cols["Code"] - 1],
    referredBy: r[cols["ReferredBy"] - 1],
    position: r[cols["Position"] - 1]
  }));
}

function buildRowArray_(cols, data) {
  const width = Math.max.apply(null, Object.keys(cols).map(k => cols[k]));
  const row = new Array(width).fill("");
  Object.keys(data).forEach(key => {
    if (cols[key]) row[cols[key] - 1] = data[key];
  });
  return row;
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
    const cols = getColumnMap_(sheet);
    const rows = getAllRows_(sheet, cols);

    const existing = rows.find(r => r.email === email);
    if (existing) {
      return jsonOut_({ ok: true, email, code: existing.code, position: existing.position, referralCount: referralCountFor_(rows, existing.code) });
    }

    const existingCodes = rows.map(r => r.code);
    if (!existingCodes.includes(referredBy)) referredBy = "";

    const code = generateCode_(existingCodes);
    const timestamp = new Date();
    const position = rows.length + 1;
    sheet.appendRow(buildRowArray_(cols, { Timestamp: timestamp, Email: email, Code: code, ReferredBy: referredBy, Position: position }));

    if (referredBy) {
      const referrer = rows.find(r => r.code === referredBy);
      if (referrer && referrer.position > 1) {
        const ahead = rows.find(r => r.position === referrer.position - 1);
        if (ahead) {
          sheet.getRange(referrer.rowIndex, cols["Position"]).setValue(referrer.position - 1);
          sheet.getRange(ahead.rowIndex, cols["Position"]).setValue(ahead.position + 1);
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
    const cols = getColumnMap_(sheet);
    const rows = getAllRows_(sheet, cols);
    const target = rows.find(r => r.code === code);
    if (!target) return jsonOut_({ ok: false, error: "Code not found" });

    return jsonOut_({ ok: true, email: target.email, code: target.code, position: target.position, referralCount: referralCountFor_(rows, target.code) });
  } finally {
    lock.releaseLock();
  }
}
