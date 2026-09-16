const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Saves upload metadata, SLA stats, and cleaned check records in batches to Firestore.
 *
 * @param {string} uploadId 
 * @param {Object} uploadSummary 
 * @param {Object} slaStats 
 * @param {Array<Object>} cleanedChecks 
 */
async function saveUploadAndChecks(uploadId, uploadSummary, slaStats, cleanedChecks) {
  // 1. Save upload metadata doc
  const uploadRef = db.collection('uploads').doc(uploadId);
  await uploadRef.set({
    ...uploadSummary,
    uploadId,
    stats: slaStats,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Set current active upload pointer
  const appStateRef = db.collection('appState').doc('current');
  await appStateRef.set({
    activeUploadId: uploadId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 3. Batch write check records into monitoringChecks collection
  // Firestore batch limit is 500 writes
  const BATCH_SIZE = 450;
  for (let i = 0; i < cleanedChecks.length; i += BATCH_SIZE) {
    const chunk = cleanedChecks.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (let j = 0; j < chunk.length; j++) {
      const check = chunk[j];
      const checkDocId = `${uploadId}_${check.serviceId}_${check.epochMs}_${check.agent || 'ag'}_${j}`;
      const docRef = db.collection('monitoringChecks').doc(checkDocId);
      
      batch.set(docRef, {
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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
  }

  return { uploadId, recordsSaved: cleanedChecks.length };
}

/**
 * Retrieves latest active upload ID or specified upload stats.
 */
async function getActiveUploadId() {
  const currentDoc = await db.collection('appState').doc('current').get();
  if (currentDoc.exists && currentDoc.data().activeUploadId) {
    return currentDoc.data().activeUploadId;
  }
  
  // Fallback: find latest from uploads collection
  const latestSnapshot = await db.collection('uploads')
    .orderBy('uploadedAt', 'desc')
    .limit(1)
    .get();

  if (!latestSnapshot.empty) {
    return latestSnapshot.docs[0].id;
  }
  return null;
}

/**
 * Retrieves dashboard stats and upload summary for a given uploadId.
 */
async function getUploadStats(uploadId) {
  let targetId = uploadId;
  if (!targetId) {
    targetId = await getActiveUploadId();
  }

  if (!targetId) {
    return null;
  }

  const doc = await db.collection('uploads').doc(targetId).get();
  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  return {
    uploadId: targetId,
    summary: {
      filename: data.filename,
      uploadedAt: data.uploadedAt,
      rowsReceived: data.rowsReceived,
      rowsAccepted: data.rowsAccepted,
      rowsRejected: data.rowsRejected,
      duplicateRows: data.duplicateRows,
      invalidStatusRows: data.invalidStatusRows,
      negativeLatencyRows: data.negativeLatencyRows,
      missingLatencyRows: data.missingLatencyRows,
      normalizedUnitRows: data.normalizedUnitRows,
      normalizedEpochRows: data.normalizedEpochRows,
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      processingStatus: data.processingStatus
    },
    stats: data.stats
  };
}

/**
 * Queries monitoring logs with filtering and pagination.
 */
async function queryLogs({ uploadId, serviceId, from, to, status, pageSize = 50, cursor = null }) {
  let targetId = uploadId;
  if (!targetId) {
    targetId = await getActiveUploadId();
  }

  if (!targetId) {
    return { records: [], totalCount: 0, nextCursor: null, activeUploadId: null };
  }

  let query = db.collection('monitoringChecks')
    .where('uploadId', '==', targetId);

  if (serviceId && serviceId !== 'all') {
    query = query.where('serviceId', '==', serviceId);
  }

  if (status === 'errors_only') {
    query = query.where('isDown', '==', true);
  } else if (status === 'success_only') {
    query = query.where('isDown', '==', false);
  }

  if (from) {
    const fromIso = new Date(from).toISOString();
    query = query.where('timestamp', '>=', fromIso);
  }

  if (to) {
    const toIso = new Date(to).toISOString();
    query = query.where('timestamp', '<=', toIso);
  }

  query = query.orderBy('timestamp', 'desc');

  const limitNum = Math.min(Math.max(parseInt(pageSize, 10) || 50, 10), 200);
  query = query.limit(limitNum + 1);

  if (cursor) {
    const cursorDoc = await db.collection('monitoringChecks').doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  const records = [];
  let nextCursor = null;

  const docs = snapshot.docs;
  const hasMore = docs.length > limitNum;
  const docsToProcess = hasMore ? docs.slice(0, limitNum) : docs;

  for (const doc of docsToProcess) {
    const data = doc.data();
    records.push({
      id: doc.id,
      ...data
    });
  }

  if (hasMore && docsToProcess.length > 0) {
    nextCursor = docsToProcess[docsToProcess.length - 1].id;
  }

  return {
    records,
    nextCursor,
    pageSize: limitNum,
    activeUploadId: targetId
  };
}

module.exports = {
  db,
  saveUploadAndChecks,
  getActiveUploadId,
  getUploadStats,
  queryLogs
};
