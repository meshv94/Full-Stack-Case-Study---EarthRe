import { processCsvLocally } from './localEngine';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-memory cache for state management and instant local responsiveness
let currentActiveData = null;

/**
 * Uploads CSV to the serverless backend function
 */
export async function uploadCsvFile(csvContent, filename) {
  // 1. Send to Vercel Serverless Function (/api/upload)
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent, filename })
    });

    if (response.ok) {
      const data = await response.json();
      currentActiveData = data;
      return { source: 'serverless_api', data };
    }
  } catch (err) {
    console.warn('API fetch warning, using local processing fallback:', err);
  }

  // 2. Local fallback if API is not running locally
  const localResult = processCsvLocally(csvContent, filename);
  const uploadId = `upload_${Date.now()}`;

  currentActiveData = {
    uploadId,
    summary: localResult.summary,
    stats: localResult.stats,
    checks: localResult.checks
  };

  return { source: 'local_engine', data: currentActiveData };
}

/**
 * Fetches current active SLA statistics from the serverless backend
 */
export async function fetchDashboardStats(uploadId = null) {
  try {
    const url = uploadId ? `${API_BASE_URL}/stats?uploadId=${uploadId}` : `${API_BASE_URL}/stats`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.hasData) return json;
    }
  } catch (err) {
    // API offline
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

/**
 * Queries paginated monitoring logs with filters from the serverless backend
 */
export async function fetchLogs({ serviceId, from, to, status, page = 1, pageSize = 50 }) {
  // 1. Try remote Serverless API
  try {
    const params = new URLSearchParams({
      serviceId: serviceId || 'all',
      status: status || 'all',
      page: String(page),
      pageSize: String(pageSize),
      ...(from && { from }),
      ...(to && { to })
    });
    const res = await fetch(`${API_BASE_URL}/logs?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.records) return json;
    }
  } catch (err) {
    // remote query offline
  }

  // 2. If in-memory checks exist
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

  return { records: [], totalCount: 0, page: 1, totalPages: 1 };
}
