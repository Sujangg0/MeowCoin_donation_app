// routes/campaigns.js
import express from 'express';
import dbPromise from '../db/db.js';

const router = express.Router();

// GET /api/campaigns
router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    // Get all create_campaign transactions
    const campaigns = await db.all(
      `SELECT * FROM transactions WHERE type = 'create_campaign' AND is_valid = 1`
    );
    // For each campaign, aggregate donations
    const result = [];
    for (const campaign of campaigns) {
      const campaignData = JSON.parse(campaign.data_json);
      const campaignId = campaign.recipient_or_campaign_id; // Use the stored campaign ID
      const donations = await db.all(
        `SELECT * FROM transactions WHERE type = 'donate' AND recipient_or_campaign_id = ? AND is_valid = 1`,
        [campaignId]
      );
      const raised = donations.reduce((sum, d) => sum + (d.amount || 0), 0);
      result.push({
        id: campaignId,
        title: campaignData.title,
        description: campaignData.description,
        goal: campaignData.goal,
        image_url: campaignData.image_url,
        raised,
        created_at: campaign.timestamp,
        creator_public_key: campaign.sender_public_key // Add creator's public key
      });
    }
    res.json(result);
  } catch (err) {
    res.json([]); // Always return an array to prevent frontend JSON errors
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const campaign = await db.get(
      `SELECT * FROM transactions WHERE type = 'create_campaign' AND is_valid = 1 AND data_json LIKE ?`,
      [`%${req.params.id}%`]
    );
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const campaignData = JSON.parse(campaign.data_json);
    const campaignId = campaign.recipient_or_campaign_id; // Use the stored campaign ID
    const donations = await db.all(
      `SELECT * FROM transactions WHERE type = 'donate' AND recipient_or_campaign_id = ? AND is_valid = 1`,
      [campaignId]
    );
    // Anonymize donor public key
    const donationHistory = donations.map(d => ({
      timestamp: d.timestamp,
      amount: d.amount,
      donor: d.sender_public_key ? `${d.sender_public_key.slice(0, 6)}...${d.sender_public_key.slice(-4)}` : 'Anonymous'
    }));
    res.json({
      id: campaignId,
      title: campaignData.title,
      description: campaignData.description,
      goal: campaignData.goal,
      image_url: campaignData.image_url,
      raised: donations.reduce((sum, d) => sum + (d.amount || 0), 0),
      donation_history: donationHistory,
      created_at: campaign.timestamp
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign details' });
  }
});

// POST /api/campaigns
router.post('/', async (req, res) => {
  try {
    const { rawCampaignData, signature, publicKey } = req.body;
    if (!rawCampaignData || !signature || !publicKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const db = await dbPromise;
    // Get the logged-in user's public key (simulate auth for now)
    // In production, use JWT auth and req.user
    // For now, just check if the publicKey exists in the users table
    const user = await db.get('SELECT * FROM users WHERE public_key = ?', [publicKey]);
    if (!user) {
      return res.status(403).json({ error: 'Provided public key does not match any user' });
    }
    // Verify signature
    const pkg = await import('elliptic');
    const EC = pkg.default.ec || pkg.ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPublic(publicKey, 'hex');
    // Hash the rawCampaignData
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(rawCampaignData).digest('hex');
    const isValid = key.verify(hash, signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature for campaign creation' });
    }
    // Parse campaign data
    const campaignData = JSON.parse(rawCampaignData);
    // Store as a transaction
    const txId = crypto.createHash('sha256').update(rawCampaignData + signature).digest('hex');
    await db.run(
      `INSERT INTO transactions (transaction_id, block_index, type, sender_public_key, recipient_or_campaign_id, amount, data_json, timestamp, signature, is_valid) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        txId,
        'create_campaign',
        publicKey,
        campaignData.campaignId || txId,
        0,
        rawCampaignData,
        campaignData.timestamp || new Date().toISOString(),
        signature
      ]
    );
    res.json({ success: true, campaignId: campaignData.campaignId || txId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create campaign', details: err.message });
  }
});

export default router; 