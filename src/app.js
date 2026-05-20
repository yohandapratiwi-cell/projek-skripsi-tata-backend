require("dotenv").config()
const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const path = require("path"); 

const authRoutes = require("./routes/authRoutes")
const courseRoutes = require("./routes/courseRoutes") // Ini yang berisi getFullCourses
const moduleRoutes = require("./routes/moduleRoutes")
const teacherRoutes = require("./routes/teacherRoutes")
const testRoutes = require("./routes/testRoutes");
const studentRoutes = require("./routes/studentRoutes");

const app = express()

app.set("trust proxy", 1);

app.use(
  cors({
    origin: "https://projek-skripsi-tata.vercel.app",
    credentials: true, 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
  })
);

app.use(express.json())
app.use(cookieParser())

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (req,res)=>{
  res.send("Backend Semantic Wave Running")
})

// --- PERBAIKAN RUTE API ---

app.use("/api/auth", authRoutes)

// ✅ SOLUSI: Arahkan /api/teacher/courses LANGSUNG ke courseRoutes
// Dengan begini, saat Frontend panggil /api/teacher/courses, 
// dia akan menjalankan getFullCourses yang ada di courseController.
app.use("/api/teacher/courses", courseRoutes) 

// Rute lainnya tetap
app.use("/api/courses", courseRoutes) 
app.use("/api/modules", moduleRoutes)
app.use("/api/teacher", teacherRoutes)
app.use("/api/tests", testRoutes);
app.use("/api/student", studentRoutes);

module.exports = app