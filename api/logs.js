import { getDatabase } from './lib/mongodb.js';
import { memoryStore } from './lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    let { uploadId, serviceId, from, to, status, page = 1, pageSize = 50 } = req.query;

    page = parseInt(page, 10) || 1;
    pageSize = Math.min(Math.max(parseInt(pageSize, 10) || 50, 10), 200);

    const db = await getDatabase();

    if (db) {
      if (!uploadId) {
        const appState = await db.collection('appState').findOne({ _id: 'current' });
        if (appState && appState.activeUploadId) {
          uploadId = appState.activeUploadId;
        }
      }

      if (uploadId) {
        const query = { uploadId };

        if (serviceId && serviceId !== 'all') {
          query.serviceId = serviceId;
        }

        if (status === 'errors_only') {
          query.isDown = true;
        } else if (status === 'success_only') {
          query.isDown = false;
        }

        if (from || to) {
          query.timestamp = {};
          if (from) query.timestamp.$gte = new Date(from).toISOString();
          if (to) query.timestamp.$lte = new Date(to).toISOString();
        }

        const checksCollection = db.collection('monitoringChecks');
        const totalCount = await checksCollection.countDocuments(query);
        const totalPages = Math.ceil(totalCount / pageSize) || 1;
        const skip = (page - 1) * pageSize;

        const records = await checksCollection
          .find(query)
          .sort({ epochMs: -1 })
          .skip(skip)
          .limit(pageSize)
          .toArray();

        if (records.length > 0 || totalCount > 0) {
          return res.status(200).json({
            records: records.map(r => ({ ...r, id: r._id.toString() })),
            totalCount,
            page,
            pageSize,
            totalPages,
            hasMore: page < totalPages
          });
        }
      }
    }

    // Memory Store fallback
    const memUploadId = uploadId || memoryStore.activeUploadId;
    if (memUploadId && memoryStore.checks.has(memUploadId)) {
      let filtered = memoryStore.checks.get(memUploadId);

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

      const totalCount = filtered.length;
      const totalPages = Math.ceil(totalCount / pageSize) || 1;
      const skip = (page - 1) * pageSize;
      const records = filtered.slice(skip, skip + pageSize);

      return res.status(200).json({
        records: records.map((r, idx) => ({ ...r, id: `chk-${skip + idx}` })),
        totalCount,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages
      });
    }

    return res.status(200).json({ records: [], totalCount: 0, page: 1, totalPages: 1 });
  } catch (err) {
    console.error('Error in /api/logs:', err);
    return res.status(200).json({ records: [], totalCount: 0, page: 1, totalPages: 1 });
  }
}
