const db = require('../config/db');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [dataSertifikasi] = await db.query(
    `SELECT hcr_sertifikasi.*, pegawai.nama, pegawai.nip
     FROM hcr_sertifikasi
     JOIN pegawai ON pegawai.id = hcr_sertifikasi.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const hariIni = new Date();
  const dataWithStatus = dataSertifikasi.map(d => {
    let statusMasaBerlaku = 'Tanpa batas';
    if (d.masa_berlaku) {
      const tanggalExpired = new Date(d.masa_berlaku);
      statusMasaBerlaku = tanggalExpired < hariIni ? 'Kadaluarsa' : 'Aktif';
    }
    return { ...d, statusMasaBerlaku };
  });

  const pegawaiUnikTersertifikasi = new Set(dataSertifikasi.map(d => d.pegawai_id)).size;
  const persentase = totalPegawai > 0 ? (pegawaiUnikTersertifikasi / totalPegawai) * 100 : 0;

  res.render('hcr/sertifikasi/index', {
    dataSertifikasi: dataWithStatus,
    totalPegawai,
    pegawaiUnikTersertifikasi,
    persentase: persentase.toFixed(1),
    bulan,
    tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/sertifikasi/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_sertifikasi, tanggal_lulus, masa_berlaku, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_sertifikasi 
        (pegawai_id, periode_bulan, periode_tahun, nama_sertifikasi, tanggal_lulus, masa_berlaku, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pegawai_id, bulan, tahun, nama_sertifikasi, tanggal_lulus || null, masa_berlaku || null, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data sertifikasi berhasil disimpan');
    res.redirect(req.body.kembali || `/hcr-sertifikasi?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH SERTIFIKASI:', err);
    req.flash('error', 'Gagal menyimpan data sertifikasi');
    res.redirect('/hcr-sertifikasi/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_sertifikasi.*, pegawai.nama, pegawai.nip
     FROM hcr_sertifikasi
     JOIN pegawai ON pegawai.id = hcr_sertifikasi.pegawai_id
     WHERE hcr_sertifikasi.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-sertifikasi');
  }
  res.render('hcr/sertifikasi/edit', { data: rows[0] });
};

exports.edit = async (req, res) => {
  const { nama_sertifikasi, tanggal_lulus, masa_berlaku, catatan } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_sertifikasi WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-sertifikasi');
    }

    await db.query(
      `UPDATE hcr_sertifikasi 
       SET nama_sertifikasi=?, tanggal_lulus=?, masa_berlaku=?, catatan=? 
       WHERE id=?`,
      [nama_sertifikasi, tanggal_lulus || null, masa_berlaku || null, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data berhasil diperbarui');
    res.redirect(`/hcr-sertifikasi?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT SERTIFIKASI:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-sertifikasi/edit/' + req.params.id);
  }
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_sertifikasi WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_sertifikasi WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data berhasil dihapus');
  res.redirect(req.body.kembali || '/hcr-sertifikasi');
};

// Sinkron ke hcr_realisasi: skornya = % pegawai unik yang punya sertifikasi di periode itu
async function sinkronSkorHcr(bulan, tahun) {
  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [jumlahRows] = await db.query(
    `SELECT COUNT(DISTINCT pegawai_id) AS jumlah FROM hcr_sertifikasi 
     WHERE periode_bulan = ? AND periode_tahun = ?`,
    [bulan, tahun]
  );
  const pegawaiTersertifikasi = jumlahRows[0].jumlah;
  const persentase = totalPegawai > 0 ? (pegawaiTersertifikasi / totalPegawai) * 100 : 0;

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'KPI_SERTIFIKASI'`);
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