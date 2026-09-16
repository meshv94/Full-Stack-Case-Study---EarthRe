const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const Busboy = require('busboy');
const { parseCsvContent } = require('./services/csvParser');
const { cleanAndNormalizeData } = require('./services/dataCleaner');
const { calculateSlaStats } = require('./services/slaCalculator');
const {
  saveUploadAndChecks,
  getUploadStats,
  queryLogs
} = require('./services/firestore');

const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/csv', limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'sla-monitoring-api', timestamp: new Date().toISOString() });
});

/**
 * Helper to process CSV string and save to Firestore
 */
async function handleCsvProcessing(csvContent, filename, res) {
  try {
    const rawRecords = parseCsvContent(csvContent);
    if (!rawRecords || rawRecords.length === 0) {
      return res.status(400).json({ error: 'Uploaded CSV file contains no data rows.' });
    }

    const { cleanedChecks, uploadSummary, rejectedRecords } = cleanAndNormalizeData(rawRecords, filename);
    const slaStats = calculateSlaStats(cleanedChecks);

    const uploadId = `upload_${Date.now()}`;
    await saveUploadAndChecks(uploadId, uploadSummary, slaStats, cleanedChecks);

    return res.status(200).json({
      success: true,
      uploadId,
      summary: uploadSummary,
      stats: slaStats,
      rejectedSamples: rejectedRecords.slice(0, 10)
    });
  } catch (err) {
    console.error('Error processing CSV:', err);
    return res.status(500).json({
      error: 'Failed to process CSV file',
      details: err.message
    });
  }
}

/**
 * POST /upload
 * Accepts CSV either as multipart/form-data, raw text/csv body, or base64 JSON payload.
 */
app.post('/upload', (req, res) => {
  // Case 1: JSON payload with csvContent
  if (req.body && typeof req.body === 'object' && req.body.csvContent) {
    const filename = req.body.filename || 'uploaded_checks.csv';
    return handleCsvProcessing(req.body.csvContent, filename, res);
  }

  // Case 2: Raw text/csv
  if (typeof req.body === 'string' && req.body.trim().startsWith('service_id')) {
    const filename = req.query.filename || 'uploaded_checks.csv';
    return handleCsvProcessing(req.body, filename, res);
  }

  // Case 3: Multipart form-data
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = Buffer.from('');
    let uploadedFilename = 'monitoring_checks.csv';
    let fileFound = false;

    busboy.on('file', (name, file, info) => {
      fileFound = true;
      uploadedFilename = info.filename || uploadedFilename;
      file.on('data', (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    });

    busboy.on('finish', async () => {
      if (!fileFound || fileBuffer.length === 0) {
        return res.status(400).json({ error: 'No CSV file found in multipart upload.' });
      }
      return handleCsvProcessing(fileBuffer.toString('utf-8'), uploadedFilename, res);
    });

    busboy.on('error', (err) => {
      console.error('Busboy error:', err);
      res.status(500).json({ error: 'Multipart parsing failed', details: err.message });
    });

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
    return;
  }

  return res.status(400).json({
    error: 'Unsupported content type. Provide multipart/form-data, text/csv, or JSON with csvContent.'
  });
});

/**
 * GET /stats
 * Returns current dashboard SLA statistics and upload summary.
 */
app.get('/stats', async (req, res) => {
  try {
    const uploadId = req.query.uploadId || null;
    const statsData = await getUploadStats(uploadId);

    if (!statsData) {
      return res.status(200).json({
        hasData: false,
        message: 'No active upload found. Please upload a CSV file.'
      });
    }

    return res.status(200).json({
      hasData: true,
      ...statsData
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats', details: err.message });
  }
});

/**
 * GET /logs
 * Returns paginated logs with filtering.
 */
app.get('/logs', async (req, res) => {
  try {
    const { uploadId, serviceId, from, to, status, pageSize, cursor } = req.query;
    const logsResult = await queryLogs({
      uploadId,
      serviceId,
      from,
      to,
      status,
      pageSize,
      cursor
    });

    return res.status(200).json(logsResult);
  } catch (err) {
    console.error('Error fetching logs:', err);
    return res.status(500).json({ error: 'Failed to query logs', details: err.message });
  }
});

// Export Firebase Cloud Function (v2 / v1 compatible onRequest handler)
exports.api = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onRequest(app);
