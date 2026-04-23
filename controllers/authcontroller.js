import express from "express";
import Users from "../model/Users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middlewares.js";

const router = express.Router();

//Regsiter Users

router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Remove extra spaces and make sure we always work with strings.
        const cleanUsername = username ? username.trim() : "";
        const cleanEmail = email ? email.trim().toLowerCase() : "";
        const cleanPassword = password ? password.trim() : "";

        if (!cleanUsername || !cleanEmail || !cleanPassword) {
            return res.status(400).json({
                message: "All fields are required",
                success: false
            });
        }

        //Check Can On this Email another User Exist
        const userExist = await Users.findOne({ email: cleanEmail });
        if (userExist) {
            return res.status(400).json({
                message: "Email you Enter is already registered with another account",
                success: false,
                userExist: true
            });
        }

        //Check can anyone take this userName
        const userNameTaken = await Users.findOne({ username: cleanUsername });
        if (userNameTaken) {
            return res.status(400).json({
                message: "Username already taken",
                success: false,
                userNameTaken: true
            });
        }

        const hashedPassword = await bcrypt.hash(cleanPassword, 10);

        const user = await Users.create({
            username: cleanUsername,
            email: cleanEmail,
            password: hashedPassword,
        });

        const token = await new Promise((resolve, reject) => {
            jwt.sign({ email: user.email, id: user._id }, process.env.SECRET_KEY, { expiresIn: '7d' }, (err, token) => {
                if (err) {
                    return reject(err);
                }

                return resolve(token);
            })
        })

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true ONLY if using HTTPS
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "User Registered Successfully",
            success: true,
            username: user.username,
            id: user._id,
        });
    } catch (err) {
        console.log(err);

        return res.status(500).json({
            message: "Something went wrong while registering the user",
            success: false
        });
    }
});

//----------login user----------
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Check Email & Password",
                success: false
            })
        }

        const user = await Users.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Email Not found",
                success: false
            })
        }

        const matchPassword = await bcrypt.compare(password, user.password);

        if (!matchPassword) {
            return res.status(400).json({
                message: "Check Email & Password",
                success: false
            })
        }

        const token = await new Promise((resolve, reject) => {
            jwt.sign({ email: user.email, id: user._id }, process.env.SECRET_KEY, { expiresIn: '7d' }, (err, token) => {
                if (err) {
                    return reject(err);
                }

                return resolve(token);
            })
        })

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true ONLY if using HTTPS
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json({
            message: "Login Successfull",
            success: true,
            username: user.username,
            id: user._id,
        })
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Internal Server Error",
            success: false
        })
    }
})

export default router;
