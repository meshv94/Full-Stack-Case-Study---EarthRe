import { getDatabase } from './lib/mongodb.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const db = await getDatabase();
    let targetUploadId = req.query.uploadId;

    if (!targetUploadId) {
      const appState = await db.collection('appState').findOne({ _id: 'current' });
      if (appState && appState.activeUploadId) {
        targetUploadId = appState.activeUploadId;
      } else {
        const latestUpload = await db.collection('uploads').find().sort({ uploadedAt: -1 }).limit(1).toArray();
        if (latestUpload && latestUpload.length > 0) {
          targetUploadId = latestUpload[0].uploadId;
        }
      }
    }

    if (!targetUploadId) {
      return res.status(200).json({ hasData: false, message: 'No active upload found.' });
    }

    const uploadDoc = await db.collection('uploads').findOne({ uploadId: targetUploadId });
    if (!uploadDoc) {
      return res.status(200).json({ hasData: false, message: 'Upload not found.' });
    }

    return res.status(200).json({
      hasData: true,
      uploadId: uploadDoc.uploadId,
      summary: {
        filename: uploadDoc.filename,
        uploadedAt: uploadDoc.uploadedAt,
        rowsReceived: uploadDoc.rowsReceived,
        rowsAccepted: uploadDoc.rowsAccepted,
        rowsRejected: uploadDoc.rowsRejected,
        duplicateRows: uploadDoc.duplicateRows,
        invalidStatusRows: uploadDoc.invalidStatusRows,
        negativeLatencyRows: uploadDoc.negativeLatencyRows,
        missingLatencyRows: uploadDoc.missingLatencyRows,
        normalizedUnitRows: uploadDoc.normalizedUnitRows,
        normalizedEpochRows: uploadDoc.normalizedEpochRows,
        dateFrom: uploadDoc.dateFrom,
        dateTo: uploadDoc.dateTo,
        processingStatus: uploadDoc.processingStatus
      },
      stats: uploadDoc.stats
    });
  } catch (err) {
    console.error('Error in /api/stats:', err);
    return res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
}
