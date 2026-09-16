# SLA Monitoring Dashboard & Automated Reliability Engine

A production-grade SLA Monitoring Dashboard and automated data-cleaning pipeline built to turn raw, messy multi-agent cloud health logs into dependable SLA compliance numbers and actionable operational insights.

---

## 1. Architecture: What Runs Where & Why

```mermaid
flowchart LR
    subgraph Frontend [Client Layer]
        UI[Single-Screen React + Vite App\nFirebase Hosting]
    end

    subgraph Serverless [Stateless Compute Layer]
        CF[Stateless Cloud Function\nFirebase / GCP Cloud Functions\n(Node.js)]
        Parser[CSV Streaming Parser]
        Cleaner[Data Cleaner & Normalizer]
        SLACalc[SLA & Stats Engine]
    end

    subgraph Persistence [Database Layer]
        Firestore[(Cloud Firestore)]
        UploadsCol[(uploads collection\nAggregates & Summary)]
        ChecksCol[(monitoringChecks collection\nIndexed Checks)]
    end

    UI -->|HTTPS POST /upload| CF
    CF --> Parser --> Cleaner --> SLACalc
    SLACalc -->|Batch Writes <= 450| Firestore
    Firestore --> UploadsCol
    Firestore --> ChecksCol
    UI -->|GET /stats & GET /logs| CF
    UI -.->|Direct Read| Firestore
```

### Architectural Decisions & Rationale

1. **Upload UI & Dashboard (React.js + Vite hosted on Firebase Hosting):**
   - Single-screen dashboard delivering zero-latency responsive interactions.
   - Built with Vanilla CSS design tokens (Deep Slate Obsidian theme, glassmorphic cards, micro-animations) for high aesthetic polish without Tailwind overhead.
   - Hosted globally on Firebase CDN Hosting for rapid static delivery.

2. **Stateless Processing Layer (Firebase Cloud Functions / Node.js):**
   - **True Stateless Cloud Execution:** All CSV parsing, row-level validation, anomaly rejection, unit normalization, deduplication, and SLA aggregation run strictly inside a deployed stateless serverless function.
   - Computes summary metadata and percentiles in memory before persisting, reducing redundant database reads.

3. **Persistence Layer (Cloud Firestore):**
   - Structured into two collections:
     - `uploads/{uploadId}`: Stores aggregate SLA metrics, availability %, P95 latency, date ranges, and complete rejection/cleaning audit numbers.
     - `monitoringChecks/{checkDocId}`: Stores normalized checks indexed by `(uploadId, timestamp desc, serviceId, isDown)` for fast date-range filtering and pagination.
   - Batch writes in chunks of 450 documents to stay comfortably under Firestore's 500-write limit and 20k free-tier daily quotas.

---

## 2. Data Findings: Quality Issues & Handling Strategy

Through automated data auditing across all provided datasets (`9d`, `12d`, `14d`, `21d`, `30d`), we identified and resolved the following data flaws:

| Flaw Category | Specific Discovery in Logs | Handling & Pipeline Resolution |
| :--- | :--- | :--- |
| **1. Timestamp Discrepancies** | Mixed ISO-8601 UTC (`2025-05-13T12:45:00Z`), ISO with timezone offsets (`+05:30`), and 10-digit Unix epoch timestamps (`1746938700`). | Normalizer detects epoch seconds vs ISO strings and parses them into canonical UTC ISO timestamps and epoch milliseconds. |
| **2. Chronological Disorder** | Rows are randomly shuffled in the CSV files. | Checks are indexed by UTC timestamp and sorted chronologically during query and SLA incident window analysis. |
| **3. Latency Unit Mismatch** | ~20% of latency entries are in seconds (`latency_unit = 's'`, e.g., `0.717`) while others are in milliseconds (`707 ms`). | Normalized all latencies to milliseconds (`latencyMs = s * 1000`). |
| **4. Negative Latency** | Exactly 1 row per dataset has physically impossible negative latency (e.g. `-296 ms`, `-342 ms`). | Rejected from cleaned dataset and SLA calculations; recorded in upload rejection audit metadata. |
| **5. Missing Latency** | 56 to 186 rows per file have empty latency (`200,,ms`), even on successful checks. | Retained as available healthy checks with `latencyMs = null`, omitting them from latency percentile calculations without penalizing service availability. |
| **6. Invalid HTTP Status 999** | Exactly 1 row per dataset contains non-standard HTTP status code `999`. | Flagged and purged as invalid status code; excluded from uptime/downtime totals. |
| **7. Exact Duplicate Rows** | 6 to 24 exact duplicate rows repeated verbatim per file. | Filtered out via in-memory deduplication fingerprinting. |
| **8. Multi-Agent Redundancy & Conflicts** | Multiple agents (`agent-1`, `agent-2`) monitoring the same 15-minute slot. In `14d`, `agent-1` reported `999` while `agent-2` reported `200`. | Invalid checks are purged first. If any reporting agent detects a 5xx outage during a 15-minute slot, the service interval is marked degraded for that window. |

