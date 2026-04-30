import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";

const router = express.Router();

const createToken = (payload) =>
    new Promise((resolve, reject) => {
        jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "7d" }, (err, token) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(token);
        });
    });

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000
    };
};

router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const cleanUsername = typeof username === "string" ? username.trim() : "";
        const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        const cleanPassword = typeof password === "string" ? password.trim() : "";

        if (!cleanUsername || !cleanEmail || !cleanPassword) {
            return res.status(400).json({
                message: "All fields are required",
                success: false
            });
        }

        const userExistsByEmail = await pool.query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
        if (userExistsByEmail.rowCount > 0) {
            return res.status(400).json({
                message: "Email you Enter is already registered with another account",
                success: false,
                userExist: true
            });
        }

        const userExistsByUsername = await pool.query("SELECT id FROM users WHERE username = $1", [cleanUsername]);
        if (userExistsByUsername.rowCount > 0) {
            return res.status(400).json({
                message: "Username already taken",
                success: false,
                userNameTaken: true
            });
        }

        const hashedPassword = await bcrypt.hash(cleanPassword, 10);
        const insertUser = await pool.query(
            `
            INSERT INTO users (username, email, password)
            VALUES ($1, $2, $3)
            RETURNING id, username, email
            `,
            [cleanUsername, cleanEmail, hashedPassword]
        );

        const user = insertUser.rows[0];
        const token = await createToken({ email: user.email, id: user.id });

        res.cookie("token", token, getCookieOptions());

        return res.status(200).json({
            message: "User Registered Successfully",
            success: true,
            username: user.username,
            id: user.id
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "Something went wrong while registering the user",
            success: false
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        const cleanPassword = typeof password === "string" ? password : "";

        if (!cleanEmail || !cleanPassword) {
            return res.status(400).json({
                message: "Check Email & Password",
                success: false
            });
        }

        const userQuery = await pool.query("SELECT id, username, email, password FROM users WHERE email = $1", [cleanEmail]);
        if (userQuery.rowCount === 0) {
            return res.status(400).json({
                message: "Email Not found",
                success: false
            });
        }

        const user = userQuery.rows[0];
        const matchPassword = await bcrypt.compare(cleanPassword, user.password);

        if (!matchPassword) {
            return res.status(400).json({
                message: "Check Email & Password",
                success: false
            });
        }

        const token = await createToken({ email: user.email, id: user.id });
        res.cookie("token", token, getCookieOptions());

        return res.status(200).json({
            message: "Login Successfull",
            success: true,
            username: user.username,
            token: token,
            id: user.id
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "Internal Server Error",
            success: false
        });
    }
});

export default router;
