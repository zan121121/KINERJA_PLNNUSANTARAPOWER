const db = require('../config/db');

exports.index = async (req, res) => {
  const [rows] = await db.query(
    `SELECT hcr_bobot.id, hcr_bobot.bobot_persen, hcr_items.id AS item_id, hcr_items.nama_item, hcr_items.tipe
     FROM hcr_bobot
     JOIN hcr_items ON hcr_items.id = hcr_bobot.hcr_item_id
     ORDER BY hcr_items.id ASC`
  );
  const totalBobot = rows.reduce((a, b) => a + parseFloat(b.bobot_persen), 0);
  res.render('hcr/bobot/index', { rows, totalBobot: totalBobot.toFixed(1) });
};

exports.update = async (req, res) => {
  const { bobot } = req.body; // bobot[item_id] = angka

  try {
    for (const itemId in bobot) {
      await db.query(
        'UPDATE hcr_bobot SET bobot_persen = ? WHERE hcr_item_id = ?',
        [parseFloat(bobot[itemId]) || 0, itemId]
      );
    }
    req.flash('success', 'Bobot berhasil disimpan');
  } catch (err) {
    console.error('ERROR UPDATE BOBOT:', err);
    req.flash('error', 'Gagal menyimpan bobot');
  }

  res.redirect('/hcr-bobot');
};