const db = require('../config/db');

exports.index = async (req, res) => {
  const [pegawai] = await db.query('SELECT * FROM pegawai ORDER BY nama ASC');
  res.render('pegawai/index', { pegawai });
};

exports.showTambah = async (req, res) => {
  const [customFields] = await db.query('SELECT * FROM pegawai_custom_fields ORDER BY urutan ASC, id ASC');
  res.render('pegawai/tambah', { customFields });
};

exports.tambah = async (req, res) => {
  const { nip, nama, jabatan, tempat_lahir, tanggal_lahir, jenis_kelamin, golongan } = req.body;

  try {
    const [hasil] = await db.query(
      `INSERT INTO pegawai (nip, nama, jabatan, tempat_lahir, tanggal_lahir, jenis_kelamin, golongan) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nip, nama, jabatan, tempat_lahir, tanggal_lahir || null, jenis_kelamin, golongan]
    );

    const pegawaiId = hasil.insertId;

    // Simpan nilai custom fields (kalau ada)
    const [customFields] = await db.query('SELECT * FROM pegawai_custom_fields');
    for (const field of customFields) {
      const key = 'custom_' + field.id;
      if (req.body[key] !== undefined) {
        await db.query(
          'INSERT INTO pegawai_custom_values (pegawai_id, field_id, value) VALUES (?, ?, ?)',
          [pegawaiId, field.id, req.body[key]]
        );
      }
    }

    req.flash('success', 'Data pegawai berhasil ditambahkan');
    res.redirect('/pegawai');
  } catch (err) {
    console.error('ERROR TAMBAH:', err);
    req.flash('error', 'Gagal menambahkan pegawai (NIP mungkin sudah dipakai)');
    res.redirect('/pegawai/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    req.flash('error', 'Data pegawai tidak ditemukan');
    return res.redirect('/pegawai');
  }

  const [customFields] = await db.query(
    `SELECT pegawai_custom_fields.*, pegawai_custom_values.value 
     FROM pegawai_custom_fields
     LEFT JOIN pegawai_custom_values 
       ON pegawai_custom_values.field_id = pegawai_custom_fields.id 
       AND pegawai_custom_values.pegawai_id = ?
     ORDER BY pegawai_custom_fields.urutan ASC, pegawai_custom_fields.id ASC`,
    [req.params.id]
  );

  res.render('pegawai/edit', { pegawai: rows[0], customFields });
};

exports.edit = async (req, res) => {
  const { nip, nama, jabatan, tempat_lahir, tanggal_lahir, jenis_kelamin, golongan } = req.body;

  try {
    await db.query(
      `UPDATE pegawai SET nip=?, nama=?, jabatan=?, tempat_lahir=?, tanggal_lahir=?, jenis_kelamin=?, golongan=? WHERE id=?`,
      [nip, nama, jabatan, tempat_lahir, tanggal_lahir || null, jenis_kelamin, golongan, req.params.id]
    );

    const [customFields] = await db.query('SELECT * FROM pegawai_custom_fields');
    for (const field of customFields) {
      const key = 'custom_' + field.id;
      if (req.body[key] !== undefined) {
        await db.query(
          `INSERT INTO pegawai_custom_values (pegawai_id, field_id, value) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value)`,
          [req.params.id, field.id, req.body[key]]
        );
      }
    }

    req.flash('success', 'Data pegawai berhasil diperbarui');
    res.redirect('/pegawai');
  } catch (err) {
    console.error('ERROR EDIT:', err);
    req.flash('error', 'Gagal memperbarui data');
    res.redirect('/pegawai/edit/' + req.params.id);
  }
};

// Data lengkap 1 pegawai dalam format JSON, buat ditampilkan di modal
exports.detailJson = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Data tidak ditemukan' });
    }

    const [customFields] = await db.query(
      `SELECT pegawai_custom_fields.field_label, pegawai_custom_fields.field_type, pegawai_custom_values.value
       FROM pegawai_custom_fields
       LEFT JOIN pegawai_custom_values 
         ON pegawai_custom_values.field_id = pegawai_custom_fields.id 
         AND pegawai_custom_values.pegawai_id = ?
       ORDER BY pegawai_custom_fields.urutan ASC, pegawai_custom_fields.id ASC`,
      [req.params.id]
    );

    res.json({ pegawai: rows[0], customFields });
  } catch (err) {
    console.error('ERROR DETAIL JSON:', err);
    res.status(500).json({ error: 'Gagal mengambil data' });
  }
};

// Halaman konfirmasi sebelum hapus (kasih tau dampaknya)
exports.showHapusConfirm = async (req, res) => {
  const [pegawaiRows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [req.params.id]);
  if (pegawaiRows.length === 0) {
    req.flash('error', 'Data pegawai tidak ditemukan');
    return res.redirect('/pegawai');
  }

  const [hcrCount] = await db.query(
    'SELECT COUNT(*) AS jumlah FROM hcr_realisasi WHERE pegawai_id = ?',
    [req.params.id]
  );

  res.render('pegawai/hapus-confirm', {
    pegawai: pegawaiRows[0],
    jumlahHcr: hcrCount[0].jumlah
  });
};

exports.hapus = async (req, res) => {
  await db.query('DELETE FROM pegawai WHERE id = ?', [req.params.id]);
  req.flash('success', 'Data pegawai berhasil dihapus');
  res.redirect('/pegawai');
};