/**
 * In-browser data processing engine.
 * Mirrors the exact same serverless Cloud Function cleaning and SLA calculation logic.
 */

// Simple robust CSV parser for client-side
function parseCsvString(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    const values = [];
    let insideQuotes = false;
    let currentValue = '';

    for (let charIndex = 0; charIndex < currentLine.length; charIndex++) {
      const char = currentLine[charIndex];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue);

    const rowObj = {};
    for (let h = 0; h < headers.length; h++) {
      const hKey = headers[h];
      rowObj[hKey] = values[h] !== undefined ? values[h].trim() : '';
    }
    records.push(rowObj);
  }

  return records;
}

function parseTimestampClient(raw) {
  if (!raw) return { isValid: false };
  const str = String(raw).trim();
  if (!str) return { isValid: false };

  let dateObj;
  let formatDetected = 'iso';

  if (/^\d{9,12}$/.test(str)) {
    dateObj = new Date(parseInt(str, 10) * 1000);
    formatDetected = 'unix';
  } else {
    dateObj = new Date(str);
  }

  if (isNaN(dateObj.getTime())) return { isValid: false };

  return {
    isValid: true,
    isoUTC: dateObj.toISOString(),
    epochMs: dateObj.getTime(),
    dateObj,
    formatDetected
  };
}

function parseLatencyClient(rawLatency, rawUnit = 'ms') {
  if (rawLatency === null || rawLatency === undefined || String(rawLatency).trim() === '') {
    return { isValid: true, latencyMs: null, wasEmpty: true, wasConverted: false };
  }

  const num = Number(rawLatency);
  if (isNaN(num)) return { isValid: false };
  if (num < 0) return { isValid: false, isNegative: true };

  const unit = String(rawUnit || 'ms').trim().toLowerCase();
  let latencyMs = num;
  let wasConverted = false;

  if (unit === 's' || unit === 'sec' || unit === 'seconds') {
    latencyMs = Math.round(num * 1000 * 100) / 100;
    wasConverted = true;
  }

  return { isValid: true, latencyMs, wasEmpty: false, wasConverted };
}

function calculatePercentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

