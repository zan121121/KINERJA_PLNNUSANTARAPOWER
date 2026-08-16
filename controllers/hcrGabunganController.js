const db = require('../config/db');
const multer = require('multer');
const path = require('path');

const uploadEvaluasi = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/evaluasi-ppk')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});
exports.uploadEvaluasiMiddleware = uploadEvaluasi.single('file_bukti');

// Halaman cari & pilih pegawai
exports.pilihPegawai = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT * FROM pegawai ORDER BY nama ASC');

  const [bobotRows] = await db.query('SELECT hcr_item_id, bobot_persen FROM hcr_bobot');
  const bobotMap = {};
  bobotRows.forEach(b => { bobotMap[b.hcr_item_id] = parseFloat(b.bobot_persen); });

  const [levelRows] = await db.query('SELECT * FROM hcr_level_config ORDER BY urutan ASC');
  function cariLevel(skor) {
    const match = levelRows.find(l => skor >= parseFloat(l.min_skor) && skor <= parseFloat(l.max_skor));
    return match ? match.level_label : '-';
  }

  const [realisasi] = await db.query(
    'SELECT pegawai_id, hcr_item_id, skor FROM hcr_realisasi WHERE periode_bulan = ? AND periode_tahun = ?',
    [bulan, tahun]
  );
  const skorMap = {};
  realisasi.forEach(r => {
    if (!skorMap[r.pegawai_id]) skorMap[r.pegawai_id] = {};
    skorMap[r.pegawai_id][r.hcr_item_id] = parseFloat(r.skor);
  });

  const totalItem = Object.keys(bobotMap).length;
  const pegawaiDenganStatus = pegawai.map(p => {
    const skorItem = skorMap[p.id] || {};
    const jumlahTerisi = Object.keys(skorItem).length;

    let totalSkor = 0;
    Object.keys(bobotMap).forEach(itemId => {
      const skor = skorItem[itemId] !== undefined ? skorItem[itemId] : 0;
      totalSkor += (skor * bobotMap[itemId] / 100);
    });

    return {
      ...p,
      jumlahTerisi,
      totalItem,
      level: jumlahTerisi > 0 ? cariLevel(totalSkor) : '-'
    };
  });

  res.render('hcr/gabungan/pilih', { pegawai: pegawaiDenganStatus, bulan, tahun });
};
// Halaman input gabungan (8 section) untuk 1 pegawai
exports.showGabungan = async (req, res) => {
  const pegawaiId = req.params.pegawaiId;
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawaiRows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [pegawaiId]);
  if (pegawaiRows.length === 0) {
    req.flash('error', 'Pegawai tidak ditemukan');
    return res.redirect('/hcr-input-gabungan');
  }

  const [[assesmen], [identifikasi], [pelaksanaan], [evaluasi], [penugasan], [sertifikasi], [hariPengembangan], [aksi]] = await Promise.all([
    db.query('SELECT * FROM hcr_assesmen_kompetensi WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=?', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_identifikasi_ppk WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=?', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_pelaksanaan_ppk WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=?', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_evaluasi_ppk WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=?', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_penugasan WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=?', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_sertifikasi WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=? ORDER BY id DESC', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_hari_pengembangan WHERE pegawai_id=? AND periode_bulan=? AND periode_tahun=? ORDER BY id DESC', [pegawaiId, bulan, tahun]),
    db.query('SELECT * FROM hcr_aksi WHERE pic_pegawai_id=? AND periode_bulan=? AND periode_tahun=? ORDER BY id DESC', [pegawaiId, bulan, tahun]),
  ]);

  res.render('hcr/gabungan/detail', {
    pegawai: pegawaiRows[0],
    bulan, tahun,
    assesmen: assesmen[0] || null,
    identifikasi: identifikasi[0] || null,
    pelaksanaan: pelaksanaan[0] || null,
    evaluasi: evaluasi[0] || null,
    penugasan: penugasan[0] || null,
    sertifikasi,
    hariPengembangan,
    aksi
  });
};

const urlKembali = (pegawaiId, bulan, tahun) => `/hcr-input-gabungan/${pegawaiId}?bulan=${bulan}&tahun=${tahun}`;

// === Simpan tiap section ===

