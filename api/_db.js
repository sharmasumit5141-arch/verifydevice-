import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI; // ← MONGODB_URI se MONGO_URI kiya
let client;
let db;

export async function connectDB() {
  if (db) return db;
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  db = client.db(process.env.DB_NAME || "captcha_db");
  return db;
}
