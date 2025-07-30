// init_db.js
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(path.join(__dirname, 'meowcoin.db'));

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    public_key TEXT UNIQUE,
    certificate TEXT, -- PEM-encoded X.509 certificate
    balance REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Blocks table
  db.run(`CREATE TABLE IF NOT EXISTS blocks (
    block_index INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    transactions_json TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    previous_hash TEXT NOT NULL,
    block_hash TEXT UNIQUE NOT NULL
  )`);

  // Transactions table
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    block_index INTEGER REFERENCES blocks(block_index),
    type TEXT NOT NULL,
    sender_public_key TEXT NOT NULL,
    recipient_or_campaign_id TEXT NOT NULL,
    amount REAL,
    data_json TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    signature TEXT NOT NULL,
    is_valid INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Certificate Revocation List (CRL) table
  db.run(`CREATE TABLE IF NOT EXISTS crl (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    revoked_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('Database initialized with users, blocks, and transactions tables.');
  db.close();
}); 