const db = require('../config/db');

exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [dataPenugasan] = await db.query(
    `SELECT hcr_penugasan.*, pegawai.nama, pegawai.nip
     FROM hcr_penugasan
     JOIN pegawai ON pegawai.id = hcr_penugasan.pegawai_id
     WHERE periode_bulan = ? AND periode_tahun = ?
     ORDER BY pegawai.nama ASC`,
    [bulan, tahun]
  );

  const dataWithPersen = dataPenugasan.map(d => ({
    ...d,
    persen: d.target > 0 ? ((d.realisasi / d.target) * 100).toFixed(1) : 0
  }));

  const rataPersen = dataWithPersen.length > 0
    ? dataWithPersen.reduce((a, b) => a + parseFloat(b.persen), 0) / dataWithPersen.length
    : 0;

  res.render('hcr/penugasan/index', {
    dataPenugasan: dataWithPersen,
    rataPersen: rataPersen.toFixed(1),
    bulan,
    tahun
  });
};

exports.showTambah = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawai] = await db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC');
  res.render('hcr/penugasan/tambah', { pegawai, bulan, tahun });
};

exports.tambah = async (req, res) => {
  const { pegawai_id, bulan, tahun, nama_penugasan, target, realisasi, catatan } = req.body;

  try {
    await db.query(
      `INSERT INTO hcr_penugasan 
        (pegawai_id, periode_bulan, periode_tahun, nama_penugasan, target, realisasi, catatan, input_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nama_penugasan = VALUES(nama_penugasan),
        target = VALUES(target),
        realisasi = VALUES(realisasi),
        catatan = VALUES(catatan),
        input_by = VALUES(input_by)`,
      [pegawai_id, bulan, tahun, nama_penugasan, target || 100, realisasi || 0, catatan || null, req.session.user.id]
    );

    await sinkronSkorHcr(bulan, tahun);

    req.flash('success', 'Data penugasan berhasil disimpan');
    res.redirect(req.body.kembali || `/hcr-penugasan?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR TAMBAH PENUGASAN:', err);
    req.flash('error', 'Gagal menyimpan data penugasan');
    res.redirect('/hcr-penugasan/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_penugasan.*, pegawai.nama, pegawai.nip
     FROM hcr_penugasan
     JOIN pegawai ON pegawai.id = hcr_penugasan.pegawai_id
     WHERE hcr_penugasan.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) {
    req.flash('error', 'Data tidak ditemukan');
    return res.redirect('/hcr-penugasan');
  }
  res.render('hcr/penugasan/edit', { data: rows[0] });
};

exports.edit = async (req, res) => {
  const { nama_penugasan, target, realisasi, catatan } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM hcr_penugasan WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      req.flash('error', 'Data tidak ditemukan');
      return res.redirect('/hcr-penugasan');
    }

    await db.query(
      `UPDATE hcr_penugasan 
       SET nama_penugasan=?, target=?, realisasi=?, catatan=? 
       WHERE id=?`,
      [nama_penugasan, target || 100, realisasi || 0, catatan || null, req.params.id]
    );

    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);

    req.flash('success', 'Data berhasil diperbarui');
    res.redirect(`/hcr-penugasan?bulan=${existing[0].periode_bulan}&tahun=${existing[0].periode_tahun}`);
  } catch (err) {
    console.error('ERROR EDIT PENUGASAN:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/hcr-penugasan/edit/' + req.params.id);
  }
};

exports.hapus = async (req, res) => {
  const [existing] = await db.query('SELECT * FROM hcr_penugasan WHERE id = ?', [req.params.id]);
  if (existing.length > 0) {
    await db.query('DELETE FROM hcr_penugasan WHERE id = ?', [req.params.id]);
    await sinkronSkorHcr(existing[0].periode_bulan, existing[0].periode_tahun);
  }
  req.flash('success', 'Data berhasil dihapus');
  res.redirect(req.body.kembali || '/hcr-penugasan');
};

// Sinkron ke hcr_realisasi: skornya = rata-rata % realisasi/target semua penugasan di periode itu
async function sinkronSkorHcr(bulan, tahun) {
  const [rows] = await db.query(
    `SELECT target, realisasi FROM hcr_penugasan WHERE periode_bulan = ? AND periode_tahun = ?`,
    [bulan, tahun]
  );

  let rataPersen = 0;
  if (rows.length > 0) {
    const totalPersen = rows.reduce((sum, r) => {
      const persen = r.target > 0 ? (r.realisasi / r.target) * 100 : 0;
      return sum + persen;
    }, 0);
    rataPersen = totalPersen / rows.length;
  }

  const [itemRows] = await db.query(`SELECT id FROM hcr_items WHERE kode = 'KPI_PENUGASAN'`);
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