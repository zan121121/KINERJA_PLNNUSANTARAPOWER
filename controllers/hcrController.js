const db = require('../config/db');

// Menu utama HCR — daftar 8 item, link ke modul masing-masing
exports.menuHcr = (req, res) => {
  res.redirect('/hcr-input-gabungan');
};

// Halaman pilih pegawai untuk input HCR (form generik lama)
exports.pilihPegawai = async (req, res) => {
  const [pegawai] = await db.query('SELECT * FROM pegawai ORDER BY nama ASC');
  res.render('hcr/pilih-pegawai', { pegawai });
};

// Form input 8 item HCR untuk 1 pegawai (form generik lama)
exports.showInput = async (req, res) => {
  const pegawaiId = req.params.pegawaiId;
  const bulan = req.query.bulan || new Date().getMonth() + 1;
  const tahun = req.query.tahun || new Date().getFullYear();

  const [pegawaiRows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [pegawaiId]);
  if (pegawaiRows.length === 0) {
    req.flash('error', 'Pegawai tidak ditemukan');
    return res.redirect('/hcr-realisasi');
  }

  const [items] = await db.query(
    `SELECT hcr_items.id AS item_id, hcr_items.kode, hcr_items.nama_item, hcr_items.tipe,
            hcr_realisasi.target, hcr_realisasi.capaian, hcr_realisasi.skor, hcr_realisasi.keterangan
     FROM hcr_items
     LEFT JOIN hcr_realisasi 
       ON hcr_realisasi.hcr_item_id = hcr_items.id 
       AND hcr_realisasi.pegawai_id = ?
       AND hcr_realisasi.periode_bulan = ?
       AND hcr_realisasi.periode_tahun = ?
     ORDER BY hcr_items.id ASC`,
    [pegawaiId, bulan, tahun]
  );

  res.render('hcr/input', {
    pegawai: pegawaiRows[0],
    items,
    bulan: parseInt(bulan),
    tahun: parseInt(tahun)
  });
};

// Proses simpan 8 item sekaligus (form generik lama)
exports.simpanInput = async (req, res) => {
  const pegawaiId = req.params.pegawaiId;
  const { bulan, tahun, item_id, target, capaian, keterangan } = req.body;

  const daftarItemId = Array.isArray(item_id) ? item_id : [item_id];
  const daftarTarget = Array.isArray(target) ? target : [target];
  const daftarCapaian = Array.isArray(capaian) ? capaian : [capaian];
  const daftarKeterangan = Array.isArray(keterangan) ? keterangan : [keterangan];

  try {
    for (let i = 0; i < daftarItemId.length; i++) {
      const itemId = daftarItemId[i];
      const t = parseFloat(daftarTarget[i]) || 0;
      const c = parseFloat(daftarCapaian[i]) || 0;
      const skor = t > 0 ? (c / t) * 100 : 0;
      const ket = daftarKeterangan[i] || null;

      await db.query(
        `INSERT INTO hcr_realisasi 
          (pegawai_id, hcr_item_id, periode_bulan, periode_tahun, target, capaian, skor, keterangan, input_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
          target = VALUES(target), 
          capaian = VALUES(capaian), 
          skor = VALUES(skor),
          keterangan = VALUES(keterangan),
          input_by = VALUES(input_by)`,
        [pegawaiId, itemId, bulan, tahun, t, c, skor.toFixed(2), ket, req.session.user.id]
      );
    }

    req.flash('success', 'Data HCR berhasil disimpan');
    res.redirect(`/hcr-realisasi/input/${pegawaiId}?bulan=${bulan}&tahun=${tahun}`);
  } catch (err) {
    console.error('ERROR SIMPAN HCR:', err);
    req.flash('error', 'Gagal menyimpan data HCR');
    res.redirect(`/hcr-realisasi/input/${pegawaiId}`);
  }
};

