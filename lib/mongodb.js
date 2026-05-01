// lib/mongo.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI environment variable not set');

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

async function getDb() {
  const c = await clientPromise;
  return c.db('device_verify');
}

module.exports = { getDb };
