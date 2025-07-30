// server.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes (to be created)
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import transactionRoutes from './routes/transactions.js';
import campaignRoutes from './routes/campaigns.js';
import blockchainRoutes from './routes/blockchain.js';
import mineRoutes from './routes/mine.js';

const app = express();
const PORT = process.env.PORT || 3001;

// For ES modules __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes (to be implemented)
app.use('/api', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/mine', mineRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve /getcoin to load the getcoin UI directly
app.get('/getcoin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`MeowCoin backend running on http://localhost:${PORT}`);
});

// Global error handler (must be after all routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
}); 