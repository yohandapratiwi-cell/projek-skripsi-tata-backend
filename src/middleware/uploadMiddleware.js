const multer = require("multer");
const path = require("path");
const os = require("os"); // ✅ 1. Import modul bawaan Node.js untuk mendeteksi folder Temp

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir()); // 🔥 2. Ganti "uploads/" menjadi os.tmpdir()
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

module.exports = upload;