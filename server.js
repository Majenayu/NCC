const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // Changed bcrypt to bcryptjs for compatibility
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for Render deployment
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key"; // Use env variable

let NCC1;
if (fs.existsSync("./NCC1.js")) {
    NCC1 = require("./NCC1"); // Ensure NCC1.js exists before requiring it
    app.use("/", NCC1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://NCC:NCC@majen.ivckg.mongodb.net/?retryWrites=true&w=majority&appName=Majen", {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
    name: String,
    password: String
});
const User = mongoose.model("User", userSchema);

// Register Endpoint
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

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}/`);
});
