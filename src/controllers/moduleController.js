const pool = require("../config/db");

// 1. Ambil semua modul (Urut berdasarkan module_order)
exports.getModules = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM modules 
      ORDER BY module_order ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Ambil detail satu modul beserta materinya
exports.getModuleDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const moduleResult = await pool.query("SELECT * FROM modules WHERE id = $1", [id]);

    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ message: "Module tidak ditemukan" });
    }

    const materiResult = await pool.query(
      "SELECT * FROM materi WHERE module_id = $1 ORDER BY order_number ASC",
      [id]
    );

    res.json({
      module: moduleResult.rows[0],
      materi: materiResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Tambah Modul Baru
exports.createModule = async (req, res) => {
  try {
    const { course_id, title, module_order } = req.body;
    const result = await pool.query(
      `INSERT INTO modules (course_id, title, module_order) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [course_id, title, module_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Update Modul (Fitur Edit)
exports.updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, module_order } = req.body;

    const result = await pool.query(
      `UPDATE modules 
       SET title = $1, module_order = $2 
       WHERE id = $3 
       RETURNING *`,
      [title, Number(module_order), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Gagal update, modul tidak ditemukan" });
    }

    res.json({ message: "Module berhasil diperbarui", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Hapus Modul (Urutan: Materi dulu baru Modul)
exports.deleteModule = async (req, res) => {
  try {
    const { id } = req.params;

    // Hapus materi di dalam modul ini dulu agar tidak error constraint
    await pool.query("DELETE FROM materi WHERE module_id = $1", [id]);
    
    // Hapus modulnya
    const result = await pool.query("DELETE FROM modules WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Modul sudah tidak ada" });
    }

    res.json({ message: "Modul dan isinya berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. Ambil Modul berdasarkan ID Course (Untuk Filter)
exports.getModulesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const result = await pool.query(
      "SELECT * FROM modules WHERE course_id = $1 ORDER BY module_order ASC",
      [courseId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};