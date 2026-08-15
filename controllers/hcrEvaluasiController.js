const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer buat upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/evaluasi-ppk'));
  },
  filename: (req, file, cb) => {
    const namaUnik = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, namaUnik);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // maksimal 5MB
  fileFilter: (req, file, cb) => {
    const tipeDiizinkan = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (tipeDiizinkan.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.'));
    }
  }
});

exports.uploadMiddleware = upload.single('file_bukti');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [dataEvaluasi] = await db.query(
    `SELECT hcr_evaluasi_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_evaluasi_ppk
     JOIN pegawai ON pegawai.id = hcr_evaluasi_ppk.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const rataSkor = dataEvaluasi.length > 0
    ? dataEvaluasi.reduce((a, b) => a + parseFloat(b.skor_evaluasi), 0) / dataEvaluasi.length
    : 0;

  res.render('hcr/evaluasi/index', {
    dataEvaluasi,
    rataSkor: rataSkor.toFixed(1),
    bulan,
    tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/evaluasi/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_program, tanggal_evaluasi, skor_evaluasi, catatan } = req.body;
  const namaFile = req.file ? req.file.filename : null;

  try {
    await db.query(
      `INSERT INTO hcr_evaluasi_ppk 
        (pegawai_id, periode_bulan, periode_tahun, nama_program, tanggal_evaluasi, skor_evaluasi, file_bukti, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nama_program = VALUES(nama_program),
        tanggal_evaluasi = VALUES(tanggal_evaluasi),
        skor_evaluasi = VALUES(skor_evaluasi),
        file_bukti = COALESCE(VALUES(file_bukti), file_bukti),
        catatan = VALUES(catatan),
        input_by = VALUES(input_by)`,
      [pegawai_id, bulan, tahun, nama_program, tanggal_evaluasi || null, skor_evaluasi, namaFile, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data evaluasi PPK berhasil disimpan');
    res.redirect(req.body.kembali || `/hcr-evaluasi?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH EVALUASI:', err);
    req.flash('error', 'Gagal menyimpan data: ' + err.message);
    res.redirect('/hcr-evaluasi/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_evaluasi_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_evaluasi_ppk
     JOIN pegawai ON pegawai.id = hcr_evaluasi_ppk.pegawai_id
     WHERE hcr_evaluasi_ppk.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-evaluasi');
  }
  res.render('hcr/evaluasi/edit', { data: rows[0] });
};

exports.edit = async (req, res) => {
  const { nama_program, tanggal_evaluasi, skor_evaluasi, catatan } = req.body;
  const namaFileBaru = req.file ? req.file.filename : null;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_evaluasi_ppk WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-evaluasi');
    }

    // Kalau upload file baru, hapus file lama biar gak numpuk sampah
    if (namaFileBaru && existing[0].file_bukti) {
      const pathFileLama = path.join(__dirname, '../public/uploads/evaluasi-ppk', existing[0].file_bukti);
      fs.unlink(pathFileLama, () => {}); // diamkan kalau gagal hapus (misal file udah gak ada)
    }

    await db.query(
      `UPDATE hcr_evaluasi_ppk 
       SET nama_program=?, tanggal_evaluasi=?, skor_evaluasi=?, file_bukti=COALESCE(?, file_bukti), catatan=? 
       WHERE id=?`,
      [nama_program, tanggal_evaluasi || null, skor_evaluasi, namaFileBaru, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data berhasil diperbarui');
    res.redirect(`/hcr-evaluasi?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT EVALUASI:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-evaluasi/edit/' + req.params.id);
  }
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_evaluasi_ppk WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    if (existing[0].file_bukti) {
      const pathFile = path.join(__dirname, '../public/uploads/evaluasi-ppk', existing[0].file_bukti);
      fs.unlink(pathFile, () => {});
    }
    await db.query('DELETE FROM hcr_evaluasi_ppk WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data berhasil dihapus');
  res.redirect(req.body.kembali || '/hcr-evaluasi');
};

// Sinkron ke hcr_realisasi: skornya = rata-rata skor_evaluasi semua program di periode itu
async function sinkronSkorHcr(bulan, tahun) {
  const [rows] = await db.query(
    `SELECT AVG(skor_evaluasi) AS rata FROM hcr_evaluasi_ppk 
     WHERE periode_bulan = ? AND periode_tahun = ?`,
    [bulan, tahun]
  );
  const rataSkor = rows[0].rata ? parseFloat(rows[0].rata) : 0;

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'MLI_EVALUASI_PPK'`);
  if (itemRows.length === 0) return;
  const itemId = itemRows[0].id;

  const [semuaPegawai] = await db.query('SELECT id FROM pegawai');
  for (const p of semuaPegawai) {
    await db.query(
      `INSERT INTO hcr_realisasi (pegawai_id, hcr_item_id, periode_bulan, periode_tahun, target, capaian, skor)
       VALUES (?, ?, ?, ?, 100, ?, ?)
       ON DUPLICATE KEY UPDATE capaian = VALUES(capaian), skor = VALUES(skor)`,
      [p.id, itemId, bulan, tahun, rataSkor.toFixed(2), rataSkor.toFixed(2)]
    );
  }
}