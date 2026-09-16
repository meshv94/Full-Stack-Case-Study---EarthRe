import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAlYoFhItC0PVDJ0qD_Y_vxpzdfwHOT9bk",
  authDomain: "earthre-43f7e.firebaseapp.com",
  projectId: "earthre-43f7e",
  storageBucket: "earthre-43f7e.firebasestorage.app",
  messagingSenderId: "456075891877",
  appId: "1:456075891877:web:d7447b750e3dee552c694c",
  measurementId: "G-5NJKPLJBSV"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Saves upload metadata and check records into Cloud Firestore
 */
export async function saveToFirestore(uploadId, uploadSummary, slaStats, cleanedChecks) {
  // 1. Save upload summary doc
  const uploadDocRef = doc(db, 'uploads', uploadId);
  await setDoc(uploadDocRef, {
    ...uploadSummary,
    uploadId,
    stats: slaStats,
    createdAt: serverTimestamp()
  });

  // 2. Set current active pointer
  const appStateRef = doc(db, 'appState', 'current');
  await setDoc(appStateRef, {
    activeUploadId: uploadId,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // 3. Batch write checks in chunks of 450
  const BATCH_SIZE = 450;
  for (let i = 0; i < cleanedChecks.length; i += BATCH_SIZE) {
    const chunk = cleanedChecks.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (let j = 0; j < chunk.length; j++) {
      const check = chunk[j];
      const checkDocId = `${uploadId}_${check.serviceId}_${check.epochMs}_${check.agent || 'ag'}_${j}`;
      const checkRef = doc(db, 'monitoringChecks', checkDocId);
      
      batch.set(checkRef, {
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
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();
  }

  return { uploadId, count: cleanedChecks.length };
}

/**
 * Loads latest active upload stats from Firestore
 */
export async function loadStatsFromFirestore(uploadId = null) {
  try {
    let targetId = uploadId;
    if (!targetId) {
      const appStateSnap = await getDoc(doc(db, 'appState', 'current'));
      if (appStateSnap.exists()) {
        targetId = appStateSnap.data().activeUploadId;
      }
    }

    if (!targetId) return { hasData: false };

    const uploadSnap = await getDoc(doc(db, 'uploads', targetId));
    if (!uploadSnap.exists()) return { hasData: false };

    const data = uploadSnap.data();
    return {
      hasData: true,
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
  } catch (err) {
    console.error('Error reading stats from Firestore:', err);
    return { hasData: false };
  }
}

/**
 * Queries monitoring checks directly from Firestore
 */
export async function queryFirestoreLogs({ uploadId, serviceId, from, to, status, page = 1, pageSize = 50 }) {
  try {
    let targetId = uploadId;
    if (!targetId) {
      const appStateSnap = await getDoc(doc(db, 'appState', 'current'));
      if (appStateSnap.exists()) {
        targetId = appStateSnap.data().activeUploadId;
      }
    }

    if (!targetId) return { records: [], totalCount: 0, page: 1, totalPages: 1 };

    const checksRef = collection(db, 'monitoringChecks');
    const constraints = [
      where('uploadId', '==', targetId)
    ];

    if (serviceId && serviceId !== 'all') {
      constraints.push(where('serviceId', '==', serviceId));
    }
    if (status === 'errors_only') {
      constraints.push(where('isDown', '==', true));
    } else if (status === 'success_only') {
      constraints.push(where('isDown', '==', false));
    }
    if (from) {
      constraints.push(where('timestamp', '>=', new Date(from).toISOString()));
    }
    if (to) {
      constraints.push(where('timestamp', '<=', new Date(to).toISOString()));
    }

    constraints.push(orderBy('timestamp', 'desc'));
    constraints.push(limit(500)); // Retrieve page slice

    const q = query(checksRef, ...constraints);
    const querySnapshot = await getDocs(q);

    const allDocs = [];
    querySnapshot.forEach((d) => {
      allDocs.push({ id: d.id, ...d.data() });
    });

    const totalCount = allDocs.length;
    const startIndex = (page - 1) * pageSize;
    const records = allDocs.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return {
      records,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    };
  } catch (err) {
    console.error('Error querying Firestore logs:', err);
    return { records: [], totalCount: 0, page: 1, totalPages: 1 };
  }
}
