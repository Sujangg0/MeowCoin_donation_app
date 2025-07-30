// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPromise = open({
  filename: path.join(__dirname, 'meowcoin.db'),
  driver: sqlite3.Database
});

export default dbPromise; 