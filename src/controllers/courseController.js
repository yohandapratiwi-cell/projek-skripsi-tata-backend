const pool = require("../config/db");

// 1. Ambil semua data course (Daftar Ringkas)
exports.getCourses = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM courses ORDER BY id DESC");
    // ✅ Bungkus dalam objek data agar konsisten dengan Frontend
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Ambil detail satu course saja
exports.getCourseDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM courses WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Course tidak ditemukan" });
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Ambil Course lengkap dengan Modul & Materi (JOIN SESUAI ERD)
exports.getFullCourses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        courses.id AS c_id, courses.title AS c_title, courses.instructor AS c_ins, 
        courses.thumbnail AS c_thumb, courses.description AS c_desc,
        modules.id AS m_id, modules.title AS m_title, modules.module_order AS m_order,
        materi.id AS mat_id, materi.title AS mat_title, materi.content AS mat_cont, 
        materi.video_url AS mat_vid, materi.type AS mat_type, 
        materi.has_reflection AS mat_ref, materi.reflection_question AS mat_ref_q,
        materi.learning_objectives AS mat_obj,
        assignments.id AS as_id, assignments.instruction AS as_inst, 
        assignments.type AS as_type, assignments.starter_code AS as_start
      FROM courses
      LEFT JOIN modules ON modules.course_id = courses.id
      LEFT JOIN materi ON materi.module_id = modules.id
      LEFT JOIN assignments ON assignments.materi_id = materi.id
      ORDER BY courses.id DESC, modules.module_order ASC, materi.order_number ASC
    `);

    const coursesMap = {};

    result.rows.forEach(row => {
      if (!coursesMap[row.c_id]) {
        coursesMap[row.c_id] = {
          id: row.c_id,
          title: row.c_title,
          instructor: row.c_ins,
          thumbnail: row.c_thumb,
          description: row.c_desc || "",
          modules: []
        };
      }
      
      const course = coursesMap[row.c_id];

      if (row.m_id) {
        let module = course.modules.find(m => m.id === row.m_id);
        if (!module) {
          module = { 
            id: row.m_id, 
            title: row.m_title, 
            module_order: row.m_order, 
            materi: [] 
          };
          course.modules.push(module);
        }

        if (row.mat_id) {
          let materiExists = module.materi.find(mat => mat.id === row.mat_id);
          if (!materiExists) {
            // 👈 2. PROSES DATA OBJECTIVES AGAR MENJADI ARRAY JSON
            let objectives = [];
            try {
               // Jika datanya string (format Postgre native), kita parse atau kirim apa adanya
               // Tapi karena kolomnya JSONB, biasanya library sudah otomatis jadi array/object.
               objectives = row.mat_obj || []; 
            } catch (e) {
               objectives = [];
            }

            module.materi.push({ 
              id: row.mat_id, 
              title: row.mat_title, 
              content: row.mat_cont, 
              video_url: row.mat_vid,
              type: row.mat_type,
              has_reflection: row.mat_ref,
              reflection_question: row.mat_ref_q,
              learning_objectives: objectives,
              assignment: row.as_id ? { 
                id: row.as_id, 
                type: row.as_type,
                instruction: row.as_inst,
                starter_code: row.as_start || "" 
              } : null
            });
          }
        }
      }
    });

    res.status(200).json({
      status: "success",
      data: Object.values(coursesMap)
    });

  } catch (err) {
    console.error("DEBUG ERROR:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
};


// 4. Buat Course Baru
exports.createCourse = async (req, res) => {
  try {
    const { title, instructor, thumbnail, description } = req.body;
    const result = await pool.query(
      "INSERT INTO courses (title, instructor, thumbnail, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, instructor, thumbnail, description || ""]
    );
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Update Course
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, instructor, thumbnail, description } = req.body;
    const result = await pool.query(
      "UPDATE courses SET title = $1, instructor = $2, thumbnail = $3, description = $4 WHERE id = $5 RETURNING *",
      [title, instructor, thumbnail, description, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Gagal update" });
    res.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. Delete Course
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    // Cascade Delete Manual sesuai ERD
    await pool.query("DELETE FROM assignments WHERE materi_id IN (SELECT id FROM materi WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1))", [id]);
    await pool.query("DELETE FROM materi WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1)", [id]);
    await pool.query("DELETE FROM modules WHERE course_id = $1", [id]);
    await pool.query("DELETE FROM courses WHERE id = $1", [id]);
    res.json({ status: "success", message: "Course deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 7. Ambil course yang tersedia untuk test
exports.getAvailableCourses = async (req, res) => {
  try {
    const { type } = req.query; 
    const result = await pool.query(
      `SELECT c.id, c.title FROM courses c
       WHERE c.id NOT IN (
         SELECT course_id FROM tests WHERE type = $1
       )
       ORDER BY c.id DESC`, 
      [type || 'pretest']
    );
    res.json({ status: "success", data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};