exports.simpanAssesmen = async (req, res) => {
  const { pegawai_id, bulan, tahun, jenis_assesmen, tanggal_assesmen, status, skor, catatan } = req.body;
  await db.query(
    `INSERT INTO hcr_assesmen_kompetensi (pegawai_id, periode_bulan, periode_tahun, jenis_assesmen, tanggal_assesmen, status, skor, catatan, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE jenis_assesmen=VALUES(jenis_assesmen), tanggal_assesmen=VALUES(tanggal_assesmen), status=VALUES(status), skor=VALUES(skor), catatan=VALUES(catatan)`,
    [pegawai_id, bulan, tahun, jenis_assesmen, tanggal_assesmen || null, status, skor || null, catatan || null, req.session.user.id]
  );
  await sinkron('MLI_ASSESMEN', bulan, tahun, 'hcr_assesmen_kompetensi', 'status', 'Selesai');
  req.flash('success', 'Assesmen Kompetensi berhasil disimpan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanIdentifikasi = async (req, res) => {
  const { pegawai_id, bulan, tahun, kompetensi_dikembangkan, alasan_potensi, status, catatan } = req.body;
  await db.query(
    `INSERT INTO hcr_identifikasi_ppk (pegawai_id, periode_bulan, periode_tahun, kompetensi_dikembangkan, alasan_potensi, status, catatan, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE kompetensi_dikembangkan=VALUES(kompetensi_dikembangkan), alasan_potensi=VALUES(alasan_potensi), status=VALUES(status), catatan=VALUES(catatan)`,
    [pegawai_id, bulan, tahun, kompetensi_dikembangkan, alasan_potensi || null, status, catatan || null, req.session.user.id]
  );
  await sinkronPersen('MLI_IDENT_PPK', bulan, tahun, 'hcr_identifikasi_ppk');
  req.flash('success', 'Identifikasi PPK berhasil disimpan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanPelaksanaan = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_kegiatan, jadwal_tanggal, status } = req.body;
  await db.query(
    `INSERT INTO hcr_pelaksanaan_ppk (pegawai_id, periode_bulan, periode_tahun, nama_kegiatan, jadwal_tanggal, status, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nama_kegiatan=VALUES(nama_kegiatan), jadwal_tanggal=VALUES(jadwal_tanggal), status=VALUES(status)`,
    [pegawai_id, bulan, tahun, nama_kegiatan, jadwal_tanggal || null, status, req.session.user.id]
  );
  await sinkron('MLI_PELAKSANAAN_PPK', bulan, tahun, 'hcr_pelaksanaan_ppk', 'status', 'Selesai');
  req.flash('success', 'Pelaksanaan PPK berhasil disimpan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanEvaluasi = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_program, tanggal_evaluasi, skor_evaluasi, catatan } = req.body;
  const namaFile = req.file ? req.file.filename : null;
  await db.query(
    `INSERT INTO hcr_evaluasi_ppk (pegawai_id, periode_bulan, periode_tahun, nama_program, tanggal_evaluasi, skor_evaluasi, file_bukti, catatan, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nama_program=VALUES(nama_program), tanggal_evaluasi=VALUES(tanggal_evaluasi), skor_evaluasi=VALUES(skor_evaluasi), file_bukti=COALESCE(VALUES(file_bukti), file_bukti), catatan=VALUES(catatan)`,
    [pegawai_id, bulan, tahun, nama_program, tanggal_evaluasi || null, skor_evaluasi, namaFile, catatan || null, req.session.user.id]
  );
  await sinkronRata('MLI_EVALUASI_PPK', bulan, tahun, 'hcr_evaluasi_ppk', 'skor_evaluasi');
  req.flash('success', 'Evaluasi PPK berhasil disimpan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanPenugasan = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_penugasan, target, realisasi } = req.body;
  await db.query(
    `INSERT INTO hcr_penugasan (pegawai_id, periode_bulan, periode_tahun, nama_penugasan, target, realisasi, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nama_penugasan=VALUES(nama_penugasan), target=VALUES(target), realisasi=VALUES(realisasi)`,
    [pegawai_id, bulan, tahun, nama_penugasan, target || 100, realisasi || 0, req.session.user.id]
  );
  await sinkronPenugasan(bulan, tahun);
  req.flash('success', 'Penugasan berhasil disimpan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanSertifikasi = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_sertifikasi, tanggal_lulus, masa_berlaku } = req.body;
  await db.query(
    `INSERT INTO hcr_sertifikasi (pegawai_id, periode_bulan, periode_tahun, nama_sertifikasi, tanggal_lulus, masa_berlaku, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [pegawai_id, bulan, tahun, nama_sertifikasi, tanggal_lulus || null, masa_berlaku || null, req.session.user.id]
  );
  await sinkronSertifikasi(bulan, tahun);
  req.flash('success', 'Sertifikasi berhasil ditambahkan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanHariPengembangan = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_pelatihan, tanggal, jumlah_hari } = req.body;
  await db.query(
    `INSERT INTO hcr_hari_pengembangan (pegawai_id, periode_bulan, periode_tahun, nama_pelatihan, tanggal, jumlah_hari, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [pegawai_id, bulan, tahun, nama_pelatihan, tanggal || null, jumlah_hari || 1, req.session.user.id]
  );
  await sinkronHariPengembangan(tahun);
  req.flash('success', 'Data pelatihan berhasil ditambahkan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

exports.simpanAksi = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_aksi, target_selesai, status } = req.body;
  await db.query(
    `INSERT INTO hcr_aksi (periode_bulan, periode_tahun, nama_aksi, pic_pegawai_id, target_selesai, status, input_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [bulan, tahun, nama_aksi, pegawai_id, target_selesai || null, status, req.session.user.id]
  );
  await sinkronAksi(bulan, tahun);
  req.flash('success', 'Aksi berhasil ditambahkan');
  res.redirect(urlKembali(pegawai_id, bulan, tahun));
};

// === Fungsi sinkron skor (dipakai bareng) ===

async function sinkron(kode, bulan, tahun, tabel, kolomStatus, nilaiSelesai) {
  const [totalRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const total = totalRows[0].total;
  const [selesaiRows] = await db.query(
    `SELECT COUNT(*) AS jumlah FROM ${tabel} WHERE periode_bulan=? AND periode_tahun=? AND ${kolomStatus}=?`,
    [bulan, tahun, nilaiSelesai]
  );
  const persen = total > 0 ? (selesaiRows[0].jumlah / total) * 100 : 0;
  await simpanSkorSemuaPegawai(kode, bulan, tahun, persen);
}

async function sinkronPersen(kode, bulan, tahun, tabel) {
  const [totalRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const total = totalRows[0].total;
  const [rows] = await db.query(`SELECT COUNT(*) AS jumlah FROM ${tabel} WHERE periode_bulan=? AND periode_tahun=?`, [bulan, tahun]);
  const persen = total > 0 ? (rows[0].jumlah / total) * 100 : 0;
  await simpanSkorSemuaPegawai(kode, bulan, tahun, persen);
}

async function sinkronRata(kode, bulan, tahun, tabel, kolomSkor) {
  const [rows] = await db.query(`SELECT AVG(${kolomSkor}) AS rata FROM ${tabel} WHERE periode_bulan=? AND periode_tahun=?`, [bulan, tahun]);
  const rata = rows[0].rata ? parseFloat(rows[0].rata) : 0;
  await simpanSkorSemuaPegawai(kode, bulan, tahun, rata);
}

async function sinkronPenugasan(bulan, tahun) {
  const [rows] = await db.query('SELECT target, realisasi FROM hcr_penugasan WHERE periode_bulan=? AND periode_tahun=?', [bulan, tahun]);
  let rata = 0;
  if (rows.length > 0) {
    const totalPersen = rows.reduce((sum, r) => sum + (r.target > 0 ? (r.realisasi / r.target) * 100 : 0), 0);
    rata = totalPersen / rows.length;
  }
  await simpanSkorSemuaPegawai('KPI_PENUGASAN', bulan, tahun, rata);
}

async function sinkronSertifikasi(bulan, tahun) {
  const [totalRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const total = totalRows[0].total;
  const [rows] = await db.query('SELECT COUNT(DISTINCT pegawai_id) AS jumlah FROM hcr_sertifikasi WHERE periode_bulan=? AND periode_tahun=?', [bulan, tahun]);
  const persen = total > 0 ? (rows[0].jumlah / total) * 100 : 0;
  await simpanSkorSemuaPegawai('KPI_SERTIFIKASI', bulan, tahun, persen);
}

async function sinkronHariPengembangan(tahun) {
  const TARGET = 8;
  const [rows] = await db.query(
    `SELECT pegawai.id, COALESCE(SUM(hcr_hari_pengembangan.jumlah_hari), 0) AS total_hari
     FROM pegawai LEFT JOIN hcr_hari_pengembangan ON hcr_hari_pengembangan.pegawai_id = pegawai.id AND hcr_hari_pengembangan.periode_tahun = ?
     GROUP BY pegawai.id`, [tahun]
  );
  let rata = 0;
  if (rows.length > 0) {
    const totalPersen = rows.reduce((s, r) => s + Math.min((r.total_hari / TARGET) * 100, 100), 0);
    rata = totalPersen / rows.length;
  }
  for (let b = 1; b <= 12; b++) {
    await simpanSkorSemuaPegawai('KPI_HARI_ORANG', b, tahun, rata);
  }
}

async function sinkronAksi(bulan, tahun) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status='Selesai' THEN 1 ELSE 0 END) AS selesai
     FROM hcr_aksi WHERE periode_bulan=? AND periode_tahun=?`, [bulan, tahun]
  );
  const persen = rows[0].total > 0 ? (rows[0].selesai / rows[0].total) * 100 : 0;
  await simpanSkorSemuaPegawai('MLI_AKSI', bulan, tahun, persen);
}

async function simpanSkorSemuaPegawai(kode, bulan, tahun, persen) {
  const [itemRows] = await db.query('SELECT id FROM hcr_items WHERE kode = ?', [kode]);
  if (itemRows.length === 0) return;
  const itemId = itemRows[0].id;
  const [semuaPegawai] = await db.query('SELECT id FROM pegawai');
  for (const p of semuaPegawai) {
    await db.query(
      `INSERT INTO hcr_realisasi (pegawai_id, hcr_item_id, periode_bulan, periode_tahun, target, capaian, skor)
       VALUES (?, ?, ?, ?, 100, ?, ?)
       ON DUPLICATE KEY UPDATE capaian=VALUES(capaian), skor=VALUES(skor)`,
      [p.id, itemId, bulan, tahun, persen.toFixed(2), persen.toFixed(2)]
    );
  }
}