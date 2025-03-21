const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// Define Cadet Schema
const cadetSchema = new mongoose.Schema({
    name: String,
    regNo: String
});

const Cadet = mongoose.model("Cadet", cadetSchema);

// Get all cadets
router.get("/get-cadets", async (req, res) => {
    try {
        const cadets = await Cadet.find();
        res.json(cadets);
    } catch (error) {
        res.status(500).json({ message: "Error fetching cadets" });
    }
});

// Add a new cadet
router.post("/add-cadets", async (req, res) => {
    const { name, regNo } = req.body;
    try {
        const newCadet = new Cadet({ name, regNo });
        await newCadet.save();
        res.status(201).json({ message: "Cadet added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error adding cadet" });
    }
});

// Remove a cadet
router.delete("/remove-cadets/:id", async (req, res) => {
    try {
        await Cadet.findByIdAndDelete(req.params.id);
        res.json({ message: "Cadet removed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error removing cadet" });
    }
});

module.exports = router;
