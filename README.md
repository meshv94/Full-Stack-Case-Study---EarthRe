# SLA Monitoring Dashboard — Vercel + MongoDB Atlas

A production-grade SLA Monitoring Dashboard and automated data-cleaning pipeline built with **React + Vite**, **Vercel Stateless Serverless Functions**, and **MongoDB Atlas** to turn raw, messy multi-agent cloud health logs into trustworthy SLA compliance metrics and actionable operational insights.

---

## 1. Architecture: What Runs Where & Why

```mermaid
flowchart LR
    subgraph Frontend [Client Layer]
        UI[Single-Screen React + Vite Dashboard\nHosted on Vercel CDN]
    end

    subgraph Serverless [Stateless Compute Layer]
        API[Vercel Serverless Function\n/api/upload on AWS Lambda\n(Node.js)]
        Parser[CSV Parser]
        Cleaner[Data Cleaner & Normalizer]
        SLACalc[SLA & Stats Engine]
    end

    subgraph Persistence [Database Layer]
        Mongo[(MongoDB Atlas M0 Database\nFree Tier Cluster)]
        UploadsCol[(uploads collection\nAggregates & SLA Stats)]
        ChecksCol[(monitoringChecks collection\nIndexed Checks)]
    end

    UI -->|POST /api/upload| API
    API --> Parser --> Cleaner --> SLACalc
    SLACalc -->|insertMany batch| Mongo
    Mongo --> UploadsCol
    Mongo --> ChecksCol
    UI -->|GET /api/stats & GET /api/logs| API
```

### Architectural Decisions & Rationale

1. **Upload UI & Dashboard (React + Vite on Vercel):**
   - Single-screen dashboard delivering fast, responsive interactions.
   - Built with Vanilla CSS design tokens (Deep Slate Obsidian theme, glassmorphic cards, micro-animations) for high aesthetic polish.
   - Hosted globally on Vercel's edge network for rapid delivery.

2. **Stateless Processing Layer (Vercel Serverless Functions):**
   - **True Stateless Cloud Execution:** All CSV parsing, row-level validation, anomaly rejection, unit normalization, deduplication, and SLA aggregation run strictly inside a deployed stateless serverless function on AWS Lambda (`/api/upload`).
   - Returns full processing audit numbers and SLA statistics immediately upon upload.

3. **Persistence Layer (MongoDB Atlas):**
   - Stores datasets across two collections:
     - `uploads`: Stores dataset filename, upload timestamp, cleaning audit numbers, and precomputed SLA summary JSON.
     - `monitoringChecks`: Stores normalized checks with compound indexes `{ uploadId: 1, epochMs: -1, serviceId: 1 }` for instant date-range filtering and pagination.
   - Utilizes `insertMany(batch, { ordered: false })` to insert 15,000+ checks in milliseconds.

---

## 2. Data Findings: Quality Issues & Handling Strategy

Through automated data auditing across all provided datasets (`9d`, `12d`, `14d`, `21d`, `30d`), we discovered and resolved the following data quality issues:

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
- MongoDB Atlas free cluster connection string

### Setup & Local Running
```bash
# 1. Clone repository
git clone <your-repo-url>
cd SLA_Monitoring_Dashboard

# 2. Install dependencies
npm install
npm --prefix client install

# 3. Create .env file with your MongoDB connection string
cp .env.example .env
# Edit .env and set MONGODB_URI=mongodb+srv://...

# 4. Run automated test suites (17 tests across all 5 datasets)
npm test

# 5. Start local backend API server (runs on port 5001)
npm run dev:api

# 6. Start frontend client (in a separate terminal)
npm run dev
```

Open `http://localhost:5173` to access the dashboard.

### Deploying to Vercel (100% Free)
```bash
# 1. Install Vercel CLI (optional) or push to GitHub
npm install -g vercel
vercel

# 2. Add MONGODB_URI to Vercel Environment Variables:
# In Vercel Project Settings -> Environment Variables:
# Key: MONGODB_URI
# Value: mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/sla_monitoring?retryWrites=true&w=majority

# 3. Deploy production
vercel --prod
```

---

## 5. What We'd Do Differently With More Time

1. **Streaming Multi-GB Uploads via S3 / Cloud Storage:**
   - For CSVs exceeding hundreds of megabytes, accept direct uploads to signed S3/R2 storage URLs and stream parse directly into MongoDB.
2. **Automated Incident Root-Cause Correlation:**
   - Group consecutive 5xx intervals into automated Incident Reports with estimated dollar-value SLA penalty calculations.
3. **Real-time Webhook / Slack Alerts:**
   - Trigger alert dispatches to PagerDuty or Slack whenever an upload causes a monthly SLA availability breach.
4. **Time-Series Latency & Error Heatmaps:**
   - Add interactive canvas heatmaps showing latency spikes and agent-region latency deltas over time.
