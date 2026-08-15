const db = require('../config/db');

// Halaman utama: progress bar + tabel
exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [dataAssesmen] = await db.query(
    `SELECT hcr_assesmen_kompetensi.*, pegawai.nama, pegawai.nip
     FROM hcr_assesmen_kompetensi
     JOIN pegawai ON pegawai.id = hcr_assesmen_kompetensi.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const jumlahSelesai = dataAssesmen.filter(d => d.status === 'Selesai').length;
  const persentase = totalPegawai > 0 ? (jumlahSelesai / totalPegawai) * 100 : 0;

  res.render('hcr/assesmen/index', {
    dataAssesmen,
    totalPegawai,
    jumlahSelesai,
    persentase: persentase.toFixed(1),
    bulan,
    tahun
  });
};

// Form tambah
exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/assesmen/tambah', { pegawai, bulan, tahun });
};

// Proses tambah/update (pakai ON DUPLICATE biar aman kalau diisi ulang)
exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, jenis_assesmen, tanggal_assesmen, status, skor, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_assesmen_kompetensi 
        (pegawai_id, periode_bulan, periode_tahun, jenis_assesmen, tanggal_assesmen, status, skor, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        jenis_assesmen = VALUES(jenis_assesmen),
        tanggal_assesmen = VALUES(tanggal_assesmen),
        status = VALUES(status),
        skor = VALUES(skor),
        catatan = VALUES(catatan),
        input_by = VALUES(input_by)`,
      [pegawai_id, bulan, tahun, jenis_assesmen, tanggal_assesmen || null, status, skor || null, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data assesmen berhasil disimpan');
    res.redirect(req.body.kembali || `/hcr-assesmen?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH ASSESMEN:', err);
    req.flash('error', 'Gagal menyimpan data assesmen');
    res.redirect('/hcr-assesmen/tambah');
  }
};

// Form edit
exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_assesmen_kompetensi.*, pegawai.nama, pegawai.nip
     FROM hcr_assesmen_kompetensi
     JOIN pegawai ON pegawai.id = hcr_assesmen_kompetensi.pegawai_id
     WHERE hcr_assesmen_kompetensi.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-assesmen');
  }
  res.render('hcr/assesmen/edit', { data: rows[0] });
};

// Proses edit
exports.edit = async (req, res) => {
  const { jenis_assesmen, tanggal_assesmen, status, skor, catatan } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_assesmen_kompetensi WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-assesmen');
    }

    await db.query(
      `UPDATE hcr_assesmen_kompetensi 
       SET jenis_assesmen=?, tanggal_assesmen=?, status=?, skor=?, catatan=? 
       WHERE id=?`,
      [jenis_assesmen, tanggal_assesmen || null, status, skor || null, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data assesmen berhasil diperbarui');
    res.redirect(`/hcr-assesmen?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT ASSESMEN:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-assesmen/edit/' + req.params.id);
  }
};

// Hapus
exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_assesmen_kompetensi WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_assesmen_kompetensi WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data assesmen berhasil dihapus');
  res.redirect(req.body.kembali || '/hcr-assesmen');
};

// Fungsi bantu: hitung ulang % assesmen selesai, lalu simpan sebagai skor item HCR #1 (MLI_ASSESMEN)
// supaya nyambung otomatis ke Dashboard Rekap HCR yang sudah ada
async function sinkronSkorHcr(bulan, tahun) {
  const [totalPegawaiRows] = await db.query('SELECT COUNT(*) AS total FROM pegawai');
  const totalPegawai = totalPegawaiRows[0].total;

  const [selesaiRows] = await db.query(
    `SELECT COUNT(*) AS jumlah FROM hcr_assesmen_kompetensi 
     WHERE periode_bulan = ? AND periode_tahun = ? AND status = 'Selesai'`,
    [bulan, tahun]
  );
  const jumlahSelesai = selesaiRows[0].jumlah;
  const persentase = totalPegawai > 0 ? (jumlahSelesai / totalPegawai) * 100 : 0;

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'MLI_ASSESMEN'`);
  if (itemRows.length === 0) return;
  const itemId = itemRows[0].id;

  // Update skor rata-rata untuk SEMUA pegawai secara sama (karena ini metrik unit, bukan individu)
  // Jadi kita simpan sebagai 1 baris representatif per pegawai supaya konsisten dengan struktur hcr_realisasi
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