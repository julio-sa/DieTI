import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const dbName = 'DieTI';

let client;
let collection_reset_tokens;

async function init() {
  if (collection_reset_tokens) return;

  client = new MongoClient(uri);
  await client.connect();
  
  const db = client.db(dbName);
  collection_reset_tokens = db.collection('password_reset_tokens');
}

init();

export { collection_reset_tokens, client as mongoClient };