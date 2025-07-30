// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dbPromise from '../db/db.js';
import pkg from 'elliptic';
const { ec: EC } = pkg;
const ec = new EC('secp256k1');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmeow';

// Email validation function
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Register
router.post('/register', async (req, res) => {
  const { full_name, username, email, password } = req.body;
  
  // Validation
  if (!full_name || !username || !email || !password) {
    return res.status(400).json({ error: 'Full name, username, email and password required' });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }
  
  try {
    const db = await dbPromise;
    const hash = await bcrypt.hash(password, 10);
    // Generate key pair
    const key = ec.genKeyPair();
    const publicKey = key.getPublic('hex');
    const privateKey = key.getPrivate('hex');
    await db.run('INSERT INTO users (full_name, username, email, password_hash, public_key) VALUES (?, ?, ?, ?, ?)', 
      [full_name, username, email, hash, publicKey]);
    // Return private key for download (client should prompt download)
    res.json({ success: true, privateKey });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      if (err.message.includes('email')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      if (err.message.includes('username')) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  try {
    const db = await dbPromise;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, public_key: user.public_key || null, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router; 