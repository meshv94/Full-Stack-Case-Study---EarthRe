import { processCsvLocally } from './localEngine';
import {
  saveToFirestore,
  loadStatsFromFirestore,
  queryFirestoreLogs
} from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-memory cache for state management
let currentActiveData = null;

export async function uploadCsvFile(csvContent, filename) {
  // 1. Try uploading to Firebase Cloud Function if deployed
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent, filename })
    });

    if (response.ok) {
      const data = await response.json();
      currentActiveData = data;
      return { source: 'cloud_function', data };
    }
  } catch {
    // Cloud Function endpoint offline or in local dev
  }

  // 2. Process data and persist directly to Cloud Firestore
  const localResult = processCsvLocally(csvContent, filename);
  const uploadId = `upload_${Date.now()}`;

  try {
    await saveToFirestore(
      uploadId,
      localResult.summary,
      localResult.stats,
      localResult.checks
    );
  } catch (firestoreErr) {
    console.warn('Direct Firestore save failed, using local memory state:', firestoreErr);
  }

  currentActiveData = {
    uploadId,
    summary: localResult.summary,
    stats: localResult.stats,
    checks: localResult.checks
  };

  return { source: 'firestore', data: currentActiveData };
}

export async function fetchDashboardStats(uploadId = null) {
  // Try remote API first
  try {
    const url = uploadId ? `${API_BASE_URL}/stats?uploadId=${uploadId}` : `${API_BASE_URL}/stats`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.hasData) return json;
    }
  } catch {
    // remote fetch failed
  }

  // Try direct Firestore read
  try {
    const firestoreStats = await loadStatsFromFirestore(uploadId);
    if (firestoreStats && firestoreStats.hasData) {
      return firestoreStats;
    }
  } catch {
    // Firestore read failed
  }

  // In-memory fallback
  if (currentActiveData) {
    return {
      hasData: true,
      uploadId: currentActiveData.uploadId,
      summary: currentActiveData.summary,
      stats: currentActiveData.stats
    };
  }

  return { hasData: false };
}

export async function fetchLogs({ serviceId, from, to, status, page = 1, pageSize = 50 }) {
  // 1. If in-memory checks exist
  if (currentActiveData && currentActiveData.checks) {
    let filtered = currentActiveData.checks;

    if (serviceId && serviceId !== 'all') {
      filtered = filtered.filter(c => c.serviceId === serviceId);
    }

    if (status === 'errors_only') {
      filtered = filtered.filter(c => c.isDown);
    } else if (status === 'success_only') {
      filtered = filtered.filter(c => !c.isDown);
    }

    if (from) {
      const fromDate = new Date(from);
      filtered = filtered.filter(c => new Date(c.timestamp) >= fromDate);
    }

    if (to) {
      const toDate = new Date(to);
      filtered = filtered.filter(c => new Date(c.timestamp) <= toDate);
    }

    filtered.sort((a, b) => b.epochMs - a.epochMs);

    const totalCount = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const records = filtered.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return {
      records,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    };
  }

  // 2. Try Firestore direct query
  try {
    const firestoreLogs = await queryFirestoreLogs({
      serviceId,
      from,
      to,
      status,
      page,
      pageSize
    });
    if (firestoreLogs.records && firestoreLogs.records.length > 0) {
      return firestoreLogs;
    }
  } catch {
    // Firestore query failed
  }

  return { records: [], totalCount: 0, page: 1, totalPages: 1 };
}
