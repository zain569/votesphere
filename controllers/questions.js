import express from 'express';
import Question from "../model/question.js";
import Users from "../model/Users.js";
import { authMiddleware } from "./middlewares.js";

const router = express.Router();

//create question

router.post("/createquestion", authMiddleware, async (req, res) => {
    try {
        const { question, options } = req.body;
        const userId = req.user.id;

        // const username = await Users.findById(userId).select("username");

        if (!question || !options || options.length < 2) {
            return res.status(400).json({ message: "Question and at least two options are required", success: false });
        }

        const newQuestion = await Question.create({
            success: true,
            question,
            options: options,
            user: userId
        });
        res.status(201).json({ newQuestion, success: true });

    } catch (error) {
        console.error("Error creating question:", error);
        res.status(500).json({ message: "Internal server error", success: false });
    }
})

router.get("/getallquestions", async (req, res) => {
    try {
        const questions = await Question.find()
            .populate("user", "username") // only get username
            .sort({ createdAt: -1 });

        res.status(200).json(questions);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error", success: false });
    }
})

router.post("/votequestion", authMiddleware, async (req, res) => {
    try {
        const { questionId, optionId } = req.body;
        const userId = req.user.id;

        const question = await Question.findById(questionId);

        if (!question) {
            return res.status(404).json({ message: "Question not found" });
        }

        // ❌ already voted
        const alreadyVoted = question.votes.find(
            v => v.userId.toString() === userId.toString()
        );

        if (alreadyVoted) {
            return res.status(400).json({ message: "You already voted" });
        }

        // ✅ find option
        const option = question.options.id(optionId);

        if (!option) {
            return res.status(404).json({ message: "Option not found" });
        }

        // ✅ increase vote
        option.votes += 1;

        // ✅ save vote
        question.votes.push({
            userId,
            optionId
        });

        await question.save();

        res.json({
            success: true,
            message: "Vote successful",
            question
        });

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
})

router.get("/myquestions", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const questions = await Question.find({ user: userId })
            .populate("user", "username")
            .sort({ createdAt: -1 });

        res.status(200).json(questions);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error", success: false });
    }
});

export default router;