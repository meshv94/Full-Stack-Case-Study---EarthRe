import { processCsvLocally } from './localEngine';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-memory cache for state management and offline capability
let currentActiveData = null;

export async function uploadCsvFile(csvContent, filename) {
  // First, try uploading to Firebase Cloud Function if available
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
    console.warn('Backend Cloud Function unreachable, falling back to browser processing engine.');
  }

  // Fallback to in-browser deterministic processing engine
  const localResult = processCsvLocally(csvContent, filename);
  currentActiveData = {
    uploadId: `local_${Date.now()}`,
    summary: localResult.summary,
    stats: localResult.stats,
    checks: localResult.checks
  };

  return { source: 'local_engine', data: currentActiveData };
}

export async function fetchDashboardStats(uploadId) {
  try {
    const url = uploadId ? `${API_BASE_URL}/stats?uploadId=${uploadId}` : `${API_BASE_URL}/stats`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.hasData) return json;
    }
  } catch {
    // Cloud fetch failed
  }

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
  // If we have local checks in memory
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

    // Sort by timestamp desc
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

  // Fallback to remote API
  try {
    const params = new URLSearchParams({
      serviceId: serviceId || 'all',
      status: status || 'all',
      pageSize: String(pageSize),
      ...(from && { from }),
      ...(to && { to })
    });
    const res = await fetch(`${API_BASE_URL}/logs?${params.toString()}`);
    if (res.ok) return await res.json();
  } catch {
    // remote failed
  }

  return { records: [], totalCount: 0, page: 1, totalPages: 1 };
}

export async function loadPresetDataset(filename) {
  const res = await fetch(`/datasets/${filename}`);
  if (!res.ok) {
    throw new Error(`Failed to load preset dataset: ${filename}`);
  }
  const text = await res.text();
  return uploadCsvFile(text, filename);
}
