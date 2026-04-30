import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./controllers/authController.js";
import questionsRoutes from "./controllers/questionsController.js";
import { pool } from "./db/pool.js";
import { initializeDatabase } from "./db/initSchema.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5470;

app.use(cookieParser());
app.use(express.json());
app.use(
    cors({
        origin: ["http://localhost:5173", "https://votesphere1.netlify.app"],
        credentials: true
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionsRoutes);

const startServer = async () => {
    try {
        await pool.query("SELECT 1");
        await initializeDatabase();
        console.log("PostgreSQL connected successfully");

        app.listen(port, () => {
            console.log("Server is running on port", port);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
