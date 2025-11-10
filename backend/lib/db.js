import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const dbName = 'DieTI';

let client;
let collection_reset_tokens;

async function connectDB() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }

  if (!collection_reset_tokens) {
    const db = client.db(dbName);
    collection_reset_tokens = db.collection('password_reset_tokens');
  }
  return collection_reset_tokens;
}

export { connectDB, collection_reset_tokens };