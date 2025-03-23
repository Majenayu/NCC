const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const path = require("path");
const ExcelJS = require("exceljs");
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType } = require("docx");
require("dotenv").config();
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
require("dotenv").config();
const storage = new GridFsStorage({ url: MONGO_URI, file: (req, file) => ({ bucketName: "uploads", filename: `${Date.now()}-${file.originalname}` }) });
const upload = multer({ storage });

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://NCC:NCC@majen.ivckg.mongodb.net/?retryWrites=true&w=majority&appName=Majen";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname))); // Serve static files (HTML, CSS, JS)

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Use mongoose.connection instead of conn
const db = mongoose.connection;

db.once("open", () => {
    console.log("Connected to MongoDB successfully!");
});

db.on("error", (err) => {
    console.error("MongoDB connection error:", err);
});
// ✅ User Schema & Model
const userSchema = new mongoose.Schema({
    name: String,
    password: String
});
const User = mongoose.model("User", userSchema);
// Multer Storage Setup
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });
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
app.get("/download-attendances", async (req, res) => {
    try {
        const { startDate, endDate, format } = req.query;
        if (!startDate || !endDate || !format) return res.status(400).send("Missing parameters");

        // Fetch attendance records within date range
        const records = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        });

        if (records.length === 0) {
            return res.status(404).send("No attendance records found.");
        }

        let cadetMap = new Map();
        let allDates = new Set();

        for (let record of records) {
            allDates.add(record.date);
            record.attendanceData.forEach(entry => {
                if (!cadetMap.has(entry.regNo)) {
                    cadetMap.set(entry.regNo, {
                        name: `Cadet ${entry.regNo}`,
                        attendance: {},
                        totalPresent: 0,
                        totalAttendanceTaken: 0
                    });
                }

                let cadetData = cadetMap.get(entry.regNo);
                cadetData.totalAttendanceTaken++;

                if (entry.status === "✅" || entry.status.toLowerCase() === "present") {
                    cadetData.attendance[record.date] = "✅";
                    cadetData.totalPresent++;
                } else {
                    cadetData.attendance[record.date] = "-";
                }
            });
        }

        let sortedDates = Array.from(allDates).sort();

        if (format === "word") {
            const doc = new Document({
                sections: [{
                    children: [
                        new Paragraph({ text: "Attendance Report", bold: true, size: 32, alignment: "center" }),
                        new Table({
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph("Reg No")] }),
                                        new TableCell({ children: [new Paragraph("Name")] }),
                                        ...sortedDates.map(date => new TableCell({ children: [new Paragraph(date)] })),
                                        new TableCell({ children: [new Paragraph("Total Attendance Taken")] }),
                                        new TableCell({ children: [new Paragraph("Total Present")] })
                                    ]
                                }),
                                ...Array.from(cadetMap).map(([regNo, cadet]) => new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph(regNo)] }),
                                        new TableCell({ children: [new Paragraph(cadet.name)] }),
                                        ...sortedDates.map(date => new TableCell({ children: [new Paragraph(cadet.attendance[date] || "-")] })),
                                        new TableCell({ children: [new Paragraph(cadet.totalAttendanceTaken.toString())] }),
                                        new TableCell({ children: [new Paragraph(cadet.totalPresent.toString())] })
                                    ]
                                }))
                            ]
                        })
                    ]
                }]
            });

            const buffer = await Packer.toBuffer(doc);
            res.setHeader("Content-Disposition", 'attachment; filename="attendance.docx"');
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            res.end(buffer);

        } else if (format === "excel") {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Attendance");
            worksheet.addRow(["Reg No", "Name", ...sortedDates, "Total Attendance Taken", "Total Present"]);

            cadetMap.forEach((cadet, regNo) => {
                let row = [regNo, cadet.name];
                sortedDates.forEach(date => row.push(cadet.attendance[date] || "-"));
                row.push(cadet.totalAttendanceTaken, cadet.totalPresent);
                worksheet.addRow(row);
            });

            res.setHeader("Content-Disposition", 'attachment; filename="attendance.xlsx"');
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            await workbook.xlsx.write(res);
            res.end();
        } else {
            res.status(400).send("Invalid format requested");
        }
    } catch (err) {
        console.error("Error generating report:", err);
        res.status(500).send("Error generating report");
    }
});


let gfs;
db.once("open", () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection("uploads");
    console.log("✅ GridFS is ready for file storage");
});



// ✅ Image Upload Route
app.post("/upload", upload.array("images", 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
    }

    // Store file IDs to retrieve later
    const imageIds = req.files.map(file => file.id);
    res.status(201).json({ message: "✅ Images uploaded successfully", imageIds });
});

// ✅ Retrieve Image by IDapp.get("/image/:id", async (req, res) => {
    try {
        const file = await gfs.files.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
        if (!file || file.length === 0) {
            return res.status(404).json({ message: "❌ No image found" });
        }
        if (file.contentType.startsWith("image")) {
            const readStream = gfs.createReadStream(file._id);
            return readStream.pipe(res);
        }
        res.status(400).json({ message: "❌ Not an image file" });
    } catch (error) {
        res.status(500).json({ message: "❌ Server error", error: error.message });
    }
});




// ✅ Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}/`);
});
