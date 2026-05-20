const mammoth = require("mammoth");

exports.parseDocx = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    // Membersihkan karakter Tab (\t) dan spasi ganda agar teks jadi rata kiri semua
    const cleanText = result.value.replace(/\t/g, " ").replace(/ +/g, " ");

    // 1. STRATEGI SPLIT PALING AMAN
    // Kita pecah hanya jika ada: Enter + Angka + Titik + Spasi + Huruf KAPITAL
    // Ini akan mengabaikan "1) Menulis" karena memakai kurung, 
    // dan mengabaikan "1. Menulis" karena "M" di "Menulis" bukan awal kalimat soal yang sah menurut regex ini.
    const rawQuestions = cleanText
    .split(/\r?\n(?=\d+\.\s+[A-Z])/)
    .filter(Boolean);

  return rawQuestions.map((q) => {
    // Pecah baris dan hilangkan baris kosong
    const lines = q.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
    
    let questionLines = [];
    let options = [];
    let answer = null;
    let optionMap = new Set();

    lines.forEach((line, index) => {
      // 2. DETEKSI OPSI (Wajib diawali Huruf + Titik/Kurung + Spasi)
      const optionMatch = line.match(/^([A-Ea-e])[\.)]\s+(.*)/);
      
      // 3. DETEKSI KUNCI JAWABAN
      const isAnswer = line.toUpperCase().startsWith("ANS:");

      if (optionMatch) {
        const label = optionMatch[1].toUpperCase();
        if (!optionMap.has(label)) {
          options.push({
            label: label,
            text: optionMatch[2].trim(),
          });
          optionMap.add(label);
        }
      } else if (isAnswer) {
        const splitPart = line.split(":");
        answer = splitPart[1] ? splitPart[1].trim().toUpperCase() : null;
      } else {
        // 4. BAGIAN TEKS SOAL (Termasuk daftar 1), 2), dst)
        if (index === 0) {
          // Hapus nomor soal (11.) di baris pertama
          questionLines.push(line.replace(/^\d+[\.)]\s*/, ""));
        } else {
          // Masukkan baris lainnya apa adanya ke dalam soal
          questionLines.push(line);
        }
      }
    });

    const questionText = questionLines.join("\n").trim();

    return {
      questionText,
      options,
      answer,
    };
  });
  } catch (error) {
    console.error("ERROR PARSER:", error);
    throw new Error("Gagal membaca file DOCX.");
  }
};