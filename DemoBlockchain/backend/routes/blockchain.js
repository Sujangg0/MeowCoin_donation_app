// routes/blockchain.js
import express from 'express';
import dbPromise from '../db/db.js';

const router = express.Router();

// GET /api/blockchain/blocks
router.get('/blocks', async (req, res) => {
  try {
    const db = await dbPromise;
    const blocks = await db.all('SELECT * FROM blocks ORDER BY block_index DESC');
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});

// GET /api/blockchain/blocks/:index
router.get('/blocks/:index', async (req, res) => {
  try {
    const db = await dbPromise;
    const block = await db.get('SELECT * FROM blocks WHERE block_index = ?', [req.params.index]);
    if (!block) return res.status(404).json({ error: 'Block not found' });
    block.transactions = JSON.parse(block.transactions_json);
    res.json(block);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch block' });
  }
});

// GET /api/blockchain/transactions/:id
router.get('/transactions/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const tx = await db.get('SELECT * FROM transactions WHERE transaction_id = ?', [req.params.id]);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

export default router; 