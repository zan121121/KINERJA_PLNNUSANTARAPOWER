const db = require('../config/db');

exports.index = async (req, res) => {
  const [levels] = await db.query('SELECT * FROM hcr_level_config ORDER BY urutan ASC');
  res.render('hcr/level/index', { levels });
};

exports.update = async (req, res) => {
  const { level_label, min_skor, max_skor } = req.body;
  const daftarId = Object.keys(level_label);

  try {
    for (const id of daftarId) {
      await db.query(
        'UPDATE hcr_level_config SET level_label = ?, min_skor = ?, max_skor = ? WHERE id = ?',
        [level_label[id], parseFloat(min_skor[id]) || 0, parseFloat(max_skor[id]) || 100, id]
      );
    }
    req.flash('success', 'Konfigurasi level berhasil disimpan');
  } catch (err) {
    console.error('ERROR UPDATE LEVEL:', err);
    req.flash('error', 'Gagal menyimpan konfigurasi level');
  }

  res.redirect('/hcr-level');
};