export function processCsvLocally(csvContent, filename = 'monitoring_checks.csv') {
  const rawRecords = parseCsvString(csvContent);
  if (rawRecords.length === 0) {
    throw new Error('CSV file is empty or invalid.');
  }

  const uploadSummary = {
    filename,
    uploadedAt: new Date().toISOString(),
    rowsReceived: rawRecords.length,
    rowsAccepted: 0,
    rowsRejected: 0,
    duplicateRows: 0,
    invalidStatusRows: 0,
    negativeLatencyRows: 0,
    missingLatencyRows: 0,
    invalidTimestampRows: 0,
    normalizedUnitRows: 0,
    normalizedEpochRows: 0,
    dateFrom: null,
    dateTo: null,
    servicesCount: 0,
    processingStatus: 'COMPLETED'
  };

  const seenRows = new Set();
  const validChecks = [];
  const servicesSet = new Set();
  let minDate = null;
  let maxDate = null;

  for (let i = 0; i < rawRecords.length; i++) {
    const raw = rawRecords[i];
    const fingerprint = `${raw.service_id}|${raw.service_name}|${raw.timestamp}|${raw.status_code}|${raw.latency}|${raw.latency_unit}|${raw.agent}|${raw.region}`;
    
    if (seenRows.has(fingerprint)) {
      uploadSummary.duplicateRows++;
      uploadSummary.rowsRejected++;
      continue;
    }
    seenRows.add(fingerprint);

    const tsResult = parseTimestampClient(raw.timestamp);
    if (!tsResult.isValid) {
      uploadSummary.invalidTimestampRows++;
      uploadSummary.rowsRejected++;
      continue;
    }
    if (tsResult.formatDetected === 'unix') {
      uploadSummary.normalizedEpochRows++;
    }

    const statusCode = parseInt(raw.status_code, 10);
    if (isNaN(statusCode) || statusCode < 100 || statusCode > 599 || statusCode === 999) {
      uploadSummary.invalidStatusRows++;
      uploadSummary.rowsRejected++;
      continue;
    }

    const latResult = parseLatencyClient(raw.latency, raw.latency_unit);
    if (!latResult.isValid) {
      if (latResult.isNegative) uploadSummary.negativeLatencyRows++;
      uploadSummary.rowsRejected++;
      continue;
    }

    if (latResult.wasEmpty) uploadSummary.missingLatencyRows++;
    if (latResult.wasConverted) uploadSummary.normalizedUnitRows++;

    if (!minDate || tsResult.dateObj < minDate) minDate = tsResult.dateObj;
    if (!maxDate || tsResult.dateObj > maxDate) maxDate = tsResult.dateObj;

    const sId = raw.service_id || 'unknown-service';
    servicesSet.add(sId);
    const isAvail = statusCode >= 200 && statusCode < 300;

    validChecks.push({
      id: `chk-${validChecks.length + 1}`,
      serviceId: sId,
      serviceName: raw.service_name || sId,
      timestamp: tsResult.isoUTC,
      epochMs: tsResult.epochMs,
      statusCode,
      availability: isAvail ? 1 : 0,
      isDown: !isAvail,
      latencyMs: latResult.latencyMs,
      agent: raw.agent || 'agent-1',
      region: raw.region || 'ap-south-1'
    });
  }

  uploadSummary.rowsAccepted = validChecks.length;
  uploadSummary.dateFrom = minDate ? minDate.toISOString() : null;
  uploadSummary.dateTo = maxDate ? maxDate.toISOString() : null;
  uploadSummary.servicesCount = servicesSet.size;

  // SLA Calculation
  let totalSuccessful = 0;
  let totalFailed = 0;
  const allLatencies = [];
  const servicesMap = {};

  for (const check of validChecks) {
    const sId = check.serviceId;
    if (!servicesMap[sId]) {
      servicesMap[sId] = {
        serviceId: sId,
        serviceName: check.serviceName,
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        availability: 0,
        latencies: [],
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        slaTarget: 99.9,
        slaStatus: 'MET'
      };
    }

    const srv = servicesMap[sId];
    srv.totalChecks++;
    if (check.availability === 1) {
      totalSuccessful++;
      srv.successfulChecks++;
    } else {
      totalFailed++;
      srv.failedChecks++;
    }

    if (check.latencyMs !== null) {
      allLatencies.push(check.latencyMs);
      srv.latencies.push(check.latencyMs);
    }
  }

  const totalChecks = validChecks.length;
  const rawAvailability = totalChecks > 0 ? (totalSuccessful / totalChecks) * 100 : 0;
  const availability = Math.round(rawAvailability * 1000) / 1000;
  const slaStatus = availability >= 99.9 ? 'MET' : 'BREACHED';

  allLatencies.sort((a, b) => a - b);
  const avgLatency = allLatencies.length > 0
    ? Math.round((allLatencies.reduce((sum, v) => sum + v, 0) / allLatencies.length) * 10) / 10
    : 0;
  const p95Latency = Math.round(calculatePercentile(allLatencies, 95) * 10) / 10;
  const p99Latency = Math.round(calculatePercentile(allLatencies, 99) * 10) / 10;

  const servicesSummary = {};
  for (const [sId, srv] of Object.entries(servicesMap)) {
    const srvRawAvail = srv.totalChecks > 0 ? (srv.successfulChecks / srv.totalChecks) * 100 : 0;
    srv.availability = Math.round(srvRawAvail * 1000) / 1000;
    srv.slaStatus = srv.availability >= 99.9 ? 'MET' : 'BREACHED';
    srv.latencies.sort((a, b) => a - b);
    srv.averageLatencyMs = srv.latencies.length > 0
      ? Math.round((srv.latencies.reduce((sum, v) => sum + v, 0) / srv.latencies.length) * 10) / 10
      : 0;
    srv.p95LatencyMs = Math.round(calculatePercentile(srv.latencies, 95) * 10) / 10;
    delete srv.latencies;
    servicesSummary[sId] = srv;
  }

  // Detect continuous incidents
  const sortedChecks = [...validChecks].sort((a, b) => a.epochMs - b.epochMs);
  const incidents = [];
  const srvIncMap = {};

  for (const c of sortedChecks) {
    if (c.isDown) {
      if (!srvIncMap[c.serviceId]) {
        srvIncMap[c.serviceId] = {
          id: `inc-${c.serviceId}-${c.epochMs}`,
          serviceId: c.serviceId,
          serviceName: c.serviceName,
          startTime: c.timestamp,
          startEpochMs: c.epochMs,
          endTime: c.timestamp,
          endEpochMs: c.epochMs,
          errorCount: 1,
          sampleStatusCode: c.statusCode
        };
      } else {
        srvIncMap[c.serviceId].endTime = c.timestamp;
        srvIncMap[c.serviceId].endEpochMs = c.epochMs;
        srvIncMap[c.serviceId].errorCount++;
      }
    } else if (srvIncMap[c.serviceId]) {
      const inc = srvIncMap[c.serviceId];
      inc.durationMinutes = Math.round((inc.endEpochMs - inc.startEpochMs) / 60000) + 15;
      incidents.push(inc);
      delete srvIncMap[c.serviceId];
    }
  }

  for (const sId of Object.keys(srvIncMap)) {
    const inc = srvIncMap[sId];
    inc.durationMinutes = Math.round((inc.endEpochMs - inc.startEpochMs) / 60000) + 15;
    incidents.push(inc);
  }

  incidents.sort((a, b) => b.startEpochMs - a.startEpochMs);

  return {
    summary: uploadSummary,
    stats: {
      totalChecks,
      successfulChecks: totalSuccessful,
      failedChecks: totalFailed,
      availability,
      slaTarget: 99.9,
      slaStatus,
      averageLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      p99LatencyMs: p99Latency,
      dateRange: { from: uploadSummary.dateFrom, to: uploadSummary.dateTo },
      services: servicesSummary,
      incidents
    },
    checks: validChecks
  };
}
