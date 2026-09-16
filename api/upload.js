import { getDatabase } from './lib/mongodb.js';
import { memoryStore } from './lib/store.js';
import { parseCsvContent } from './services/csvParser.js';
import { cleanAndNormalizeData } from './services/dataCleaner.js';
import { calculateSlaStats } from './services/slaCalculator.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let csvContent = '';
    let filename = 'monitoring_checks.csv';

    if (typeof req.body === 'object' && req.body.csvContent) {
      csvContent = req.body.csvContent;
      filename = req.body.filename || filename;
    } else if (typeof req.body === 'string') {
      csvContent = req.body;
      if (req.query.filename) filename = req.query.filename;
    }

    if (!csvContent || csvContent.trim().length === 0) {
      return res.status(400).json({ error: 'No CSV content provided in request body.' });
    }

    // 1. Parse CSV
    const rawRecords = parseCsvContent(csvContent);
    if (!rawRecords || rawRecords.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no valid data rows.' });
    }

    // 2. Clean & Normalize
    const { cleanedChecks, uploadSummary, rejectedRecords } = cleanAndNormalizeData(rawRecords, filename);

    // 3. Compute SLA Statistics
    const slaStats = calculateSlaStats(cleanedChecks, 99.9);
    const uploadId = `upload_${Date.now()}`;

    // 4. Save to Memory Store
    memoryStore.activeUploadId = uploadId;
    memoryStore.uploads.set(uploadId, {
      uploadId,
      summary: uploadSummary,
      stats: slaStats
    });
    memoryStore.checks.set(uploadId, cleanedChecks);

    // 5. If MongoDB Atlas is connected, persist records
    try {
      const db = await getDatabase();
      if (db) {
        const uploadsCollection = db.collection('uploads');
        const checksCollection = db.collection('monitoringChecks');
        const appStateCollection = db.collection('appState');

        await checksCollection.createIndex({ uploadId: 1, epochMs: -1, serviceId: 1 });
        await uploadsCollection.createIndex({ uploadedAt: -1 });

        await uploadsCollection.insertOne({
          uploadId,
          ...uploadSummary,
          stats: slaStats,
          createdAt: new Date()
        });

        await appStateCollection.updateOne(
          { _id: 'current' },
          { $set: { activeUploadId: uploadId, updatedAt: new Date() } },
          { upsert: true }
        );

        const docsToInsert = cleanedChecks.map((check) => ({
          uploadId,
          serviceId: check.serviceId,
          serviceName: check.serviceName,
          timestamp: check.timestamp,
          epochMs: check.epochMs,
          statusCode: check.statusCode,
          availability: check.availability,
          isDown: check.isDown,
          latencyMs: check.latencyMs,
          agent: check.agent,
          region: check.region,
          createdAt: new Date()
        }));

        const BATCH_SIZE = 1000;
        for (let i = 0; i < docsToInsert.length; i += BATCH_SIZE) {
          const batch = docsToInsert.slice(i, i + BATCH_SIZE);
          await checksCollection.insertMany(batch, { ordered: false });
        }
      }
    } catch (dbErr) {
      console.warn('MongoDB Atlas persistence note:', dbErr.message);
    }

    return res.status(200).json({
      success: true,
      uploadId,
      summary: uploadSummary,
      stats: slaStats,
      rejectedSamples: rejectedRecords.slice(0, 10)
    });
  } catch (err) {
    console.error('Error in /api/upload:', err);
    return res.status(500).json({ error: 'Failed to process CSV file', details: err.message });
  }
}
