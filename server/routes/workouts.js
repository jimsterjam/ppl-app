import express from "express";
import Workout from "../models/Workout.js";
import { requireAuth } from '../middleware/clerkAuth.js';


const router = express.Router();

// Alle Workouts für den eingeloggten User holen
router.get("/", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const workouts = await Workout.find({ userId })
      .sort({ date: -1 }); // Neueste zuerst
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Einzelnes Workout anhand ID holen
router.get("/:id", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const workout = await Workout.findOne({ 
      _id: req.params.id, 
      userId 
    });
    
    if (!workout) {
      return res.status(404).json({ error: "Workout nicht gefunden" });
    }
    
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neues Workout anlegen
router.post("/", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const workout = await Workout.create({
      ...req.body,
      userId
    });
    res.status(201).json(workout);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Workout aktualisieren
router.put("/:id", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!workout) {
      return res.status(404).json({ error: "Workout nicht gefunden" });
    }
    
    res.json(workout);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Workout löschen
router.delete("/:id", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    const workout = await Workout.findOneAndDelete({ 
      _id: req.params.id, 
      userId 
    });
    
    if (!workout) {
      return res.status(404).json({ error: "Workout nicht gefunden" });
    }
    
    res.json({ message: "Workout erfolgreich gelöscht", workout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workout-Statistiken für den User
router.get("/stats/overview", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth();
    
    // Gesamt-Statistiken
    const totalWorkouts = await Workout.countDocuments({ userId });
    
    const totalDuration = await Workout.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: null, total: { $sum: "$duration" } } }
    ]);
    
    // Workouts der letzten 7 Tage
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentWorkouts = await Workout.countDocuments({
      userId,
      date: { $gte: lastWeek }
    });
    
    res.json({
      totalWorkouts,
      totalDuration: totalDuration[0]?.total || 0,
      recentWorkouts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
