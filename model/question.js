import mongoose from "mongoose";
import Users from "../model/Users.js";

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 }
});

const voteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  optionId: mongoose.Schema.Types.ObjectId
});

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },

    options: [optionSchema],

    votes: [voteSchema],

    user: { type: mongoose.Schema.Types.ObjectId, ref: "users" }
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);