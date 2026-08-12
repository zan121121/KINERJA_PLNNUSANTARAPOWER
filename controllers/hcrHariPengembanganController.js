const db = require('../config/db');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [dataPelatihan] = await db.query(
    `SELECT hcr_hari_pengembangan.*, pegawai.nama, pegawai.nip
     FROM hcr_hari_pengembangan
     JOIN pegawai ON pegawai.id = hcr_hari_pengembangan.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const totalHariBulanIni = dataPelatihan.reduce((a, b) => a + parseFloat(b.jumlah_hari), 0);

  // Data buat grafik tren bulanan (total hari per bulan, sepanjang tahun yg dipilih)
  const [trenBulanan] = await db.query(
    `SELECT periode_bulan, SUM(jumlah_hari) AS total_hari
     FROM hcr_hari_pengembangan
     WHERE periode_tahun = ?
     GROUP BY periode_bulan`,
    [tahun]
  );
  const trenMap = {};
  trenBulanan.forEach(t => { trenMap[t.periode_bulan] = parseFloat(t.total_hari); });
  const dataTren = [];
  for (let b = 1; b <= 12; b++) {
    dataTren.push(trenMap[b] || 0);
  }

  // Rekap total hari per pegawai sepanjang tahun (buat cek target minimal 8 hari)
  const [totalPerPegawai] = await db.query(
    `SELECT pegawai.id, pegawai.nama, COALESCE(SUM(hcr_hari_pengembangan.jumlah_hari), 0) AS total_hari
     FROM pegawai
     LEFT JOIN hcr_hari_pengembangan 
       ON hcr_hari_pengembangan.pegawai_id = pegawai.id 
       AND hcr_hari_pengembangan.periode_tahun = ?
     GROUP BY pegawai.id, pegawai.nama
     ORDER BY pegawai.nama ASC`,
    [tahun]
  );

  res.render('hcr/hari-pengembangan/index', {
    dataPelatihan,
    totalHariBulanIni,
    dataTren,
    totalPerPegawai,
    bulan,
    tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/hari-pengembangan/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_pelatihan, tanggal, jumlah_hari, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_hari_pengembangan 
        (pegawai_id, periode_bulan, periode_tahun, nama_pelatihan, tanggal, jumlah_hari, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pegawai_id, bulan, tahun, nama_pelatihan, tanggal || null, jumlah_hari || 1, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data pelatihan berhasil disimpan');
    res.redirect(`/hcr-hari-pengembangan?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH HARI PENGEMBANGAN:', err);
    req.flash('error', 'Gagal menyimpan data');
    res.redirect('/hcr-hari-pengembangan/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_hari_pengembangan.*, pegawai.nama, pegawai.nip
     FROM hcr_hari_pengembangan
     JOIN pegawai ON pegawai.id = hcr_hari_pengembangan.pegawai_id
     WHERE hcr_hari_pengembangan.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-hari-pengembangan');
  }
  res.render('hcr/hari-pengembangan/edit', { data: rows[0] });
};

exports.edit = async (req, res) => {
  const { nama_pelatihan, tanggal, jumlah_hari, catatan } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_hari_pengembangan WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-hari-pengembangan');
    }

    await db.query(
      `UPDATE hcr_hari_pengembangan 
       SET nama_pelatihan=?, tanggal=?, jumlah_hari=?, catatan=? 
       WHERE id=?`,
      [nama_pelatihan, tanggal || null, jumlah_hari || 1, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data berhasil diperbarui');
    res.redirect(`/hcr-hari-pengembangan?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT HARI PENGEMBANGAN:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-hari-pengembangan/edit/' + req.params.id);
  }
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_hari_pengembangan WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_hari_pengembangan WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data berhasil dihapus');
  res.redirect('/hcr-hari-pengembangan');
};

// Sinkron ke hcr_realisasi: skornya = rata-rata (total hari per pegawai sepanjang tahun / target 8 hari) x 100, dibatasi maks 100
async function sinkronSkorHcr(bulan, tahun) {
  const TARGET_HARI_PER_TAHUN = 8;

  const [rows] = await db.query(
    `SELECT pegawai.id, COALESCE(SUM(hcr_hari_pengembangan.jumlah_hari), 0) AS total_hari
     FROM pegawai
     LEFT JOIN hcr_hari_pengembangan 
       ON hcr_hari_pengembangan.pegawai_id = pegawai.id 
       AND hcr_hari_pengembangan.periode_tahun = ?
     GROUP BY pegawai.id`,
    [tahun]
  );

  let rataPersen = 0;
  if (rows.length > 0) {
    const totalPersen = rows.reduce((sum, r) => {
      const persen = Math.min((r.total_hari / TARGET_HARI_PER_TAHUN) * 100, 100);
      return sum + persen;
    }, 0);
    rataPersen = totalPersen / rows.length;
  }

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'KPI_HARI_ORANG'`);
  if (itemRows.length === 0) return;
  const itemId = itemRows[0].id;

  const [semuaPegawai] = await db.query('SELECT id FROM pegawai');
  for (const p of semuaPegawai) {
    await db.query(
      `INSERT INTO hcr_realisasi (pegawai_id, hcr_item_id, periode_bulan, periode_tahun, target, capaian, skor)
       VALUES (?, ?, ?, ?, 100, ?, ?)
       ON DUPLICATE KEY UPDATE capaian = VALUES(capaian), skor = VALUES(skor)`,
      [p.id, itemId, bulan, tahun, rataPersen.toFixed(2), rataPersen.toFixed(2)]
    );
  }
}