const express = require("express");
const router = express.Router();
const { 
    getAvailableCourses, 
    getFullCourses, 
    getCourses, 
    getCourseDetail 
} = require("../controllers/courseController");

// --- 1. RUTE STATIS (Wajib di Atas) ---

// Rute untuk mengambil semua data lengkap (Courses + Modules + Materi)
// Ini rute yang dipanggil oleh CourseRedirect di Frontend
router.get("/courses-full", getFullCourses); 

// Rute cadangan/alternatif
router.get("/all/full", getFullCourses);
router.get("/", getFullCourses); 

// Rute untuk dropdown pilihan course di pembuatan test
router.get("/available", getAvailableCourses);
router.get("/available-for-test", getAvailableCourses);

// Rute untuk daftar course ringkas
router.get("/list/summary", getCourses);


// --- 2. RUTE DINAMIS (Wajib di Paling Bawah) ---

// Mengambil detail 1 course berdasarkan ID
// Dengan menaruh ini di bawah, Express tidak akan mengira "courses-full" adalah sebuah ID (Integer)
router.get("/:id", getCourseDetail);

module.exports = router;