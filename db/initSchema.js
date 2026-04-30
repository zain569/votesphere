import { pool } from "./pool.js";

const schemaQueries = [
    `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS options (
        id SERIAL PRIMARY KEY,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        votes INTEGER NOT NULL DEFAULT 0 CHECK (votes >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_vote_per_user_per_question UNIQUE (user_id, question_id)
    );
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_votes_question_id ON votes(question_id);
    `
];

export const initializeDatabase = async () => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        for (const queryText of schemaQueries) {
            await client.query(queryText);
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
