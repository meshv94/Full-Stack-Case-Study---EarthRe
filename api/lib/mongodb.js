import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR.
  if (!global._mongoClientPromise) {
    if (uri) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  if (uri) {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

/**
 * Returns a connected MongoDB database instance.
 * @param {string} dbName - Database name (defaults to 'sla_monitoring')
 */
export async function getDatabase(dbName = 'sla_monitoring') {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined. Please add it to .env or Vercel Environment Variables.');
  }
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}

export default clientPromise;