// Skor HCR gabungan (berbobot) per pegawai, untuk 1 periode
exports.skorGabunganJson = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [bobotRows] = await db.query('SELECT hcr_item_id, bobot_persen FROM hcr_bobot');
  const bobotMap = {};
  bobotRows.forEach(b => { bobotMap[b.hcr_item_id] = parseFloat(b.bobot_persen); });

  const [levelRows] = await db.query('SELECT * FROM hcr_level_config ORDER BY urutan ASC');

const [pegawai] = await db.query('SELECT id, nip, nama FROM pegawai ORDER BY nama ASC');
const [realisasi] = await db.query(
    'SELECT pegawai_id, hcr_item_id, skor FROM hcr_realisasi WHERE periode_bulan = ? AND periode_tahun = ?',
    [bulan, tahun]
  );

  const skorMap = {};
  realisasi.forEach(r => {
    if (!skorMap[r.pegawai_id]) skorMap[r.pegawai_id] = {};
    skorMap[r.pegawai_id][r.hcr_item_id] = parseFloat(r.skor);
  });

  function cariLevel(skor) {
    const match = levelRows.find(l => skor >= parseFloat(l.min_skor) && skor <= parseFloat(l.max_skor));
    return match ? match.level_label : '-';
  }

  const hasil = pegawai.map(p => {
    const skorItem = skorMap[p.id] || {};
    let totalSkor = 0;
    Object.keys(bobotMap).forEach(itemId => {
      const skor = skorItem[itemId] !== undefined ? skorItem[itemId] : 0;
      totalSkor += (skor * bobotMap[itemId] / 100);
    });

    let kategori = 'Rendah';
    if (totalSkor >= 85) kategori = 'Tinggi';
    else if (totalSkor >= 60) kategori = 'Sedang';

return {
  id: p.id,
  nip: p.nip,
  nama: p.nama,
  skorGabungan: totalSkor.toFixed(1),
  kategori,
  level: cariLevel(totalSkor)
};
  });

  res.json({ bulan, tahun, data: hasil });
};

// Tren skor HCR rata-rata per bulan, sepanjang 1 tahun (untuk grafik garis di dashboard)
exports.trenTahunanJson = async (req, res) => {
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [bobotRows] = await db.query('SELECT hcr_item_id, bobot_persen FROM hcr_bobot');
  const bobotMap = {};
  bobotRows.forEach(b => { bobotMap[b.hcr_item_id] = parseFloat(b.bobot_persen); });

  const [realisasi] = await db.query(
    'SELECT pegawai_id, hcr_item_id, periode_bulan, skor FROM hcr_realisasi WHERE periode_tahun = ?',
    [tahun]
  );

  const map = {};
  realisasi.forEach(r => {
    if (!map[r.periode_bulan]) map[r.periode_bulan] = {};
    if (!map[r.periode_bulan][r.pegawai_id]) map[r.periode_bulan][r.pegawai_id] = {};
    map[r.periode_bulan][r.pegawai_id][r.hcr_item_id] = parseFloat(r.skor);
  });

  const dataTren = [];
  for (let b = 1; b <= 12; b++) {
    const pegawaiBulan = map[b] || {};
    const idPegawaiTerisi = Object.keys(pegawaiBulan);
    if (idPegawaiTerisi.length === 0) { dataTren.push(0); continue; }

    let totalSkorBulan = 0;
    idPegawaiTerisi.forEach(pid => {
      const skorItem = pegawaiBulan[pid];
      let totalSkor = 0;
      Object.keys(bobotMap).forEach(itemId => {
        const skor = skorItem[itemId] !== undefined ? skorItem[itemId] : 0;
        totalSkor += (skor * bobotMap[itemId] / 100);
      });
      totalSkorBulan += totalSkor;
    });
    dataTren.push(parseFloat((totalSkorBulan / idPegawaiTerisi.length).toFixed(1)));
  }

  res.json({ tahun, dataTren });
};
// Detail status pengisian 8 item HCR untuk 1 pegawai di 1 periode
exports.detailItemJson = async (req, res) => {
  const pegawaiId = req.params.pegawaiId;
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [items] = await db.query(
    `SELECT hcr_items.kode, hcr_items.nama_item, hcr_items.tipe,
            hcr_realisasi.skor, hcr_realisasi.updated_at
     FROM hcr_items
     LEFT JOIN hcr_realisasi 
       ON hcr_realisasi.hcr_item_id = hcr_items.id 
       AND hcr_realisasi.pegawai_id = ?
       AND hcr_realisasi.periode_bulan = ?
       AND hcr_realisasi.periode_tahun = ?
     ORDER BY hcr_items.id ASC`,
    [pegawaiId, bulan, tahun]
  );

  const hasil = items.map(it => ({
    kode: it.kode,
    nama_item: it.nama_item,
    tipe: it.tipe,
    terisi: it.skor !== null,
    skor: it.skor !== null ? parseFloat(it.skor).toFixed(1) : null,
    tanggalUpdate: it.updated_at
  }));

  res.json({ bulan, tahun, items: hasil });
};
// Halaman Detail Pegawai (dikelompokkan per level)
exports.detailPegawaiIndex = (req, res) => {
  res.render('hcr/detail-pegawai/index');
};

