// routes/user.js
import express from 'express';
import dbPromise from '../db/db.js';
import { authenticateJWT } from '../middleware/auth.js';
import { Blockchain, Transaction } from '../blockchain.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Helper to recalculate and update user balance in DB
async function recalculateAndUpdateBalance(db, publicKey) {
  const sent = await db.all('SELECT amount FROM transactions WHERE sender_public_key = ? AND is_valid = 1', [publicKey]);
  const received = await db.all('SELECT amount FROM transactions WHERE recipient_or_campaign_id = ? AND is_valid = 1', [publicKey]);
  const sentSum = sent.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const receivedSum = received.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const balance = receivedSum - sentSum;
  await db.run('UPDATE users SET balance = ? WHERE public_key = ?', [balance, publicKey]);
  return balance;
}

// Get user profile
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const db = await dbPromise;
    console.log('Profile endpoint: req.user =', req.user);
    if (!req.user || !req.user.id) {
      console.error('No req.user or req.user.id in /api/user/profile');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await db.get('SELECT id, email, username, full_name, public_key, created_at FROM users WHERE id = ?', [req.user.id]);
    console.log('Profile endpoint: DB user =', user);
    if (!user) {
      console.error('User not found in DB for id:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error in /api/user/profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

// Update public key
router.put('/update-public-key', authenticateJWT, async (req, res) => {
  const { public_key } = req.body;
  if (!public_key) return res.status(400).json({ error: 'Public key required' });
  try {
    const db = await dbPromise;
    await db.run('UPDATE users SET public_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [public_key, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update public key' });
  }
});

// Get user balance
router.get('/balance', authenticateJWT, async (req, res) => {
  try {
    const db = await dbPromise;
    const user = await db.get('SELECT public_key, balance FROM users WHERE id = ?', [req.user.id]);
    console.log('Balance endpoint: user =', user);
    if (!user || !user.public_key) {
      console.error('User public key not found for id:', req.user.id, 'user:', user);
      return res.status(404).json({ error: 'User public key not found' });
    }
    // Optionally recalculate and update balance
    const balance = await recalculateAndUpdateBalance(db, user.public_key);
    console.log('Balance endpoint: calculated balance =', balance);
    res.json({ balance });
  } catch (err) {
    console.error('Error in /api/user/balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance', details: err.message });
  }
});

// Faucet endpoint to credit user with demo MEOW
router.post('/faucet', authenticateJWT, async (req, res) => {
  try {
    const amount = typeof req.body.amount === 'number' ? req.body.amount : 100;
    const db = await dbPromise;
    const user = await db.get('SELECT public_key FROM users WHERE id = ?', [req.user.id]);
    if (!user || !user.public_key) return res.status(404).json({ error: 'User public key not found' });
    const blockchain = global.meowcoinBlockchain || new Blockchain();
    global.meowcoinBlockchain = blockchain;
    // Use system user public key from .env
    const systemUser = process.env.SYSTEM_USER_PUBLIC_KEY || 'meowcoin-faucet';
    const tx = new Transaction(systemUser, user.public_key, amount);
    tx.signature = 'faucet';
    blockchain.addTransaction(tx);
    // Mine and persist block
    blockchain.minePendingTransactions(user.public_key);
    const newBlock = blockchain.getLatestBlock();
    await db.run(
      `INSERT INTO blocks (block_index, timestamp, transactions_json, nonce, previous_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        blockchain.chain.length - 1,
        newBlock.timestamp,
        JSON.stringify(newBlock.transactions),
        newBlock.nonce,
        newBlock.previousHash,
        newBlock.hash
      ]
    );
    for (const minedTx of newBlock.transactions) {
      await db.run(
        `UPDATE transactions SET block_index = ? WHERE transaction_id = ?`,
        [blockchain.chain.length - 1, minedTx.calculateHash()]
      );
    }
    // Update user balance
    await recalculateAndUpdateBalance(db, user.public_key);
    res.json({ success: true, credited: amount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to credit faucet MEOW' });
  }
});

// /getCoin endpoint to acquire Meow Coin (same as faucet)
router.post('/getCoin', authenticateJWT, async (req, res) => {
  try {
    const amount = typeof req.body.amount === 'number' ? req.body.amount : 100;
    const db = await dbPromise;
    const user = await db.get('SELECT public_key FROM users WHERE id = ?', [req.user.id]);
    if (!user || !user.public_key) return res.status(404).json({ error: 'User public key not found' });
    const blockchain = global.meowcoinBlockchain || new Blockchain();
    global.meowcoinBlockchain = blockchain;
    // Use system user public key from .env
    const systemUser = process.env.SYSTEM_USER_PUBLIC_KEY || 'meowcoin-faucet';
    const tx = new Transaction(systemUser, user.public_key, amount);
    tx.signature = 'getCoin';
    blockchain.addTransaction(tx);
    // Mine and persist block
    blockchain.minePendingTransactions(user.public_key);
    const newBlock = blockchain.getLatestBlock();
    await db.run(
      `INSERT INTO blocks (block_index, timestamp, transactions_json, nonce, previous_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        blockchain.chain.length - 1,
        newBlock.timestamp,
        JSON.stringify(newBlock.transactions),
        newBlock.nonce,
        newBlock.previousHash,
        newBlock.hash
      ]
    );
    for (const minedTx of newBlock.transactions) {
      await db.run(
        `UPDATE transactions SET block_index = ? WHERE transaction_id = ?`,
        [blockchain.chain.length - 1, minedTx.calculateHash()]
      );
    }
    // Update user balance
    await recalculateAndUpdateBalance(db, user.public_key);
    res.json({ success: true, credited: amount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to credit MEOW via getCoin' });
  }
});

// /api/faucet/claim-simulated endpoint for demo faucet
router.post('/faucet/claim-simulated', authenticateJWT, async (req, res) => {
  try {
    const { recipientPublicKey, amountMeow } = req.body;
    if (!recipientPublicKey || typeof amountMeow !== 'number' || amountMeow <= 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const db = await dbPromise;
    // Check if recipientPublicKey exists in users table
    const user = await db.get('SELECT * FROM users WHERE public_key = ?', [recipientPublicKey]);
    if (!user) {
      return res.status(404).json({ error: 'Recipient public key not registered to any user' });
    }
    // Use the singleton blockchain instance
    const blockchain = global.meowcoinBlockchain || new Blockchain();
    global.meowcoinBlockchain = blockchain;
    // Faucet address (special string for system)
    const tx = new Transaction('meowcoin-faucet', recipientPublicKey, amountMeow);
    // No signature needed for faucet/system tx
    tx.signature = 'faucet-claim-simulated';
    blockchain.addTransaction(tx);
    // Mine and persist block so balance updates immediately
    blockchain.minePendingTransactions(recipientPublicKey);
    const newBlock = blockchain.getLatestBlock();
    await db.run(
      `INSERT INTO blocks (block_index, timestamp, transactions_json, nonce, previous_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        blockchain.chain.length - 1,
        newBlock.timestamp,
        JSON.stringify(newBlock.transactions),
        newBlock.nonce,
        newBlock.previousHash,
        newBlock.hash
      ]
    );
    for (const minedTx of newBlock.transactions) {
      // Insert transaction if not exists
      await db.run(
        `INSERT OR IGNORE INTO transactions 
          (transaction_id, block_index, type, sender_public_key, recipient_or_campaign_id, amount, data_json, timestamp, signature, is_valid, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)` ,
        [
          minedTx.calculateHash(),
          blockchain.chain.length - 1,
          'faucet-claim-simulated',
          minedTx.fromAddress,
          minedTx.toAddress,
          minedTx.amount,
          JSON.stringify({}),
          minedTx.timestamp,
          minedTx.signature || '',
          new Date().toISOString()
        ]
      );
      // Always update block_index for this tx
      await db.run(
        `UPDATE transactions SET block_index = ? WHERE transaction_id = ?`,
        [blockchain.chain.length - 1, minedTx.calculateHash()]
      );
    }
    // Update user balance
    await recalculateAndUpdateBalance(db, recipientPublicKey);
    res.json({ success: true, credited: amountMeow });
  } catch (err) {
    res.status(500).json({ error: 'Failed to credit MEOW via faucet claim-simulated' });
  }
});

export { recalculateAndUpdateBalance };
export default router; 