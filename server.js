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
app.use(express.static(path.join(__dirname))); // Serve static files (HTML, CSS, JS)

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
            reason: { type: String, required: true }
        }
    ]
});
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ✅ Register Endpoint
app.post("/register", async (req, res) => {
    const { name, password } = req.body;

    try {
        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "✅ Registration successful" });
    } catch (error) {
        res.status(500).json({ message: "❌ Server error" });
    }
});

// ✅ Login Endpoint
app.post("/login", async (req, res) => {
    const { name, password } = req.body;

    try {
        const user = await User.findOne({ name });
        if (!user) {
            return res.status(400).json({ message: "Invalid username or password" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid username or password" });
        }

        const token = jwt.sign({ name: user.name }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ message: "✅ Login successful", token, user });
    } catch (error) {
        res.status(500).json({ message: "❌ Server error" });
    }
});

// ✅ Get all cadets
app.get("/get-cadets", async (req, res) => {
    try {
        const cadets = await Cadet.find();
        res.json(cadets);
    } catch (error) {
        res.status(500).json({ message: "❌ Error fetching cadets", error: error.message });
    }
});

// ✅ Add a new cadet
app.post("/add-cadets", async (req, res) => {
    const { name, regNo } = req.body;
    if (!name || !regNo) {
        return res.status(400).json({ message: "❌ Name and Reg No are required" });
    }

    try {
        const existingCadet = await Cadet.findOne({ regNo });
        if (existingCadet) {
            return res.status(400).json({ message: "❌ Cadet with this Reg No already exists" });
        }

        const newCadet = new Cadet({ name, regNo });
        await newCadet.save();
        res.status(201).json({ message: "✅ Cadet added successfully" });
    } catch (error) {
        res.status(500).json({ message: "❌ Error adding cadet", error: error.message });
    }
});

// ✅ Remove a cadet
app.delete("/remove-cadets/:id", async (req, res) => {
    try {
        const cadet = await Cadet.findById(req.params.id);
        if (!cadet) {
            return res.status(404).json({ message: "❌ Cadet not found" });
        }

        await cadet.deleteOne();
        res.json({ message: "✅ Cadet removed successfully" });
    } catch (error) {
        res.status(500).json({ message: "❌ Error removing cadet", error: error.message });
    }
});


// ✅ Get Attendance by Date
app.get("/get-attendance-by-date", async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ message: "❌ Date is required" });
    }

    try {
        const attendanceRecord = await Attendance.findOne({ date });
        if (!attendanceRecord) {
            return res.json({ message: "No attendance record found", data: [] });
        }
        res.json(attendanceRecord);
    } catch (error) {
        res.status(500).json({ message: "❌ Error fetching attendance", error: error.message });
    }
});

// ✅ Add or Update Attendance
app.post("/add-attendances", async (req, res) => {
    const { date, attendanceData } = req.body;

    if (!date || !attendanceData || attendanceData.length === 0) {
        return res.status(400).json({ message: "❌ Date and attendance data are required" });
    }

    try {
        const existingAttendance = await Attendance.findOne({ date });

        if (existingAttendance) {
            existingAttendance.attendanceData = attendanceData;
            await existingAttendance.save();
            return res.json({ message: "✅ Attendance updated successfully" });
        }

        const newAttendance = new Attendance({ date, attendanceData });
        await newAttendance.save();
        res.status(201).json({ message: "✅ Attendance recorded successfully" });
    } catch (error) {
        res.status(500).json({ message: "❌ Error saving attendance", error: error.message });
    }
});

// ✅ Get Attendance within Date Range
app.post("/get-attendances", async (req, res) => {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
        return res.status(400).json({ message: "❌ Start and end dates are required" });
    }

    try {
        const records = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        });

        let attendanceSummary = {};

        records.forEach(record => {
            record.attendanceData.forEach(entry => {
                if (!attendanceSummary[entry.regNo]) {
                    attendanceSummary[entry.regNo] = { present: 0, absent: 0, neutral: 0 };
                }
                attendanceSummary[entry.regNo][entry.status]++;
            });
        });

        res.json(attendanceSummary);
    } catch (error) {
        res.status(500).json({ message: "❌ Error fetching attendance data", error: error.message });
    }
});


// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}/`);
});
