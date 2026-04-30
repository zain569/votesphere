import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
          user: process.env.PGUSER || "postgres",
          host: process.env.PGHOST || "localhost",
          database: process.env.PGDATABASE || "votingApp",
          password: process.env.PGPASSWORD || "",
          port: Number(process.env.PGPORT) || 5432
      };

export const pool = new Pool(connectionConfig);
