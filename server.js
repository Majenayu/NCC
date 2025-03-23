const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { GridFsStorage } = require("multer-gridfs-storage");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const MONGO_URI = process.env.MONGODB_URI || "your_mongodb_connection_string";

let bucket;

// Connect to MongoDB
mongoose
    .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Initialize GridFS Bucket after MongoDB is connected
const db = mongoose.connection;
db.once("open", () => {
    bucket = new mongoose.mongo.GridFSBucket(db.db, { bucketName: "uploads" });
    console.log("✅ GridFS Bucket Initialized");
});

// Multer Storage Setup
const storage = new GridFsStorage({
    url: MONGO_URI,
    options: { useNewUrlParser: true, useUnifiedTopology: true },
    file: (req, file) => {
        return {
            filename: `${Date.now()}-${file.originalname}`,
            bucketName: "uploads",
            metadata: { originalName: file.originalname }
        };
    },
});

const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// User Schema & Model
const userSchema = new mongoose.Schema({
    name: String,
    password: String
});
const User = mongoose.model("User ", userSchema);

// Register Endpoint
app.post("/register", async (req, res) => {
    const { name, password } = req.body;

    try {
        const existingUser  = await User.findOne({ name });
        if (existingUser ) {
            return res.status(400).json({ message: "User  already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser  = new User({ name, password: hashedPassword });
        await newUser .save();

        res.status(201).json({ message: "✅ Registration successful" });
    } catch (error) {
        res.status(500).json({ message: "❌ Server error" });
    }
});

// Login Endpoint
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

// Image Upload Route
app.post("/upload", upload.array("images", 10), async (req, res) => {
    console.log("Received files:", req.files); // Debugging log

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "❌ No files uploaded" });
    }

    const imageIds = req.files.map(file => file.id);
    console.log("Stored Image IDs:", imageIds); // Debugging log

    res.status(201).json({ message: "✅ Images uploaded successfully", imageIds });
});

// Retrieve Image by ID
app.get("/image/:id", async (req, res) => {
    try {
        if (!bucket) return res.status(500).json({ message: "❌ GridFS not initialized yet" });

        const file = await db.collection("uploads.files").findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
        if (!file) return res.status(404).json({ message: "❌ No image found" });

        bucket.openDownloadStream(new mongoose.Types.ObjectId(req.params.id)).pipe(res);
    } catch (error) {
        res.status(500).json({ message: "❌ Error retrieving image" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}/`);
});
