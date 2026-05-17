import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import "./loadEnv.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to start the backend");
}

// Create a persistent connection pool — connections stay open and ready
const pool = new Pool({
  connectionString,
  max: 10,                      // max concurrent connections
  idleTimeoutMillis: 60_000,    // keep idle connections open for 60s
  connectionTimeoutMillis: 5_000,
});

// Pre-warm: open a connection immediately on startup so the first
// API request doesn't pay the connection cost
pool.connect()
  .then((client) => client.release())
  .catch(() => { /* ignore startup warm-up failure */ });

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
