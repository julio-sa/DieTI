// lib/db.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const dbName = 'DieTI';

if (!uri) {
  throw new Error('MONGO_URI não está definido');
}

let client;
let db;
let resetTokensCollection;

async function getDb() {
  if (db) return db;

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ MongoDB conectado');
  }

  db = client.db(dbName);
  return db;
}

export async function getResetTokensCollection() {
  if (resetTokensCollection) return resetTokensCollection;

  const db = await getDb();
  resetTokensCollection = db.collection('password_reset_tokens');
  return resetTokensCollection;
}
