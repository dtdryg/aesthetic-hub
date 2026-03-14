const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');

// Create users table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    resetToken TEXT,
    resetExpiry INTEGER
  )
`);

module.exports = db;
