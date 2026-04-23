import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import authRoutes from "./controllers/authcontroller.js"
import questionsRoutes from "./controllers/questions.js"

dotenv.config();

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:5173","https://votesphere1.netlify.app"],
    credentials: true
}));

//connect database
mongoose.connect(process.env.MONGODB_URL,{
    dbName: 'Voting_app'
})
.then(() => console.log("MongoDB connected successfully🔌"))
.catch((error) => console.log("MongoDb Connection failed📴", error));

//Routes for Connect Frontend and backend

app.use("/api/auth", authRoutes); 
app.use("/api/questions", questionsRoutes);

app.listen(process.env.PORT, () => {
    console.log("Server is running on port", process.env.PORT);
})