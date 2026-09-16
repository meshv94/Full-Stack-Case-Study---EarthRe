const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Uploads raw CSV to the Serverless Cloud Function (/api/upload).
 * All parsing, data validation, cleaning, deduplication, and SLA calculations
 * are strictly executed inside the stateless serverless function.
 */
export async function uploadCsvFile(csvContent, filename) {
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent, filename })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || `Serverless upload failed with status ${response.status}`);
    }

    return { source: 'serverless_function', data };
  } catch (err) {
    console.error('Serverless Upload Error:', err);
    throw new Error(`Serverless processing failed: ${err.message}. Please ensure the serverless backend is running.`);
  }
}

/**
 * Fetches computed SLA statistics and metadata from the Serverless API (/api/stats).
 */
export async function fetchDashboardStats(uploadId = null) {
  try {
    const url = uploadId ? `${API_BASE_URL}/stats?uploadId=${uploadId}` : `${API_BASE_URL}/stats`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return json;
    }
    return { hasData: false };
  } catch (err) {
    console.error('Failed to fetch stats from serverless API:', err);
    return { hasData: false };
  }
}

/**
 * Queries filtered and paginated monitoring check records from the Serverless API (/api/logs).
 */
export async function fetchLogs({ serviceId, from, to, status, page = 1, pageSize = 50 }) {
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
      return {
        records: json.records || [],
        totalCount: json.totalCount || 0,
        page: json.page || 1,
        pageSize: json.pageSize || pageSize,
        totalPages: json.totalPages || 1,
        hasMore: json.hasMore || false
      };
    }
  } catch (err) {
    console.error('Failed to fetch logs from serverless API:', err);
  }

  return { records: [], totalCount: 0, page: 1, totalPages: 1 };
}
