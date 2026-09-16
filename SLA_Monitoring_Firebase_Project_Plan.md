# SLA Monitoring Dashboard — Firebase Project Plan

## 1. Goal

Build a single-screen SLA Monitoring Dashboard that:

1. Lets a user upload a CSV.
2. Sends the upload to a **deployed Firebase Cloud Function**.
3. Parses, validates, cleans, and normalizes the data in the cloud function.
4. Persists cleaned data in **Cloud Firestore**.
5. Queries persisted data later.
6. Shows SLA/operational statistics.
7. Shows underlying monitoring logs with single-date or date-range filtering.

The assignment requires a real deployed stateless serverless function, so the Firebase backend should use **Cloud Functions**, not a local/hosted Express server. The required flow is upload UI → serverless function → persistent database → dashboard. 

## 2. Technology Stack

- **Frontend:** React.js + Vite
- **Backend:** Firebase Cloud Functions (Node.js)
- **Database:** Cloud Firestore
- **Hosting:** Firebase Hosting
- **CSV parsing:** `csv-parse`
- **Development:** npm, Firebase CLI, Git, GitHub
- **Testing:** Vitest/Jest for data-processing logic

## 3. Architecture

```text
User
  |
  v
React + Vite
  |
  | HTTPS upload/query
  v
Firebase Cloud Functions
  |
  +--> Parse CSV
  +--> Validate
  +--> Clean/normalize
  +--> Deduplicate
  +--> Calculate SLA metadata
  |
  v
Cloud Firestore
  |
  v
Stats + Logs queries
  |
  v
React Dashboard

Firebase Hosting -> hosts React application
```

### Important architectural rule

Do not deploy a traditional Express server and call that serverless. The CSV processing must execute inside the deployed Firebase Cloud Function.

## 4. Firestore Data Model

### `uploads`

One document per uploaded CSV:

```text
uploads/{uploadId}

{
  filename,
  uploadedAt,
  rowsReceived,
  rowsAccepted,
  rowsRejected,
  duplicateRows,
  invalidStatusRows,
  negativeLatencyRows,
  missingLatencyRows,
  dateFrom,
  dateTo,
  processingStatus
}
```

### `monitoringChecks`

Cleaned monitoring observations:

```text
monitoringChecks/{checkId}

{
  uploadId,
  serviceId,
  serviceName,
  timestamp,
  statusCode,
  availability,
  latencyMs,
  agent,
  region,
  createdAt
}
```

If multiple agents reporting the same service/timestamp are aggregated into one canonical check, store enough information to make that decision auditable.

## 5. Data Cleaning Rules

The source data is intentionally messy, so these rules must be implemented and documented.

### Timestamp

Support both ISO-8601 and Unix epoch timestamps and normalize them to UTC Firestore timestamps.

### Latency

Normalize all latency to milliseconds:

```text
ms -> same value
s  -> value * 1000
```

Store the canonical value as `latencyMs`.

### Missing latency

A missing latency measurement should not automatically mean downtime. A record with a valid successful status but no latency can remain an available check with `latencyMs = null`.

### Invalid status

The supplied data contains `999`, which is not a valid HTTP status code. Reject/exclude it from SLA calculations and record the rejection in upload metadata.

### Negative latency

Negative latency is invalid. Reject/exclude it from the cleaned dataset and SLA calculations.

### Exact duplicates

Remove exact duplicate rows and report how many were removed.

### Multiple monitoring agents

The data is multi-agent. Define and document what constitutes one SLA interval. A reasonable starting assumption is `serviceId + timestamp` as the canonical interval, followed by an explicit deterministic rule for conflicting agent observations. Validate this against the supplied datasets before finalizing it.

## 6. SLA Calculation

The assignment uses a 99.9% availability threshold.

Basic formula:

```text
Availability % = successful valid checks / total valid checks * 100
```

Invalid records should not silently become successful or failed service checks.

Recommended dashboard metrics:

- Availability %
- SLA target (99.9%)
- SLA status
- Total checks
- Successful checks
- Failed checks
- Average latency
- P95 latency
- Data range
- Last upload time

## 7. Dashboard Layout

One page with two main sections.

### Top: collapsible statistics

