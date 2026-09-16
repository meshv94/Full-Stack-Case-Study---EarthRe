import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 4000,
  socketTimeoutMS: 30000
};

let client;
let clientPromise = null;

if (uri && !uri.includes('cluster0.xxxxx.mongodb.net')) {
  try {
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
      }
      clientPromise = global._mongoClientPromise;
    } else {
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
    }
  } catch (err) {
    console.warn('MongoDB connection initialization error:', err.message);
  }
}

/**
 * Returns connected MongoDB database instance, or null if MONGODB_URI is not set/invalid.
 */
export async function getDatabase(dbName = 'sla_monitoring') {
  if (!clientPromise) {
    return null;
  }
  try {
    const connectedClient = await clientPromise;
    return connectedClient.db(dbName);
  } catch (err) {
    console.warn('Could not connect to MongoDB Atlas, falling back to memory store:', err.message);
    return null;
  }
}

export default clientPromise;
