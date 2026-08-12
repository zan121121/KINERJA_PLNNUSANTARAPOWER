const db = require('../config/db');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [dataIdentifikasi] = await db.query(
    `SELECT hcr_identifikasi_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_identifikasi_ppk
     JOIN pegawai ON pegawai.id = hcr_identifikasi_ppk.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const jumlahDisetujui = dataIdentifikasi.filter(d => d.status === 'Disetujui').length;
  const persentase = totalPegawai > 0 ? (dataIdentifikasi.length / totalPegawai) * 100 : 0;

  res.render('hcr/identifikasi/index', {
    dataIdentifikasi,
    totalPegawai,
    jumlahDisetujui,
    persentase: persentase.toFixed(1),
    bulan,
    tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/identifikasi/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, kompetensi_dikembangkan, alasan_potensi, status, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_identifikasi_ppk 
        (pegawai_id, periode_bulan, periode_tahun, kompetensi_dikembangkan, alasan_potensi, status, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        kompetensi_dikembangkan = VALUES(kompetensi_dikembangkan),
        alasan_potensi = VALUES(alasan_potensi),
        status = VALUES(status),
        catatan = VALUES(catatan),
        input_by = VALUES(input_by)`,
      [pegawai_id, bulan, tahun, kompetensi_dikembangkan, alasan_potensi || null, status, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data identifikasi PPK berhasil disimpan');
    res.redirect(`/hcr-identifikasi?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH IDENTIFIKASI:', err);
    req.flash('error', 'Gagal menyimpan data');
    res.redirect('/hcr-identifikasi/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_identifikasi_ppk.*, pegawai.nama, pegawai.nip
     FROM hcr_identifikasi_ppk
     JOIN pegawai ON pegawai.id = hcr_identifikasi_ppk.pegawai_id
     WHERE hcr_identifikasi_ppk.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-identifikasi');
  }
  res.render('hcr/identifikasi/edit', { data: rows[0] });
};

exports.edit = async (req, res) => {
  const { kompetensi_dikembangkan, alasan_potensi, status, catatan } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_identifikasi_ppk WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-identifikasi');
    }

    await db.query(
      `UPDATE hcr_identifikasi_ppk 
       SET kompetensi_dikembangkan=?, alasan_potensi=?, status=?, catatan=? 
       WHERE id=?`,
      [kompetensi_dikembangkan, alasan_potensi || null, status, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data berhasil diperbarui');
    res.redirect(`/hcr-identifikasi?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT IDENTIFIKASI:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-identifikasi/edit/' + req.params.id);
  }
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_identifikasi_ppk WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_identifikasi_ppk WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data berhasil dihapus');
  res.redirect('/hcr-identifikasi');
};

// Sinkron ke hcr_realisasi (item MLI_IDENT_PPK), dihitung dari % pegawai yang sudah diidentifikasi
async function sinkronSkorHcr(bulan, tahun) {
  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [jumlahRows] = await db.query(
    `SELECT COUNT(*) AS jumlah FROM hcr_identifikasi_ppk 
     WHERE periode_bulan = ? AND periode_tahun = ?`,
    [bulan, tahun]
  );
  const jumlahTeridentifikasi = jumlahRows[0].jumlah;
  const persentase = totalPegawai > 0 ? (jumlahTeridentifikasi / totalPegawai) * 100 : 0;

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'MLI_IDENT_PPK'`);
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