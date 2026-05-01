// lib/mongodb.js
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error("Please define MONGO_URI environment variable");
}

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

async function getCollection(botId) {
  const client = await clientPromise;
  const db = client.db("device_verify");
  // Har bot ka alag collection — sanitize botId for collection name
  const safeBotId = String(botId).replace(/[^a-zA-Z0-9_]/g, "_");
  return db.collection(`bot_${safeBotId}`);
}

module.exports = { getCollection };
