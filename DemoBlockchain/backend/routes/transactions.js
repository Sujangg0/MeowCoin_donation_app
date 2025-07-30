// routes/transactions.js
import express from 'express';
import dbPromise from '../db/db.js';
import { authenticateJWT } from '../middleware/auth.js';
import { Blockchain, Transaction } from '../blockchain.js';
import CryptoJS from 'crypto-js';
import { recalculateAndUpdateBalance } from './user.js';

const router = express.Router();

// Singleton blockchain instance
const blockchain = global.meowcoinBlockchain || new Blockchain();
global.meowcoinBlockchain = blockchain;

// POST /api/transactions/new
router.post('/new', authenticateJWT, async (req, res) => {
  const { type, fromAddress, toAddress, amount, signature, campaignMeta } = req.body;
  if (!type || !fromAddress || !toAddress || !signature) {
    console.error('Missing required transaction fields:', { type, fromAddress, toAddress, signature });
    return res.status(400).json({ error: 'Missing required transaction fields', details: { type, fromAddress, toAddress, signature } });
  }
  try {
    let tx;
    let txAmount = typeof amount === 'number' ? amount : 0;
    let txType = type;
    let dataJson = {};
    let campaignId = toAddress;
    let txTimestamp = req.body.timestamp || new Date().toISOString();
    if (type === 'create_campaign') {
      if (!campaignMeta || !campaignMeta.title || !campaignMeta.description || !campaignMeta.goal) {
        console.error('Missing campaignMeta fields:', campaignMeta);
        return res.status(400).json({ error: 'Missing campaignMeta fields', details: campaignMeta });
      }
      // Use campaignId from frontend if provided, else generate
      let campaignId = campaignMeta.campaignId;
      if (!campaignId) {
      const metaString = JSON.stringify(campaignMeta) + Date.now();
      campaignId = CryptoJS.SHA256(metaString).toString();
      }
      tx = new Transaction(fromAddress, campaignId, 0, txTimestamp);
      dataJson = { ...campaignMeta, campaignId };
    } else if (type === 'donate') {
      // For donations, toAddress is the campaign creator's public key
      // but we need to store the campaign ID for tracking
      const campaignId = campaignMeta?.campaignId || toAddress;
      tx = new Transaction(fromAddress, toAddress, txAmount, txTimestamp);
      dataJson = { campaignId, amount: txAmount };
    } else {
      console.error('Invalid transaction type:', type);
      return res.status(400).json({ error: 'Invalid transaction type', details: type });
    }
    tx.signature = signature;
    // Validate signature
    const isValid = tx.isValid();
    if (!isValid) {
      console.error('Invalid signature for transaction:', tx);
      return res.status(400).json({ error: 'Invalid signature', details: tx });
    }
    const db = await dbPromise;
    // For donations, use campaign ID for tracking, but still send coins to creator
    const dbRecipientOrCampaignId = type === 'donate' ? (campaignMeta?.campaignId || toAddress) : campaignId;
    await db.run(
      `INSERT INTO transactions (transaction_id, block_index, type, sender_public_key, recipient_or_campaign_id, amount, data_json, timestamp, signature, is_valid) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.calculateHash(),
        txType,
        fromAddress,
        dbRecipientOrCampaignId,
        txAmount,
        JSON.stringify(dataJson),
        new Date().toISOString(),
        signature,
        isValid ? 1 : 0
      ]
    );
    blockchain.addTransaction(tx);
    // Auto-mine after transaction
    const miningRewardAddress = fromAddress || 'admin';
    blockchain.minePendingTransactions(miningRewardAddress);
    const newBlock = blockchain.getLatestBlock();
    // Persist block
    const row = await db.get('SELECT MAX(block_index) as maxIndex FROM blocks');
    const nextBlockIndex = (row && row.maxIndex !== null) ? row.maxIndex + 1 : 0;
    await db.run(
      `INSERT INTO blocks (block_index, timestamp, transactions_json, nonce, previous_hash, block_hash) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nextBlockIndex,
        newBlock.timestamp,
        JSON.stringify(newBlock.transactions),
        newBlock.nonce,
        newBlock.previousHash,
        newBlock.hash
      ]
    );
    // Update transactions with block_index
    for (const minedTx of newBlock.transactions) {
      await db.run(
        `UPDATE transactions SET block_index = ? WHERE transaction_id = ?`,
        [nextBlockIndex, minedTx.calculateHash()]
      );
    }
    // Recalculate and update balances for sender and recipient if donation
    if (type === 'donate') {
      await recalculateAndUpdateBalance(db, fromAddress);
      await recalculateAndUpdateBalance(db, toAddress);
    }
    res.json({ success: true, campaignId });
  } catch (err) {
    console.error('Failed to process transaction:', err);
    res.status(500).json({ error: 'Failed to process transaction', details: err.message });
  }
});

export default router; 