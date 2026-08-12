const db = require('../config/db');

exports.index = async (req, res) => {
  const [fields] = await db.query('SELECT * FROM pegawai_custom_fields ORDER BY urutan ASC, id ASC');
  res.render('pegawai/custom-fields/index', { fields });
};

exports.showTambah = (req, res) => {
  res.render('pegawai/custom-fields/tambah');
};

exports.tambah = async (req, res) => {
  const { field_label, field_type, option_items } = req.body;

  try {
    let optionsClean = null;

    if (field_type === 'dropdown') {
      const daftarOpsi = Array.isArray(option_items) ? option_items : [option_items];
      const opsiBersih = daftarOpsi
        .map(o => (o || '').trim())
        .filter(o => o.length > 0);

      optionsClean = opsiBersih.join(',');
    }

    await db.query(
      'INSERT INTO pegawai_custom_fields (field_label, field_type, options) VALUES (?, ?, ?)',
      [field_label, field_type, optionsClean]
    );
    req.flash('success', 'Field baru berhasil ditambahkan');
    res.redirect('/pegawai/custom-fields');
  } catch (err) {
    console.error('ERROR TAMBAH FIELD:', err);
    req.flash('error', 'Gagal menambahkan field');
    res.redirect('/pegawai/custom-fields/tambah');
  }
};

exports.showEdit = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM pegawai_custom_fields WHERE id = ?', [req.params.id]);
  if (rows.length === 0) {
    req.flash('error', 'Field tidak ditemukan');
    return res.redirect('/pegawai/custom-fields');
  }
  res.render('pegawai/custom-fields/edit', { field: rows[0] });
};

exports.edit = async (req, res) => {
  const { field_label, field_type, option_items } = req.body;

  try {
    let optionsClean = null;

    if (field_type === 'dropdown') {
      const daftarOpsi = Array.isArray(option_items) ? option_items : [option_items];
      const opsiBersih = daftarOpsi
        .map(o => (o || '').trim())
        .filter(o => o.length > 0);

      optionsClean = opsiBersih.join(',');
    }

    await db.query(
      'UPDATE pegawai_custom_fields SET field_label = ?, field_type = ?, options = ? WHERE id = ?',
      [field_label, field_type, optionsClean, req.params.id]
    );

    await db.query('DELETE FROM pegawai_custom_values WHERE field_id = ?', [req.params.id]);

    req.flash('success', 'Field berhasil diperbarui. Data lama pada field ini direset — silakan isi ulang.');
    res.redirect('/pegawai/custom-fields');
  } catch (err) {
    console.error('ERROR EDIT FIELD:', err);
    req.flash('error', 'Gagal memperbarui field');
    res.redirect('/pegawai/custom-fields/edit/' + req.params.id);
  }
};

exports.showHapusConfirm = async (req, res) => {
  const [fieldRows] = await db.query('SELECT * FROM pegawai_custom_fields WHERE id = ?', [req.params.id]);
  if (fieldRows.length === 0) {
    req.flash('error', 'Field tidak ditemukan');
    return res.redirect('/pegawai/custom-fields');
  }

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS jumlah FROM pegawai_custom_values 
     WHERE field_id = ? AND value IS NOT NULL AND value != ''`,
    [req.params.id]
  );

  res.render('pegawai/custom-fields/hapus-confirm', {
    field: fieldRows[0],
    jumlahData: countRows[0].jumlah
  });
};

exports.hapus = async (req, res) => {
  await db.query('DELETE FROM pegawai_custom_fields WHERE id = ?', [req.params.id]);
  req.flash('success', 'Field berhasil dihapus');
  res.redirect('/pegawai/custom-fields');
};