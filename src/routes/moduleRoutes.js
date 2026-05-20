const express = require("express");
const router = express.Router();

const {
  getModules,
  getModuleDetail,
  createModule,
  updateModule,
  deleteModule,
  getModulesByCourse
} = require("../controllers/moduleController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

// --- RUTE PUBLIK ---

// 1. Ambil semua (Tanpa parameter)
router.get("/", getModules);

// 2. Ambil berdasarkan Course (Spesifik: Harus di atas rute /:id)
router.get("/course/:courseId", getModulesByCourse);

// 3. Ambil detail satu modul (Dinamis: Harus di bawah rute spesifik)
router.get("/:id", getModuleDetail);


// --- RUTE KHUSUS GURU (Tetap Sama) ---
router.post("/", authenticateToken, authorizeRole(["teacher"]), createModule);
router.put("/:id", authenticateToken, authorizeRole(["teacher"]), updateModule);
router.delete("/:id", authenticateToken, authorizeRole(["teacher"]), deleteModule);

module.exports = router;