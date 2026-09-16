import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadHandler from './upload.js';
import statsHandler from './stats.js';
import logsHandler from './logs.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/csv', limit: '50mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', server: 'vercel-serverless-local' }));
app.post('/api/upload', (req, res) => uploadHandler(req, res));
app.get('/api/stats', (req, res) => statsHandler(req, res));
app.get('/api/logs', (req, res) => logsHandler(req, res));

app.listen(PORT, () => {
  console.log(`🚀 Local Serverless API running at http://localhost:${PORT}`);
});
