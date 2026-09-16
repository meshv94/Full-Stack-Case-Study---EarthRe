import { getDatabase } from './lib/mongodb.js';

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
    const db = await getDatabase();
    let { uploadId, serviceId, from, to, status, page = 1, pageSize = 50 } = req.query;

    page = parseInt(page, 10) || 1;
    pageSize = Math.min(Math.max(parseInt(pageSize, 10) || 50, 10), 200);

    if (!uploadId) {
      const appState = await db.collection('appState').findOne({ _id: 'current' });
      if (appState && appState.activeUploadId) {
        uploadId = appState.activeUploadId;
      }
    }

    if (!uploadId) {
      return res.status(200).json({ records: [], totalCount: 0, page: 1, totalPages: 1 });
    }

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

    return res.status(200).json({
      records: records.map(r => ({ ...r, id: r._id.toString() })),
      totalCount,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    });
  } catch (err) {
    console.error('Error in /api/logs:', err);
    return res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
  }
}
