import 'dotenv/config';
import { MongoClient } from 'mongodb';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

/**
 * Returns connected MongoDB database instance, or null if MONGODB_URI is not set/invalid.
 */
export async function getDatabase(dbName = 'sla_monitoring') {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('cluster0.xxxxx.mongodb.net')) {
    return null;
  }

  try {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    const connectedClient = await global._mongoClientPromise;
    return connectedClient.db(dbName);
  } catch (err) {
    console.warn('Could not connect to MongoDB Atlas, falling back to memory store:', err.message);
    return null;
  }
}
