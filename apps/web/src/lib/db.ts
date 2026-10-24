import "server-only";
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set (see apps/web/.env.local)");

// One client per process; dev hot-reload re-evaluates modules, so cache it on globalThis.
const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

// Serverless instances are reused across requests, so the client is cached in every environment.
export const mongoClient = globalForMongo.mongoClient ?? new MongoClient(uri, { maxPoolSize: 10 });
globalForMongo.mongoClient = mongoClient;

export const db: Db = mongoClient.db(process.env.MONGODB_DB || "sandbox");
