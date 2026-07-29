import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (db) return db;

  const mongoUri = process.env.MONGODB_URI;
  const mongoDbName = process.env.MONGODB_DB_NAME || 'hublet';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(mongoDbName);
  return db;
}

export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
