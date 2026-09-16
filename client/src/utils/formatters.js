/**
 * Formatting and helper utilities for UI presentation.
 */

export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toUTCString().replace('GMT', 'UTC');
  } catch {
    return String(dateString);
  }
}

export function formatDateShort(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return String(dateString);
  }
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    const datePart = d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: '2-digit'
    });
    const timePart = d.toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${datePart} ${timePart} UTC`;
  } catch {
    return String(dateString);
  }
}

export function formatLatency(latencyMs) {
  if (latencyMs === null || latencyMs === undefined || isNaN(latencyMs)) {
    return '—';
  }
  return `${Math.round(latencyMs * 10) / 10} ms`;
}

export function formatPercentage(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.000%';
  return `${Number(val).toFixed(3)}%`;
}

export function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString();
}

export function getStatusDetails(statusCode) {
  const code = parseInt(statusCode, 10);
  switch (code) {
    case 200:
      return { label: '200 OK', type: 'success', desc: 'Healthy response' };
    case 500:
      return { label: '500 Server Error', type: 'error', desc: 'Internal error' };
    case 502:
      return { label: '502 Bad Gateway', type: 'error', desc: 'Gateway failure' };
    case 503:
      return { label: '503 Unavailable', type: 'error', desc: 'Service overloaded' };
    case 504:
      return { label: '504 Timeout', type: 'error', desc: 'Gateway timeout' };
    case 999:
      return { label: '999 Non-Standard', type: 'invalid', desc: 'Rejected code' };
    default:
      if (code >= 200 && code < 300) return { label: `${code} OK`, type: 'success', desc: 'Success' };
      if (code >= 500) return { label: `${code} Error`, type: 'error', desc: 'Server error' };
      return { label: String(statusCode), type: 'warning', desc: 'Unknown' };
  }
}
