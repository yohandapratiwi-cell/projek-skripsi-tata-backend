const pool = require("../config/db");

// 1. STATISTIK UTAMA DASHBOARD
exports.getDashboardStats = async (req, res) => {
  try {
    const coursesRes = await pool.query("SELECT COUNT(*) FROM courses");
    const studentsRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    const modulesRes = await pool.query("SELECT COUNT(*) FROM modules");
    const courseListRes = await pool.query("SELECT id, title FROM courses ORDER BY created_at DESC");

    res.json({
      status: "success",
      totalCourses: parseInt(coursesRes.rows[0].count),
      totalStudents: parseInt(studentsRes.rows[0].count),
      totalModules: parseInt(modulesRes.rows[0].count),
      courseList: courseListRes.rows
    });
  } catch (error) {
    console.error("STATS ERROR:", error.message);
    res.status(500).json({ error: "Gagal mengambil statistik dashboard" });
  }
};

// 2. GRAFIK PROGRES PER KURSUS
exports.getCourseProgressStats = async (req, res) => {
  const { courseId } = req.params;
  try {
    const query = `
      SELECT 
        m.title as module_name, 
        COUNT(DISTINCT ss.user_id) as completed_count
      FROM modules m
      LEFT JOIN materi mat ON m.id = mat.module_id
      LEFT JOIN student_submissions ss ON mat.id = ss.materi_id
      WHERE m.course_id = $1
      GROUP BY m.id, m.title, m.module_order
      ORDER BY m.module_order ASC;
    `;
    const result = await pool.query(query, [courseId]);
    res.json({ status: "success", data: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data progres kursus" });
  }
};

// 3. MONITORING SISWA (STREAK & MATERI TERAKHIR)
exports.getStudentProgress = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.name, u.email,
        -- Menghitung jumlah tugas yang sudah dikirim
        (SELECT COUNT(*) FROM student_submissions ss WHERE ss.user_id = u.id) as tasks_sent,
        -- Menghitung jumlah tugas yang sudah dinilai
        (SELECT COUNT(*) FROM student_submissions ss WHERE ss.user_id = u.id AND ss.status = 'graded') as tasks_graded,
        -- Mengambil skor rata-rata
        (SELECT AVG(score) FROM student_submissions ss WHERE ss.user_id = u.id AND ss.score IS NOT NULL) as avg_score,
        u.last_activity_date,
        u.current_streak
      FROM users u
      WHERE u.role = 'student' -- Pastikan hanya mengambil user dengan role student
      ORDER BY u.name ASC
    `;
    
    const result = await pool.query(query);
    
    // Pastikan mengirim status success dan data berupa array
    res.json({
      status: "success",
      data: result.rows
    });
  } catch (err) {
    console.error("MONITOR ERROR:", err.message);
    res.status(500).json({ error: err.message });
  } 
};

// 4. DAFTAR SUB-BAB UNTUK PENILAIAN (GRADING HUB)
// backend/controllers/teacherController.js

exports.getGradingModules = async (req, res) => {
  const { courseId } = req.params;
  try {
    const query = `
      SELECT 
        t.id, 
        t.title, 
        t.type,
        m.id as module_id,      -- 👈 Tambahkan ini
        m.title as module_name, -- 👈 Tambahkan ini agar tidak muncul "Lainnya"
        (SELECT COUNT(*) FROM student_submissions ss 
         WHERE ss.materi_id = t.id AND ss.status = 'submitted') as pending_count,
        (SELECT COUNT(*) FROM student_submissions ss 
         WHERE ss.materi_id = t.id AND ss.status = 'graded') as graded_count
      FROM materi t
      JOIN modules m ON t.module_id = m.id
      JOIN assignments a ON a.materi_id = t.id 
      WHERE m.course_id = $1
      ORDER BY m.module_order ASC, t.order_number ASC
    `;

    const result = await pool.query(query, [courseId]);
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Gagal memuat daftar tugas" });
  }
};

// 5. DAFTAR JAWABAN SISWA PER MATERI
// 5. DAFTAR JAWABAN SISWA PER MATERI (DENGAN HITUNGAN TOTAL COMPILE DARI STUDENT_ATTEMPTS)
exports.getSubmissionsByMateri = async (req, res) => {
  const { materiId } = req.params;
  try {
    const query = `
      SELECT 
        ss.id as submission_id, 
        u.name as student_name, 
        ss.content, 
        ss.status, 
        ss.score, 
        ss.feedback,
        a.instruction as task_instruction,
        -- SUBQUERY: Menghitung total baris aktivitas compile siswa dari tabel student_attempts
        (
          SELECT COUNT(*)::int 
          FROM student_attempts 
          WHERE user_id = ss.user_id AND materi_id = ss.materi_id
        ) as compile_count
      FROM student_submissions ss
      JOIN users u ON ss.user_id = u.id
      JOIN assignments a ON ss.materi_id = a.materi_id
      WHERE ss.materi_id = $1
      ORDER BY ss.status DESC, ss.created_at ASC;
    `;
    const result = await pool.query(query, [materiId]);
    res.json({ status: "success", data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. UPDATE NILAI (ACTION)
exports.updateGrade = async (req, res) => {
  const { submissionId } = req.params;
  const { score, feedback } = req.body;
  try {
    const query = `
      UPDATE student_submissions 
      SET score = $1, feedback = $2, status = 'graded', updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await pool.query(query, [score, feedback, submissionId]);
    res.json({ status: "success", message: "Nilai berhasil diperbarui!", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. MANAJEMEN ASSIGNMENT (UPSERT)
exports.upsertAssignment = async (req, res) => {
  const { materi_id, instruction, type, starter_code } = req.body;
  try {
    const check = await pool.query("SELECT id FROM assignments WHERE materi_id = $1", [materi_id]);
    if (check.rows.length > 0) {
      await pool.query(
        "UPDATE assignments SET instruction = $1, type = $2, starter_code = $3 WHERE materi_id = $4",
        [instruction, type, starter_code, materi_id]
      );
    } else {
      await pool.query(
        "INSERT INTO assignments (materi_id, instruction, type, starter_code) VALUES ($1, $2, $3, $4)",
        [materi_id, instruction, type, starter_code]
      );
    }
    res.json({ status: "success", message: "Assignment berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 8. DELETE ASSIGNMENT
exports.deleteAssignment = async (req, res) => {
  try {
    const { materiId } = req.params;
    await pool.query("DELETE FROM assignments WHERE materi_id = $1", [materiId]);
    res.json({ status: "success", message: "Berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 9. REKAP NILAI TEST (PRETEST & POSTTEST)
exports.getTestResults = async (req, res) => {
  const { courseId, testType } = req.params;
  try {
    const query = `
      SELECT 
        ts.id as submission_id,
        u.name as student_name,
        u.email as student_email,
        t.title as test_title,
        ts.score,
        ts.status,
        TO_CHAR(ts.created_at, 'DD Mon YYYY, HH24:MI') as submitted_at
      FROM test_submissions ts
      JOIN users u ON ts.user_id = u.id
      JOIN tests t ON ts.test_id = t.id
      WHERE ts.course_id = $1 
        AND ts.test_type = $2
      ORDER BY ts.created_at DESC;
    `;
    const result = await pool.query(query, [courseId, testType]);
    res.json({ status: "success", data: result.rows });
  } catch (error) {
    res.status(500).json({ error: `Gagal mengambil data nilai ${testType}` });
  }
};

// 10. ANALYTICS SISWA PER MATERI (PROGRESS & KOMPETENSI)
exports.getStudentAnalytics = async (req, res) => {
  const { studentId } = req.params;

  try {
      const query = `
          SELECT 
              m.id as materi_id,
              m.title as materi_title,
              mod.title as module_title,
              m.learning_objectives as total_objectives,
              COALESCE((ss.content::jsonb)->'achieved_objectives', '[]'::jsonb) as achieved_objectives,
              ss.status as submission_status,
              ss.updated_at as completed_at
          FROM materi m
          JOIN modules mod ON m.module_id = mod.id
          LEFT JOIN student_submissions ss ON m.id = ss.materi_id AND ss.user_id = $1
          ORDER BY mod.module_order ASC, m.order_number ASC;
      `;

      const result = await pool.query(query, [studentId]);

      let totalIndicators = 0;
      let totalAchieved = 0;

      const analyticsData = result.rows.map(row => {
          const totalArr = Array.isArray(row.total_objectives) ? row.total_objectives : [];
          const achievedArr = Array.isArray(row.achieved_objectives) ? row.achieved_objectives : [];
          
          if (totalArr.length > 0) {
              totalIndicators += totalArr.length;
              totalAchieved += achievedArr.length;
          }

          return {
              materi_id: row.materi_id,
              materi_title: row.materi_title,
              module_title: row.module_title,
              status: row.submission_status || 'not_started',
              progress: {
                  total: totalArr.length,
                  achieved: achievedArr.length,
                  percent: totalArr.length > 0 ? Math.round((achievedArr.length / totalArr.length) * 100) : 100
              },
              details: {
                  all_indicators: totalArr,
                  achieved_indicators: achievedArr
              },
              completed_at: row.completed_at
          };
      });

      res.json({
          status: "success",
          summary: {
              total_materi: analyticsData.length,
              materi_finished: analyticsData.filter(d => d.status === 'submitted' || d.status === 'graded').length,
              overall_competency_percent: totalIndicators > 0 ? Math.round((totalAchieved / totalIndicators) * 100) : 100
          },
          data: analyticsData
      });

  } catch (err) {
      console.error("ANALYTICS ERROR:", err.message);
      res.status(500).json({ error: "Gagal memuat analitik siswa" });
  }
};

// 11. ANALYTICS KOMPETENSI KELAS PER MATERI (RATA-RATA PENCAPAIAN INDIKATOR)
exports.getClassCompetencyStats = async (req, res) => {
  try {
    const query = `
      WITH indicators AS (
        SELECT 
          m.id as materi_id,
          m.title as materi_title,
          jsonb_array_elements_text(m.learning_objectives::jsonb) as indicator_name
        FROM materi m
        WHERE m.learning_objectives IS NOT NULL AND jsonb_array_length(m.learning_objectives::jsonb) > 0
      ),
      achievements AS (
        SELECT 
          materi_id,
          jsonb_array_elements_text(
            CASE 
              WHEN jsonb_typeof(content::jsonb -> 'achieved_objectives') = 'array' 
              THEN (content::jsonb -> 'achieved_objectives') 
              ELSE '[]'::jsonb 
            END
          ) as achieved_name
        FROM student_submissions
        WHERE content IS NOT NULL
      ),
      indicator_stats AS (
        SELECT 
          i.materi_id,
          i.materi_title,
          i.indicator_name,
          (COUNT(a.achieved_name)::float / NULLIF((SELECT COUNT(*)::int FROM users WHERE role = 'student'), 0) * 100) as indicator_percentage
        FROM indicators i
        LEFT JOIN achievements a ON i.materi_id = a.materi_id AND i.indicator_name = a.achieved_name
        GROUP BY i.materi_id, i.materi_title, i.indicator_name
      )
      SELECT 
        materi_title,
        ROUND(AVG(indicator_percentage))::int as percentage,
        jsonb_agg(jsonb_build_object(
          'name', indicator_name,
          'val', ROUND(indicator_percentage)::int
        )) as indicators
      FROM indicator_stats
      GROUP BY materi_id, materi_title
      ORDER BY materi_id;
    `;

    const result = await pool.query(query);
    
    return res.status(200).json({
      status: "success",
      data: result.rows || []
    });

  } catch (err) {
    console.error("CRITICAL ERROR CLASS STATS:", err.message);
    return res.status(500).json({ 
      status: "error",
      message: err.message 
    });
  }
};