```text
+------------------------------------------------------+
| SLA Statistics                              [Collapse]|
+------------------------------------------------------+
| Availability | SLA Target | Status                  |
| 99.82%       | 99.90%     | BREACHED                |
|                                                      |
| Total Checks | Successful | Failed                  |
| 14,400       | 14,374     | 26                      |
|                                                      |
| Avg Latency | P95 Latency | Data Range              |
| 214 ms      | 742 ms      | Apr 06 - May 05         |
+------------------------------------------------------+
```

### Bottom: logs

```text
+------------------------------------------------------+
| Monitoring Logs                                     |
+------------------------------------------------------+
| From [date]  To [date]  [Apply] [Clear]             |
+------------------------------------------------------+
| Timestamp | Service | Status | Latency | Agent      |
+------------------------------------------------------+
| ...                                                  |
+------------------------------------------------------+
```

Implement loading, error, empty, and pagination states.

## 8. Backend Functions

Keep the backend simple for the 6–8 hour scope.

### `processUpload`

```text
POST /upload
```

Responsibilities:

- Receive CSV
- Parse CSV
- Validate columns/rows
- Normalize timestamps
- Normalize latency
- Validate status codes
- Remove duplicates
- Apply multi-agent rule
- Save cleaned data
- Save upload summary
- Return processing result

### `getDashboardStats`

Returns:

```json
{
  "availability": 99.82,
  "slaTarget": 99.9,
  "slaStatus": "BREACHED",
  "totalChecks": 14400,
  "successfulChecks": 14374,
  "failedChecks": 26,
  "averageLatencyMs": 214,
  "p95LatencyMs": 742
}
```

### `getLogs`

Supports:

```text
from
 to
 pageSize
 cursor
```

Use Firestore queries and pagination rather than loading every record into the browser.

## 9. Project Structure

```text
sla-monitoring-dashboard/
|
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CsvUpload.jsx
│   │   │   ├── StatsSection.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── DateFilter.jsx
│   │   │   ├── LogsTable.jsx
│   │   │   └── LoadingState.jsx
│   │   ├── services/api.js
│   │   ├── utils/formatters.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
|
├── functions/
│   ├── src/
│   │   ├── index.js
│   │   ├── upload.js
│   │   ├── stats.js
│   │   ├── logs.js
│   │   ├── services/
│   │   │   ├── csvParser.js
│   │   │   ├── dataCleaner.js
│   │   │   ├── slaCalculator.js
│   │   │   └── firestore.js
│   │   └── utils/
│   │       ├── timestamp.js
│   │       └── latency.js
│   └── package.json
|
├── tests/
│   ├── dataCleaner.test.js
│   ├── timestamp.test.js
│   ├── latency.test.js
│   └── slaCalculator.test.js
|
├── firebase.json
├── firestore.rules
├── .firebaserc
├── .gitignore
└── README.md
```

## 10. Step-by-Step Roadmap

### Phase 1 — Data analysis

1. Inspect all five CSV files.
2. Determine actual date ranges rather than assuming them.
3. Find all services, agents, regions, status codes, latency units, missing values, invalid values, and duplicates.
4. Produce a data-quality report.
5. Finalize cleaning rules.
6. Finalize the multi-agent aggregation assumption.
7. Finalize the SLA formula.

### Phase 2 — React/Vite

1. Create the Vite React app.
2. Build the single dashboard page.
3. Add CSV upload UI.
4. Add collapsible stats section.
5. Add date/date-range filter.
6. Add logs table.
7. Add loading/error/empty states.

### Phase 3 — Firebase

1. Create Firebase project.
2. Enable Firestore.
3. Enable Cloud Functions.
4. Configure Firebase Hosting.
5. Initialize the project with Firebase CLI.
6. Set appropriate Firestore rules.

### Phase 4 — Cloud Function

Implement in this order:

```text
Request
  -> CSV extraction
  -> CSV parsing
  -> required-column validation
  -> timestamp normalization
  -> latency normalization
  -> status validation
  -> negative-latency validation
  -> exact duplicate handling
  -> multi-agent aggregation
  -> Firestore writes
  -> upload summary
```

### Phase 5 — Firestore

1. Create `uploads` collection.
2. Create `monitoringChecks` collection.
3. Add required indexes for date/service queries.
4. Verify data survives after the function invocation finishes.

### Phase 6 — Stats and Logs

