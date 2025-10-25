import express from "express";
import Exercise from "../models/Exercise.js";

const router = express.Router();

// Alle Übungen abrufen
router.get("/", async (req, res) => {
  console.log("GET /api/exercises aufgerufen", req.headers);
  try {
    const { category, muscleGroup, equipment } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (muscleGroup) filter.muscleGroups = { $in: [muscleGroup] };
    if (equipment) filter.equipment = equipment;

    const exercises = await Exercise.find(filter).sort({ name: 1 });
    res.json(exercises);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
