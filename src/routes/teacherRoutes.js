const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

// Import Controllers
const { 
  getDashboardStats,
  getClassCompetencyStats,
  getCourseProgressStats, 
  getStudentProgress,
  getStudentAnalytics,
  getGradingModules, 
  getSubmissionsByMateri, 
  updateGrade, 
  upsertAssignment, 
  deleteAssignment, 
  getTestResults ,
} = require("../controllers/teacherController");

const { createCourse, getCourses, updateCourse, deleteCourse } = require("../controllers/courseController");
const { createModule, getModulesByCourse, updateModule, deleteModule } = require("../controllers/moduleController");
const { createMateri, getMateriByModule, updateMateri, deleteMateri } = require("../controllers/materiController");

// Proteksi rute (Wajib Login & Role Guru)
router.use(authenticateToken);
router.use(authorizeRole(["teacher"]));

// --- 1. COURSE MANAGEMENT ---
// Dipanggil di Frontend: /api/teacher/courses
router.get("/courses", getCourses);
router.post("/courses", createCourse);
router.put("/courses/:id", updateCourse);
router.delete("/courses/:id", deleteCourse);

// --- 2. MODULE MANAGEMENT ---
router.get("/modules/:courseId", getModulesByCourse);
router.post("/modules", createModule);
router.put("/modules/:id", updateModule);
router.delete("/modules/:id", deleteModule);

// --- 3. MATERI MANAGEMENT ---
router.get("/materi/:moduleId", getMateriByModule);
router.post("/materi", createMateri);
router.put("/materi/:id", updateMateri);
router.delete("/materi/:id", deleteMateri);

// --- 4. ASSIGNMENTS (Praktek) --
router.post("/assignments/upsert", upsertAssignment);
router.delete("/assignments/:materiId", deleteAssignment);

// --- 5. DASHBOARD STATS --
router.get("/dashboard-stats", getDashboardStats);
router.get("/course-progress/:courseId", getCourseProgressStats);
router.get("/students-monitor", getStudentProgress);
router.get("/analytics/:studentId", getStudentAnalytics);
router.get("/class-competency", getClassCompetencyStats);


// --- 6. GRADING SYSTEM (Tugas Coding/Flowchart) ---
// Rute ini untuk list Sub-Bab yang ada tugasnya
router.get("/grading/course/:courseId", getGradingModules); 
// Rute ini untuk list siswa yang mengumpulkan di materi tsb
router.get("/grading/materi/:materiId", getSubmissionsByMateri);
// Rute untuk input nilai
router.put("/grading/submit/:submissionId", updateGrade);

// --- 7. TEST RESULTS (Pretest & Posttest) ---
router.get("/results/:testType/:courseId", getTestResults);

module.exports = router;