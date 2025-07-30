// routes/mine.js
import express from 'express';
import dbPromise from '../db/db.js';
import { Blockchain } from '../blockchain.js';

const router = express.Router();

// Singleton blockchain instance
const blockchain = global.meowcoinBlockchain || new Blockchain();
global.meowcoinBlockchain = blockchain;

// POST /api/mine
router.post('/', async (req, res) => {
  try {
    const miningRewardAddress = req.body.miningRewardAddress || 'admin';
    blockchain.minePendingTransactions(miningRewardAddress);
    const newBlock = blockchain.getLatestBlock();
    // Persist block
    const db = await dbPromise;
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
    // Update transactions with block_index
    for (const tx of newBlock.transactions) {
      await db.run(
        `UPDATE transactions SET block_index = ? WHERE transaction_id = ?`,
        [blockchain.chain.length - 1, tx.calculateHash()]
      );
    }
    res.json(newBlock);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mine block' });
  }
});

export default router; 