// Profil lengkap 1 pegawai (read-only): data diri + skor gabungan + level + breakdown 8 item
exports.profilLengkapJson = async (req, res) => {
  const pegawaiId = req.params.pegawaiId;
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [pegawaiRows] = await db.query('SELECT * FROM pegawai WHERE id = ?', [pegawaiId]);
  if (pegawaiRows.length === 0) {
    return res.status(404).json({ error: 'Pegawai tidak ditemukan' });
  }
  const pegawai = pegawaiRows[0];

  const [bobotRows] = await db.query('SELECT hcr_item_id, bobot_persen FROM hcr_bobot');
  const bobotMap = {};
  bobotRows.forEach(b => { bobotMap[b.hcr_item_id] = parseFloat(b.bobot_persen); });

  const [levelRows] = await db.query('SELECT * FROM hcr_level_config ORDER BY urutan ASC');
  function cariLevel(skor) {
    const match = levelRows.find(l => skor >= parseFloat(l.min_skor) && skor <= parseFloat(l.max_skor));
    return match ? match.level_label : '-';
  }

  const [items] = await db.query(
    `SELECT hcr_items.id AS item_id, hcr_items.kode, hcr_items.nama_item, hcr_items.tipe,
            hcr_realisasi.skor, hcr_realisasi.updated_at
     FROM hcr_items
     LEFT JOIN hcr_realisasi 
       ON hcr_realisasi.hcr_item_id = hcr_items.id 
       AND hcr_realisasi.pegawai_id = ?
       AND hcr_realisasi.periode_bulan = ?
       AND hcr_realisasi.periode_tahun = ?
     ORDER BY hcr_items.id ASC`,
    [pegawaiId, bulan, tahun]
  );

  let totalSkor = 0;
  const itemHasil = items.map(it => {
    const skor = it.skor !== null ? parseFloat(it.skor) : 0;
    const bobot = bobotMap[it.item_id] || 0;
    totalSkor += (skor * bobot / 100);
    return {
      nama_item: it.nama_item,
      tipe: it.tipe,
      terisi: it.skor !== null,
      skor: it.skor !== null ? skor.toFixed(1) : null,
      bobot: bobot,
      tanggalUpdate: it.updated_at
    };
  });

  let kategori = 'Rendah';
  if (totalSkor >= 85) kategori = 'Tinggi';
  else if (totalSkor >= 60) kategori = 'Sedang';

  res.json({
    pegawai: {
      nip: pegawai.nip,
      nama: pegawai.nama,
      jabatan: pegawai.jabatan,
      jenis_kelamin: pegawai.jenis_kelamin,
      tempat_lahir: pegawai.tempat_lahir,
      tanggal_lahir: pegawai.tanggal_lahir
    },
    bulan, tahun,
    skorGabungan: totalSkor.toFixed(1),
    level: cariLevel(totalSkor),
    kategori,
    items: itemHasil
  });
};