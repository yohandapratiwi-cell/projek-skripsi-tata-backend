const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");

// Import secara eksplisit untuk menghindari error 'must be a function'
const {
    runAndLogCode,
    submitAssignment,
    getSubmission,
    logMateriActivity,
    getStudyDuration,
    getActivityCalendar,
    getLearningStreak,
    getOverallProgress,
    getChallenges,
    getStudentStats
} = require("../controllers/studentController");

// Import testController secara terpisah
const {
    checkTestStatus,
    getTestData,
    submitTest,
    getTestReview
} = require("../controllers/testController");

// SEMUA RUTE DI BAWAH INI WAJIB LOGIN
router.use(authenticateToken);

// --- 1. MATERI & TUGAS ---
router.post("/run-code", runAndLogCode);
router.post("/submit-assignment", submitAssignment);
router.get("/submission/:materi_id", getSubmission);

// --- 2. PRE-TEST & POST-TEST ---
router.get("/course-access/:courseId", checkTestStatus);
router.get("/test-data/:testId", getTestData);
router.post("/submit-test", submitTest);
router.get("/test-review/:testId", getTestReview);

// --- 3. AKTIVITAS & KALENDER ---
router.post("/log-activity", logMateriActivity);
router.get("/study-duration", getStudyDuration);
router.get("/activity-calendar", getActivityCalendar);

// --- 4. DASHBOARD & PROGRESS ---
router.get("/learning-streak", getLearningStreak);
router.get("/overall-progress", getOverallProgress);
router.get("/challenges", getChallenges);
router.get("/stats-summary", getStudentStats);

module.exports = router;