const db = require('../config/db');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [dataPelaksanaan] = await db.query(
    `SELECT hcr_pelaksanaan_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_pelaksanaan_ppk
     JOIN pegawai ON pegawai.id = hcr_pelaksanaan_ppk.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const jumlahSelesai = dataPelaksanaan.filter(d => d.status === 'Selesai').length;
  const jumlahTerlambat = dataPelaksanaan.filter(d => d.status === 'Terlambat').length;
  const persentase = totalPegawai > 0 ? (jumlahSelesai / totalPegawai) * 100 : 0;

  res.render('hcr/pelaksanaan/index', {
    dataPelaksanaan,
    totalPegawai,
    jumlahSelesai,
    jumlahTerlambat,
    persentase: persentase.toFixed(1),
    bulan,
    tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/pelaksanaan/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_kegiatan, jadwal_tanggal, status, log_aktivitas } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_pelaksanaan_ppk 
        (pegawai_id, periode_bulan, periode_tahun, nama_kegiatan, jadwal_tanggal, status, log_aktivitas, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nama_kegiatan = VALUES(nama_kegiatan),
        jadwal_tanggal = VALUES(jadwal_tanggal),
        status = VALUES(status),
        log_aktivitas = VALUES(log_aktivitas),
        input_by = VALUES(input_by)`,
      [pegawai_id, bulan, tahun, nama_kegiatan, jadwal_tanggal || null, status, log_aktivitas || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data pelaksanaan PPK berhasil disimpan');
    res.redirect(`/hcr-pelaksanaan?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH PELAKSANAAN:', err);
    req.flash('error', 'Gagal menyimpan data');
    res.redirect('/hcr-pelaksanaan/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_pelaksanaan_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_pelaksanaan_ppk
     JOIN pegawai ON pegawai.id = hcr_pelaksanaan_ppk.pegawai_id
     WHERE hcr_pelaksanaan_ppk.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-pelaksanaan');
  }
  res.render('hcr/pelaksanaan/edit', { data: rows[0] });
};

exports.edit = async (req, res) => {
  const { nama_kegiatan, jadwal_tanggal, status, log_aktivitas } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_pelaksanaan_ppk WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-pelaksanaan');
    }

    await db.query(
      `UPDATE hcr_pelaksanaan_ppk 
       SET nama_kegiatan=?, jadwal_tanggal=?, status=?, log_aktivitas=? 
       WHERE id=?`,
      [nama_kegiatan, jadwal_tanggal || null, status, log_aktivitas || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data berhasil diperbarui');
    res.redirect(`/hcr-pelaksanaan?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT PELAKSANAAN:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-pelaksanaan/edit/' + req.params.id);
  }
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_pelaksanaan_ppk WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_pelaksanaan_ppk WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data berhasil dihapus');
  res.redirect('/hcr-pelaksanaan');
};

// Halaman detail 1 kegiatan + daftar log aktivitasnya
exports.showDetail = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_pelaksanaan_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_pelaksanaan_ppk
     JOIN pegawai ON pegawai.id = hcr_pelaksanaan_ppk.pegawai_id
     WHERE hcr_pelaksanaan_ppk.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-pelaksanaan');
  }

  const [logs] = await db.query(
    `SELECT * FROM hcr_pelaksanaan_log WHERE pelaksanaan_id = ? ORDER BY tanggal_log DESC, id DESC`,
    [req.params.id]
  );

  res.render('hcr/pelaksanaan/detail', { data: rows[0], logs });
};

// Tambah 1 entri log baru
exports.tambahLog = async (req, res) => {
  const { tanggal_log, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_pelaksanaan_log (pelaksanaan_id, tanggal_log, catatan, input_by) VALUES (?, ?, ?, ?)`,
      [req.params.id, tanggal_log || new Date().toISOString().split('T')[0], catatan, req.session.user.id]
    );
    req.flash('success', 'Log aktivitas berhasil ditambahkan');
  } catch (err) {
    console.error('ERROR TAMBAH LOG:', err);
    req.flash('error', 'Gagal menambahkan log');
  }

  res.redirect(`/hcr-pelaksanaan/detail/${req.params.id}`);
};

// Hapus 1 entri log
exports.hapusLog = async (req, res) => {
  const [logRow] = await db.query('SELECT pelaksanaan_id FROM hcr_pelaksanaan_log WHERE id = ?', [req.params.logId]);
  if (logRow.length > 0) {
    await db.query('DELETE FROM hcr_pelaksanaan_log WHERE id = ?', [req.params.logId]);
    return res.redirect(`/hcr-pelaksanaan/detail/${logRow[0].pelaksanaan_id}`);
  }
  res.redirect('/hcr-pelaksanaan');
};

// Sinkron ke hcr_realisasi (item MLI_PELAKSANAAN_PPK), dihitung dari % pegawai berstatus "Selesai"
async function sinkronSkorHcr(bulan, tahun) {
  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [jumlahRows] = await db.query(
    `SELECT COUNT(*) AS jumlah FROM hcr_pelaksanaan_ppk 
     WHERE periode_bulan = ? AND periode_tahun = ? AND status = 'Selesai'`,
    [bulan, tahun]
  );
  const jumlahSelesai = jumlahRows[0].jumlah;
  const persentase = totalPegawai > 0 ? (jumlahSelesai / totalPegawai) * 100 : 0;

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'MLI_PELAKSANAAN_PPK'`);
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