---

## 3. Assumptions & Key Design Decisions

1. **SLA Calculation Formula & Target (99.9%):**
   $$\text{Availability } \% = \left( \frac{\text{Successful Valid Checks (2xx)}}{\text{Total Valid Cleaned Checks}} \right) \times 100$$
   - Any check with HTTP `200..299` is considered available.
   - Any check with HTTP `500..599` is considered downtime.
   - Any dataset resulting in $< 99.900\%$ is marked **`BREACHED`** (triggering automatic billing credit eligibility); $\ge 99.900\%$ is marked **`MET`**.

2. **Choice of Statistics Displayed:**
   - **Hero Availability Gauge & SLA Delta:** Instantly answers whether the SLA was met or breached and by how many percentage points.
   - **Total, Passed, and Failed Checks:** Provides immediate scale and concrete failure counts.
   - **Average & P95 / P99 Latency:** P95 latency reflects true tail latency experienced by end-users during degraded intervals.
   - **Service-by-Service Grid:** Allows on-call engineers to pinpoint which microservice (`svc-reports`, `svc-payments`, `svc-auth`, etc.) caused the breach.
   - **Pipeline Cleaning Audit:** Transparency on how many duplicates and anomalies were pruned from the raw CSV.

3. **Multi-Agent Interval Policy:**
   - One SLA interval is defined by `(serviceId, 15-minute timestamp slot)`.
   - Outage policy: *If any valid agent check reports a server failure (5xx), the interval is counted as degraded.*

---

## 4. Local Development & Deployment Guide

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- Firebase CLI (`npm install -g firebase-tools`)

### Local Setup & Running
```bash
# 1. Clone repository
git clone <your-repo-url>
cd SLA_Monitoring_Dashboard

# 2. Install dependencies (root, client, and functions)
npm install
npm --prefix client install
npm --prefix functions install

# 3. Run automated test suites (17 tests across all 5 datasets)
npm test

# 4. Start frontend development server
npm run dev
```

The frontend will start at `http://localhost:5173`. It includes built-in quick loaders for all 5 sample datasets (`9d`, `12d`, `14d`, `21d`, `30d`) and custom CSV upload support.

### Deploying to Firebase
```bash
# 1. Login to Firebase
firebase login

# 2. Link your Firebase project (Blaze plan required for Cloud Functions)
firebase use <your-firebase-project-id>

# 3. Build frontend bundle
npm run build:client

# 4. Deploy all resources (Hosting, Cloud Functions, Firestore Rules)
firebase deploy
```

---

## 5. What We'd Do Differently With More Time

1. **Streaming Multi-GB Uploads via Cloud Storage Triggers:**
   - For CSVs exceeding hundreds of megabytes, accept direct uploads to a signed Cloud Storage bucket URL and trigger an asynchronous background Cloud Function with Node.js streams.
2. **Automated Incident Root-Cause Correlation:**
   - Group consecutive 5xx intervals into automated Incident Reports with estimated dollar-value SLA penalty calculations.
3. **Real-time Webhook / Slack Alerts:**
   - Trigger alert dispatches to PagerDuty or Slack whenever an upload causes a monthly SLA availability breach.
4. **Time-Series Latency & Error Distribution Charts:**
   - Add interactive canvas heatmaps showing latency spikes and agent-region latency deltas over time.
