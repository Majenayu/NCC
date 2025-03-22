require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://NCC:NCC@majen.ivckg.mongodb.net/?retryWrites=true&w=majority&appName=Majen";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname))); // Serve static files

// ✅ MongoDB Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// ✅ User Schema & Model
const userSchema = new mongoose.Schema({
    name: String,
    password: String
});
const User = mongoose.model("User", userSchema);

// ✅ Cadet Schema & Model
const cadetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    regNo: { type: String, required: true, unique: true }
});
const Cadet = mongoose.model("Cadet", cadetSchema);

// ✅ Attendance Schema & Model
const attendanceSchema = new mongoose.Schema({
    date: { type: String, required: true },
    attendanceData: [
        {
            regNo: { type: String, required: true },
            status: { type: String, required: true },
            reason: { type: String }
        }
    ]
});
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ✅ Register Endpoint
app.post("/register", async (req, res) => {
    const { name, password } = req.body;
    try {
        if (await User.findOne({ name })) {
            return res.status(400).json({ message: "❌ User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ name, password: hashedPassword }).save();
        res.status(201).json({ message: "✅ Registration successful" });
    } catch (error) {
        res.status(500).json({ message: "❌ Server error", error: error.message });
    }
});

// ✅ Login Endpoint
app.post("/login", async (req, res) => {
    const { name, password } = req.body;
    try {
        const user = await User.findOne({ name });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "❌ Invalid username or password" });
        }
        const token = jwt.sign({ name: user.name }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ message: "✅ Login successful", token, user });
    } catch (error) {
        res.status(500).json({ message: "❌ Server error", error: error.message });
    }
});

// ✅ Get all cadets
app.get("/get-cadets", async (req, res) => {
    try {
        res.json(await Cadet.find());
    } catch (error) {
        res.status(500).json({ message: "❌ Error fetching cadets", error: error.message });
    }
});

// ✅ Add a new cadet
app.post("/add-cadets", async (req, res) => {
    const { name, regNo } = req.body;
    try {
        if (!name || !regNo) return res.status(400).json({ message: "❌ Name and Reg No are required" });
        if (await Cadet.findOne({ regNo })) return res.status(400).json({ message: "❌ Cadet already exists" });
        await new Cadet({ name, regNo }).save();
        res.status(201).json({ message: "✅ Cadet added successfully" });
    } catch (error) {
        res.status(500).json({ message: "❌ Error adding cadet", error: error.message });
    }
});

// ✅ Remove a cadet
app.delete("/remove-cadets/:id", async (req, res) => {
    try {
        if (!(await Cadet.findById(req.params.id))) return res.status(404).json({ message: "❌ Cadet not found" });
        await Cadet.findByIdAndDelete(req.params.id);
        res.json({ message: "✅ Cadet removed successfully" });
    } catch (error) {
        res.status(500).json({ message: "❌ Error removing cadet", error: error.message });
    }
});

// ✅ Add Attendance
app.post("/add-attendances", async (req, res) => {
    const { date, attendanceData } = req.body;
    try {
        if (!date || !attendanceData.length) return res.status(400).json({ message: "❌ Date and attendance data required" });
        await new Attendance({ date, attendanceData }).save();
        res.status(201).json({ message: "✅ Attendance recorded successfully" });
    } catch (error) {
        res.status(500).json({ message: "❌ Error saving attendance", error: error.message });
    }
});

// ✅ Get Attendance Records
app.get("/get-attendances", async (req, res) => {
    try {
        res.json(await Attendance.find());
    } catch (error) {
        res.status(500).json({ message: "❌ Error fetching attendance records", error: error.message });
    }
});

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}/`));
