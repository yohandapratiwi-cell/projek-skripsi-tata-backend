const pool = require("../config/db");
const { parseDocx } = require("../services/parserService");

// 1. Upload Gambar
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Tidak ada file gambar" });
    
    // ✅ Gunakan URL dinamis (mendukung Railway/Localhost)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    res.json({ url: imageUrl });
  } catch (err) {
    res.status(500).json({ error: "Gagal memproses gambar: " + err.message });
  }
};

// 2. Simpan Test Baru (Transaksi Database)
exports.createTest = async (req, res) => {
  const client = await pool.connect(); 
  try {
    const { course_id, type, title, duration, questions } = req.body;
    if (!questions || !Array.isArray(questions)) throw new Error("Data soal kosong");

    await client.query("BEGIN");

    // Simpan Test Utama
    const testRes = await client.query(
      `INSERT INTO tests (course_id, type, title, duration) VALUES ($1, $2, $3, $4) RETURNING id`,
      [course_id, type, title, duration]
    );
    const testId = testRes.rows[0].id;

    for (const q of questions) {
      // Simpan Pertanyaan
      const qRes = await client.query(
        `INSERT INTO questions (test_id, question_text, question_image) VALUES ($1, $2, $3) RETURNING id`,
        [testId, q.questionText, q.question_image || null] 
      );
      const questionId = qRes.rows[0].id;

      if (q.options && Array.isArray(q.options)) {
        for (const opt of q.options) {
          // Simpan Opsi
          await client.query(
            `INSERT INTO options (question_id, option_label, option_text, option_image, is_correct) VALUES ($1, $2, $3, $4, $5)`,
            [questionId, opt.label, opt.text, opt.option_image || null, opt.label === q.answer]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.json({ status: "success", testId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// 3. Upload & Parse DOCX
exports.uploadAndParse = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Tidak ada file diupload" });
    
    // Memanggil parser service Bapak
    const questions = await parseDocx(req.file.path);
    
    // ✅ Kirim response dengan format yang jelas
    return res.status(200).json({ 
      status: "success", 
      data: { questions: questions } 
    });
  } catch (err) {
    console.error("Parser Error:", err.message);
    res.status(500).json({ error: "Gagal parsing file: " + err.message });
  }
};

// 4. Cek Status Akses (Gatekeeper)
exports.checkTestStatus = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id; 

  try {
    const tests = await pool.query(
      "SELECT id, type FROM tests WHERE course_id = $1", 
      [courseId]
    );

    const submissions = await pool.query(
      "SELECT test_id FROM test_submissions WHERE user_id = $1 AND course_id = $2",
      [userId, courseId]
    );

    const hasPretest = tests.rows.find(t => t.type === 'pretest');
    const hasPosttest = tests.rows.find(t => t.type === 'posttest');
    
    const pretestDone = submissions.rows.some(s => s.test_id === hasPretest?.id);
    const posttestDone = submissions.rows.some(s => s.test_id === hasPosttest?.id);

    res.json({
      hasPretest: !!hasPretest,
      pretestId: hasPretest?.id || null,
      pretestDone,
      hasPosttest: !!hasPosttest,
      posttestId: hasPosttest?.id || null,
      posttestDone
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal cek status: " + err.message });
  }
};

// 5. Simpan Hasil Pengerjaan (Transaksi: Submission + Detail Jawaban)
exports.submitTest = async (req, res) => {
  const { test_id, course_id, test_type, answers } = req.body;
  const user_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // A. Ambil Kunci Jawaban untuk validasi skor
    const keysRes = await client.query(
      `SELECT q.id as question_id, o.option_label 
       FROM questions q
       JOIN options o ON q.id = o.question_id
       WHERE q.test_id = $1 AND o.is_correct = true`,
      [test_id]
    );
    const correctKeys = keysRes.rows;
    const totalQuestions = correctKeys.length;

    if (totalQuestions === 0) throw new Error("Soal tidak ditemukan.");

    // B. Hitung Skor & Siapkan Array untuk Detail Jawaban
    let correctCount = 0;
    const detailAnswers = [];

    correctKeys.forEach(key => {
      const chosen = answers[key.question_id]; // Label pilihan siswa (A, B, C, D)
      const isCorrect = chosen === key.option_label;
      if (isCorrect) correctCount++;
      
      detailAnswers.push({
        question_id: key.question_id,
        chosen: chosen || null,
        isCorrect: isCorrect
      });
    });

    const finalScore = Math.round((correctCount / totalQuestions) * 100);

    // C. Masukkan ke test_submissions (Gunakan ON CONFLICT agar tidak double data)
    const subRes = await client.query(
      `INSERT INTO test_submissions (user_id, test_id, course_id, test_type, score, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')
       ON CONFLICT (user_id, test_id) 
       DO UPDATE SET score = EXCLUDED.score, created_at = NOW(), status = 'completed'
       RETURNING id`,
      [user_id, test_id, course_id, test_type, finalScore]
    );
    const submissionId = subRes.rows[0].id;

    // D. Hapus detail lama jika ada (agar tidak bentrok saat update)
    await client.query(`DELETE FROM test_submission_answers WHERE submission_id = $1`, [submissionId]);

    // E. Masukkan Detail Jawaban Siswa ke tabel baru
    for (const ans of detailAnswers) {
      await client.query(
        `INSERT INTO test_submission_answers (submission_id, question_id, chosen_option_label, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [submissionId, ans.question_id, ans.chosen, ans.isCorrect]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Test berhasil dinilai dan dicatat!", score: finalScore });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SUBMIT ERROR:", err.message);
    res.status(500).json({ error: "Gagal memproses pengerjaan: " + err.message });
  } finally {
    client.release();
  }
};

// 6. Ambil Soal (Siswa)
// 6. Ambil Soal-soal Test (Pastikan ini bisa diakses Siswa)
exports.getTestData = async (req, res) => {
  const { testId } = req.params;
  try {
      const questions = await pool.query(`
          SELECT q.id, q.question_text, q.question_image,
          json_agg(json_build_object(
              'option_label', o.option_label, 
              'option_text', o.option_text,   
              'option_image', o.option_image
          ) ORDER BY o.option_label) AS options
          FROM questions q
          LEFT JOIN options o ON q.id = o.question_id -- Gunakan LEFT JOIN agar soal tanpa opsi tidak bikin error
          WHERE q.test_id = $1
          GROUP BY q.id
      `, [testId]);

      if (questions.rows.length === 0) {
        return res.status(404).json({ error: "Soal tidak ditemukan untuk ID ini" });
      }

      res.json(questions.rows);
  } catch (err) {
      console.error("GET TEST DATA ERROR:", err.message);
      res.status(500).json({ error: "Gagal mengambil soal: " + err.message });
  }
};

// 7. Review Jawaban (Menampilkan Benar/Salah per Nomor)
exports.getTestReview = async (req, res) => {
  const { testId } = req.params;
  const userId = req.user.id;

  try {
    const query = `
      SELECT 
        q.id as question_id,
        q.question_text,
        q.question_image,
        tsa.chosen_option_label as student_choice,
        tsa.is_correct as is_student_correct,
        (SELECT json_agg(json_build_object(
          'option_label', o.option_label,
          'option_text', o.option_text,
          'is_correct', o.is_correct
        ) ORDER BY o.option_label) FROM options o WHERE o.question_id = q.id) as options
      FROM questions q
      JOIN test_submission_answers tsa ON q.id = tsa.question_id
      JOIN test_submissions ts ON tsa.submission_id = ts.id
      WHERE ts.test_id = $1 AND ts.user_id = $2
      ORDER BY q.id ASC;
    `;

    const result = await pool.query(query, [testId, userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Gagal memuat review" });
  }
};

// Ambil Rekap Nilai Siswa per Course & Tipe Test
exports.getTestResultsByCourse = async (req, res) => {
  const { testType, courseId } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        ts.id AS submission_id,
        u.nama AS student_name,
        u.email AS student_email,
        t.title AS test_title,
        ts.score,
        TO_CHAR(ts.created_at, 'DD Mon YYYY, HH24:MI') AS submitted_at
      FROM test_submissions ts
      JOIN users u ON ts.user_id = u.id
      JOIN tests t ON ts.test_id = t.id
      WHERE ts.course_id = $1 AND ts.test_type = $2
      ORDER BY ts.created_at DESC
    `, [courseId, testType]);

    res.json({
      status: "success",
      data: result.rows
    });
  } catch (err) {
    console.error("Error Get Results:", err.message);
    res.status(500).json({ error: "Gagal memuat rekap nilai" });
  }
};

exports.getDetailedResults = async (req, res) => {
  try {
      const { testType, courseId } = req.params;

      // Query untuk mengambil nilai siswa berdasarkan tipe test dan course
      const query = `
          SELECT 
              ts.id AS submission_id,
              u.name AS student_name,
              u.email AS student_email,
              t.title AS test_title,
              ts.score,
              TO_CHAR(ts.created_at, 'DD Mon YYYY, HH24:MI') AS submitted_at
          FROM test_submissions ts
          JOIN users u ON ts.user_id = u.id
          JOIN tests t ON ts.test_id = t.id
          WHERE t.type = $1 AND t.course_id = $2
          ORDER BY ts.created_at DESC
      `;

      const result = await pool.query(query, [testType, courseId]);

      res.json({
          status: "success",
          data: result.rows
      });
  } catch (err) {
      console.error("GET RESULTS ERROR:", err.message);
      res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
};