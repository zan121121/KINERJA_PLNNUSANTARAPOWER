const db = require('../config/db');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [dataAksi] = await db.query(
    `SELECT hcr_aksi.*, pegawai.nama AS nama_pic
     FROM hcr_aksi
     LEFT JOIN pegawai ON pegawai.id = hcr_aksi.pic_pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY hcr_aksi.id DESC`,
    [bulan, tahun]
  );

  const kolomBelum = dataAksi.filter(a => a.status === 'Belum');
  const kolomProses = dataAksi.filter(a => a.status === 'Proses');
  const kolomSelesai = dataAksi.filter(a => a.status === 'Selesai');

  const persentase = dataAksi.length > 0 ? (kolomSelesai.length / dataAksi.length) * 100 : 0;

  res.render('hcr/aksi/index', {
    kolomBelum, kolomProses, kolomSelesai,
    totalAksi: dataAksi.length,
    persentase: persentase.toFixed(1),
    bulan, tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/aksi/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { bulan, tahun, nama_aksi, pic_pegawai_id, target_selesai, status, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_aksi (periode_bulan, periode_tahun, nama_aksi, pic_pegawai_id, target_selesai, status, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bulan, tahun, nama_aksi, pic_pegawai_id || null, target_selesai || null, status, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Aksi berhasil ditambahkan');
    res.redirect(req.body.kembali || `/hcr-aksi?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH AKSI:', err);
    req.flash('error', 'Gagal menambahkan aksi');
    res.redirect('/hcr-aksi/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM hcr_aksi WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-aksi');
  }
  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/aksi/edit', { data: rows[0], pegawai });
};

exports.edit = async (req, res) => {
  const { nama_aksi, pic_pegawai_id, target_selesai, status, catatan } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_aksi WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-aksi');
    }

    await db.query(
      `UPDATE hcr_aksi SET nama_aksi=?, pic_pegawai_id=?, target_selesai=?, status=?, catatan=? WHERE id=?`,
      [nama_aksi, pic_pegawai_id || null, target_selesai || null, status, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Aksi berhasil diperbarui');
    res.redirect(`/hcr-aksi?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT AKSI:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-aksi/edit/' + req.params.id);
  }
};

// Update status cepat langsung dari board (drag-drop sederhana via tombol)
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const [existing] = await db.query('SELECT * FROM hcr_aksi WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('UPDATE hcr_aksi SET status = ? WHERE id = ?', [status, req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  res.json({ success: true });
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_aksi WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_aksi WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Aksi berhasil dihapus');
  res.redirect(req.body.kembali || '/hcr-aksi');
};

// Sinkron ke hcr_realisasi: skornya = % aksi berstatus "Selesai" dari total aksi periode itu
async function sinkronSkorHcr(bulan, tahun) {
  const [rows] = await db.query(
    `SELECT 
       COUNT(*) AS total, 
       SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) AS selesai
     FROM hcr_aksi WHERE periode_bulan = ? AND periode_tahun = ?`,
    [bulan, tahun]
  );
  const total = rows[0].total;
  const selesai = rows[0].selesai || 0;
  const persentase = total > 0 ? (selesai / total) * 100 : 0;

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'MLI_AKSI'`);
  if (itemRows.length === 0) return;
  const itemId = itemRows[0].id;

  const [semuaPegawai] = await db.query('SELECT id FROM pegawai');
  for (const p of semuaPegawai) {
    await db.query(
      `INSERT INTO hcr_realisasi (pegawai_id, hcr_item_id, periode_bulan, periode_tahun, target, capaian, skor)
       VALUES (?, ?, ?, ?, 100, ?, ?)
       ON DUPLICATE KEY UPDATE capaian = VALUES(capaian), skor = VALUES(skor)`,
      [p.id, itemId, bulan, tahun, persentase.toFixed(2), persentase.toFixed(2)]
    );
  }
}