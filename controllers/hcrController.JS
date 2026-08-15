const db = require('../config/db');

// Menu utama HCR — daftar 8 item, link ke modul masing-masing
exports.menuHcr = (req, res) => {
  const daftarItem = [
    { kode: 'MLI_ASSESMEN', nama: 'MLI Assesmen Kompetensi', tipe: 'MLI', url: '/hcr-assesmen', aktif: true },
    { kode: 'MLI_IDENT_PPK', nama: 'MLI Identifikasi PPK', tipe: 'MLI', url: '/hcr-identifikasi', aktif: true },
    { kode: 'MLI_PELAKSANAAN_PPK', nama: 'MLI Pelaksanaan & Monitoring PPK', tipe: 'MLI', url: '/hcr-pelaksanaan', aktif: true },
    { kode: 'MLI_EVALUASI_PPK', nama: 'MLI Evaluasi PPK', tipe: 'MLI', url: '/hcr-evaluasi', aktif: true },
    { kode: 'MLI_AKSI', nama: 'MLI AKSI', tipe: 'MLI', url: '/hcr-aksi', aktif: true },
    { kode: 'KPI_PENUGASAN', nama: 'KPI Penugasan', tipe: 'KPI', url: '/hcr-penugasan', aktif: true },
    { kode: 'KPI_SERTIFIKASI', nama: 'KPI Sertifikasi Kompetensi', tipe: 'KPI', url: '/hcr-sertifikasi', aktif: true },
    { kode: 'KPI_HARI_ORANG', nama: 'KPI Jml Hari Orang Pengembangan', tipe: 'KPI', url: '/hcr-hari-pengembangan', aktif: true },
  ];

  res.render('hcr/menu', { daftarItem });
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

  const [pegawai] = await db.query('SELECT id, nama FROM pegawai ORDER BY nama ASC');
  const [realisasi] = await db.query(
    'SELECT pegawai_id, hcr_item_id, skor FROM hcr_realisasi WHERE periode_bulan = ? AND periode_tahun = ?',
    [bulan, tahun]
  );

  const skorMap = {};
  realisasi.forEach(r => {
    if (!skorMap[r.pegawai_id]) skorMap[r.pegawai_id] = {};
    skorMap[r.pegawai_id][r.hcr_item_id] = parseFloat(r.skor);
  });

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

    return { id: p.id, nama: p.nama, skorGabungan: totalSkor.toFixed(1), kategori };
  });

  res.json({ bulan, tahun, data: hasil });
};