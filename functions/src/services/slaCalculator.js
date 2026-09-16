/**
 * Computes SLA statistics, percentiles, per-service breakdowns, and detected incidents.
 */

/**
 * Calculates the p-th percentile from a sorted array of numbers.
 * @param {Array<number>} sortedArr 
 * @param {number} p (0 to 100)
 * @returns {number}
 */
function calculatePercentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedArr[lower];
  }
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Calculates complete SLA statistics from cleaned checks.
 *
 * @param {Array<Object>} checks - Cleaned check objects
 * @param {number} slaTarget - Target availability percentage (default 99.9)
 * @returns {Object} SLA Statistics Object
 */
function calculateSlaStats(checks, slaTarget = 99.9) {
  if (!checks || checks.length === 0) {
    return {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      availability: 0,
      slaTarget,
      slaStatus: 'NO_DATA',
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      dateRange: { from: null, to: null },
      services: {},
      incidents: []
    };
  }

  let totalSuccessful = 0;
  let totalFailed = 0;
  const allLatencies = [];
  const servicesMap = {};
  let minEpoch = Infinity;
  let maxEpoch = -Infinity;

  // Group by service
  for (const check of checks) {
    const sId = check.serviceId;
    if (!servicesMap[sId]) {
      servicesMap[sId] = {
        serviceId: sId,
        serviceName: check.serviceName || sId,
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        availability: 0,
        latencies: [],
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        slaTarget,
        slaStatus: 'MET'
      };
    }

    const srv = servicesMap[sId];
    srv.totalChecks++;

    if (check.epochMs) {
      if (check.epochMs < minEpoch) minEpoch = check.epochMs;
      if (check.epochMs > maxEpoch) maxEpoch = check.epochMs;
    }

    if (check.availability === 1) {
      totalSuccessful++;
      srv.successfulChecks++;
    } else {
      totalFailed++;
      srv.failedChecks++;
    }

    if (check.latencyMs !== null && check.latencyMs !== undefined) {
      allLatencies.push(check.latencyMs);
      srv.latencies.push(check.latencyMs);
    }
  }

  // Calculate overall metrics
  const totalChecks = checks.length;
  const rawAvailability = totalChecks > 0 ? (totalSuccessful / totalChecks) * 100 : 0;
  const availability = Math.round(rawAvailability * 1000) / 1000;
  const slaStatus = availability >= slaTarget ? 'MET' : 'BREACHED';

  // Overall latencies
  allLatencies.sort((a, b) => a - b);
  const avgLatency = allLatencies.length > 0
    ? Math.round((allLatencies.reduce((sum, v) => sum + v, 0) / allLatencies.length) * 10) / 10
    : 0;
  const p95Latency = Math.round(calculatePercentile(allLatencies, 95) * 10) / 10;
  const p99Latency = Math.round(calculatePercentile(allLatencies, 99) * 10) / 10;

  // Per-service calculations
  const servicesSummary = {};
  for (const [sId, srv] of Object.entries(servicesMap)) {
    const srvRawAvail = srv.totalChecks > 0 ? (srv.successfulChecks / srv.totalChecks) * 100 : 0;
    srv.availability = Math.round(srvRawAvail * 1000) / 1000;
    srv.slaStatus = srv.availability >= slaTarget ? 'MET' : 'BREACHED';

    srv.latencies.sort((a, b) => a - b);
    srv.averageLatencyMs = srv.latencies.length > 0
      ? Math.round((srv.latencies.reduce((sum, v) => sum + v, 0) / srv.latencies.length) * 10) / 10
      : 0;
    srv.p95LatencyMs = Math.round(calculatePercentile(srv.latencies, 95) * 10) / 10;

    // Delete raw latencies array from summary to save payload size
    delete srv.latencies;
    servicesSummary[sId] = srv;
  }

  // Incident timeline detection (consecutive failures on any service)
  const incidents = detectIncidents(checks);

  return {
    totalChecks,
    successfulChecks: totalSuccessful,
    failedChecks: totalFailed,
    availability,
    slaTarget,
    slaStatus,
    averageLatencyMs: avgLatency,
    p95LatencyMs: p95Latency,
    p99LatencyMs: p99Latency,
    dateRange: {
      from: minEpoch !== Infinity ? new Date(minEpoch).toISOString() : null,
      to: maxEpoch !== -Infinity ? new Date(maxEpoch).toISOString() : null
    },
    services: servicesSummary,
    incidents
  };
}

/**
 * Detects contiguous downtime incident clusters.
 */
function detectIncidents(checks) {
  // Sort checks by timestamp
  const sorted = [...checks].sort((a, b) => (a.epochMs || 0) - (b.epochMs || 0));
  const serviceChecks = {};

  for (const c of sorted) {
    if (!serviceChecks[c.serviceId]) serviceChecks[c.serviceId] = [];
    serviceChecks[c.serviceId].push(c);
  }

  const detectedIncidents = [];

  for (const [serviceId, sChecks] of Object.entries(serviceChecks)) {
    let currentIncident = null;

    for (let i = 0; i < sChecks.length; i++) {
      const c = sChecks[i];
      if (c.isDown) {
        if (!currentIncident) {
          currentIncident = {
            id: `inc-${serviceId}-${c.epochMs}`,
            serviceId,
            serviceName: c.serviceName,
            startTime: c.timestamp,
            startEpochMs: c.epochMs,
            endTime: c.timestamp,
            endEpochMs: c.epochMs,
            errorCount: 1,
            sampleStatusCode: c.statusCode
          };
        } else {
          currentIncident.endTime = c.timestamp;
          currentIncident.endEpochMs = c.epochMs;
          currentIncident.errorCount++;
        }
      } else {
        if (currentIncident) {
          // If incident lasted 2 or more consecutive check intervals (>= 30 mins) or individual notable failure
          const durationMinutes = Math.round((currentIncident.endEpochMs - currentIncident.startEpochMs) / 60000) + 15;
          currentIncident.durationMinutes = durationMinutes;
          detectedIncidents.push(currentIncident);
          currentIncident = null;
        }
      }
    }

    if (currentIncident) {
      const durationMinutes = Math.round((currentIncident.endEpochMs - currentIncident.startEpochMs) / 60000) + 15;
      currentIncident.durationMinutes = durationMinutes;
      detectedIncidents.push(currentIncident);
    }
  }

  // Sort incidents by start time descending
  detectedIncidents.sort((a, b) => (b.startEpochMs || 0) - (a.startEpochMs || 0));

  return detectedIncidents;
}

module.exports = {
  calculatePercentile,
  calculateSlaStats,
  detectIncidents
};