1. Implement `getDashboardStats`.
2. Implement `getLogs`.
3. Add date filtering.
4. Add range filtering.
5. Add pagination.
6. Test boundary dates carefully.

### Phase 7 — Frontend integration

1. Connect upload form to Cloud Function.
2. Display upload processing result.
3. Refresh dashboard after successful upload.
4. Connect stats API/function.
5. Connect logs API/function.
6. Add filter reset.

### Phase 8 — Testing

Test:

- ISO timestamp
- Unix timestamp
- Invalid timestamp
- `ms` latency
- `s` latency
- Missing latency
- Negative latency
- Valid HTTP statuses
- Invalid `999` status
- Exact duplicates
- Multiple agents
- 99.9% SLA boundary
- SLA below 99.9%
- Empty result date range
- Pagination

### Phase 9 — Dataset validation

Upload and validate all supplied datasets:

- 9-day dataset
- 12-day dataset
- 14-day dataset
- 21-day dataset
- 30-day dataset

Use the supplied incident metadata as a validation reference. Confirm that the dashboard exposes the expected incident periods rather than hard-coding them into the application.

### Phase 10 — Deployment

Deploy:

```text
React -> Firebase Hosting
Cloud Function -> Firebase Cloud Functions
Database -> Firestore
```

Then test the actual public URL from a clean browser/session.

### Phase 11 — README

Include:

1. Project overview
2. Architecture diagram
3. Technology choices and reasons
4. Data-quality findings
5. Cleaning rules
6. SLA calculation
7. Multi-agent assumption
8. Dashboard/statistics decisions
9. Local setup
10. Deployment/redeployment steps
11. Live URL
12. Testing information
13. What would be improved with more time

## 11. Git Commit Plan

Commit incrementally:

```text
chore: initialize React Vite project
feat: add dashboard layout
feat: add CSV upload interface
chore: initialize Firebase project
feat: add Cloud Function upload processing
feat: add CSV validation and normalization
feat: add Firestore persistence
feat: add SLA statistics calculation
feat: add logs date filtering
feat: add dashboard loading and error states
test: add data processing tests
docs: document data quality findings
docs: document architecture and assumptions
feat: deploy application
```

## 12. Time Budget

Target the assignment's 6–8 focused hours:

```text
Hour 1  -> Data analysis + decisions
Hour 2  -> React UI + Firebase setup
Hour 3  -> Cloud Function + CSV parsing
Hour 4  -> Cleaning + Firestore
Hour 5  -> Stats + logs
Hour 6  -> Frontend integration
Hour 7  -> Testing + deployment
Hour 8  -> README + final verification
```

If time becomes limited, prioritize:

1. Correct data processing
2. Real deployed Cloud Function
3. Firestore persistence
4. Upload
5. SLA stats
6. Logs/date filtering
7. Deployment
8. README

Do not spend most of the time on animations or unnecessary features.

## 13. Definition of Done

- [ ] React/Vite application works
- [ ] CSV upload UI works
- [ ] Upload reaches deployed Firebase Cloud Function
- [ ] Function parses CSV
- [ ] Function validates data
- [ ] Function cleans/normalizes data
- [ ] Timestamp formats are normalized
- [ ] Latency units are normalized
- [ ] Invalid status is handled
- [ ] Negative latency is handled
- [ ] Duplicate rows are handled
- [ ] Multi-agent rule is documented
- [ ] Clean data is persisted in Firestore
- [ ] Persisted data is queryable after upload
- [ ] Stats section works
- [ ] Stats section collapses/expands
- [ ] SLA availability is calculated
- [ ] SLA target is shown
- [ ] Logs view works
- [ ] Single-date filter works
- [ ] Date-range filter works
- [ ] Pagination works
- [ ] Loading/error/empty states work
- [ ] Frontend is deployed
- [ ] Cloud Function is deployed
- [ ] Firestore is configured
- [ ] Live URL works
- [ ] README is complete
- [ ] Git history shows incremental work
- [ ] All supplied datasets have been tested

## 14. Core Principle

Keep the application small, explainable, and trustworthy.

The strongest submission is not the one with the most features. It is the one where you can clearly explain:

```text
CSV
  -> validation
  -> cleaning
  -> normalization
  -> aggregation
  -> Firestore
  -> SLA calculation
  -> dashboard
```

and defend every important data and architecture decision during the follow-up discussion.
