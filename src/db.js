const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "../vcOwners.json");

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log(`📄 [DB] Creating new database file...`);
      fs.writeFileSync(DB_FILE, "{}");
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    console.log(`📄 [DB] Loaded ${Object.keys(data).length} VC(s) from database`);
    return data;
  } catch (err) {
    console.error("📄 [DB] ❌ Error reading database:", err.message);
    return {};
  }
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`💾 [DB] Saved - ${Object.keys(db).length} VC(s)`);
  } catch (err) {
    console.error("💾 [DB] ❌ Error saving database:", err.message);
  }
}

module.exports = { loadDb, saveDb, DB_FILE };
