import express from "express";
import { pool } from "../db/pool.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

const normalizeOptions = (options) => {
    if (!Array.isArray(options)) {
        return [];
    }

    return options
        .map((option) => {
            if (typeof option === "string") {
                return option.trim();
            }
            if (option && typeof option.text === "string") {
                return option.text.trim();
            }
            return "";
        })
        .filter(Boolean);
};

const mapQuestions = (rows) => {
    const questionsMap = new Map();

    for (const row of rows) {
        if (!questionsMap.has(row.question_id)) {
            questionsMap.set(row.question_id, {
                id: row.question_id,
                question: row.question,
                user: {
                    id: row.user_id,
                    username: row.username
                },
                options: [],
                createdAt: row.created_at
            });
        }

        if (row.option_id) {
            questionsMap.get(row.question_id).options.push({
                id: row.option_id,
                text: row.option_text,
                votes: row.option_votes
            });
        }
    }

    return [...questionsMap.values()];
};

const getQuestionById = async (questionId) => {
    const [questionResult, votesResult] = await Promise.all([
        pool.query(
            `
            SELECT
                q.id AS question_id,
                q.question,
                q.created_at,
                u.id AS user_id,
                u.username,
                o.id AS option_id,
                o.text AS option_text,
                o.votes AS option_votes
            FROM questions q
            INNER JOIN users u ON u.id = q.user_id
            LEFT JOIN options o ON o.question_id = q.id
            WHERE q.id = $1
            ORDER BY o.id ASC
            `,
            [questionId]
        ),
        pool.query(
            `
            SELECT user_id, option_id
            FROM votes
            WHERE question_id = $1
            ORDER BY id ASC
            `,
            [questionId]
        )
    ]);

    if (questionResult.rowCount === 0) {
        return null;
    }

    const question = mapQuestions(questionResult.rows)[0];
    question.votes = votesResult.rows.map((vote) => ({
        userId: vote.user_id,
        optionId: vote.option_id
    }));

    return question;
};

router.post("/createquestion", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
        const { question, options } = req.body;
        const userId = Number(req.user.id);
        const cleanQuestion = typeof question === "string" ? question.trim() : "";
        const cleanOptions = normalizeOptions(options);

        if (!cleanQuestion || cleanOptions.length < 2) {
            return res.status(400).json({
                message: "Question and at least two options are required",
                success: false
            });
        }

        await client.query("BEGIN");

        const insertedQuestion = await client.query(
            `
            INSERT INTO questions (question, user_id)
            VALUES ($1, $2)
            RETURNING id, question, user_id, created_at
            `,
            [cleanQuestion, userId]
        );

        const questionRow = insertedQuestion.rows[0];
        const insertedOptions = [];

        for (const optionText of cleanOptions) {
            const optionResult = await client.query(
                `
                INSERT INTO options (question_id, text)
                VALUES ($1, $2)
                RETURNING id, text, votes
                `,
                [questionRow.id, optionText]
            );
            insertedOptions.push(optionResult.rows[0]);
        }

        await client.query("COMMIT");

        res.status(201).json({
            newQuestion: {
                id: questionRow.id,
                question: questionRow.question,
                user: userId,
                options: insertedOptions,
                votes: [],
                createdAt: questionRow.created_at
            },
            success: true
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating question:", error);
        res.status(500).json({ message: "Internal server error", success: false });
    } finally {
        client.release();
    }
});

router.get("/getallquestions", async (req, res) => {
    try {
        const questionsResult = await pool.query(
            `
            SELECT
                q.id AS question_id,
                q.question,
                q.created_at,
                u.id AS user_id,
                u.username,
                o.id AS option_id,
                o.text AS option_text,
                o.votes AS option_votes
            FROM questions q
            INNER JOIN users u ON u.id = q.user_id
            LEFT JOIN options o ON o.question_id = q.id
            ORDER BY q.created_at DESC, o.id ASC
            `
        );

        res.status(200).json(mapQuestions(questionsResult.rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", success: false });
    }
});

router.post("/votequestion", authMiddleware, async (req, res) => {
    const client = await pool.connect();

    try {
        const questionId = Number(req.body.questionId);
        const optionId = Number(req.body.optionId);
        const userId = Number(req.user.id);

        if (!Number.isInteger(questionId) || !Number.isInteger(optionId)) {
            return res.status(400).json({ message: "Invalid questionId or optionId", success: false });
        }

        await client.query("BEGIN");

        const questionExists = await client.query("SELECT id FROM questions WHERE id = $1", [questionId]);
        if (questionExists.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Question not found" });
        }

        const alreadyVoted = await client.query(
            "SELECT id FROM votes WHERE user_id = $1 AND question_id = $2",
            [userId, questionId]
        );
        if (alreadyVoted.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "You already voted" });
        }

        const optionExists = await client.query(
            "SELECT id FROM options WHERE id = $1 AND question_id = $2",
            [optionId, questionId]
        );
        if (optionExists.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Option not found" });
        }

        await client.query(
            `
            INSERT INTO votes (user_id, question_id, option_id)
            VALUES ($1, $2, $3)
            `,
            [userId, questionId, optionId]
        );

        await client.query(
            `
            UPDATE options
            SET votes = votes + 1
            WHERE id = $1 AND question_id = $2
            `,
            [optionId, questionId]
        );

        await client.query("COMMIT");

        const updatedQuestion = await getQuestionById(questionId);
        res.json({
            success: true,
            message: "Vote successful",
            question: updatedQuestion
        });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({
            message: err.message
        });
    } finally {
        client.release();
    }
});

router.get("/myquestions", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user.id);
        const questionsResult = await pool.query(
            `
            SELECT
                q.id AS question_id,
                q.question,
                q.created_at,
                u.id AS user_id,
                u.username,
                o.id AS option_id,
                o.text AS option_text,
                o.votes AS option_votes
            FROM questions q
            INNER JOIN users u ON u.id = q.user_id
            LEFT JOIN options o ON o.question_id = q.id
            WHERE q.user_id = $1
            ORDER BY q.created_at DESC, o.id ASC
            `,
            [userId]
        );

        res.status(200).json(mapQuestions(questionsResult.rows));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", success: false });
    }
});

export default router;
