const db = require('../config/db');

// Dashboard Terpadu HCR — menggabungkan 8 modul (5 MLI + 3 KPI) jadi 1 halaman
// Data, filter periode, dan aksi tambah/ubah-status/hapus semuanya jalan dari sini,
// sedangkan endpoint tambah/edit/hapus tetap memakai controller modul masing-masing
// (supaya logika sinkronisasi skor ke hcr_realisasi yang sudah ada tidak perlu diduplikasi).
exports.index = async (req, res) => {
  const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1;
  const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

  const [
    totalPegawaiRes,
    pegawaiRes,
    assesmenRes,
    identifikasiRes,
    pelaksanaanRes,
    evaluasiRes,
    aksiRes,
    penugasanRes,
    sertifikasiRes,
    pelatihanRes,
    trenRes,
    totalPerPegawaiHariRes,
    rekapItemsRes
  ] = await Promise.all([
    db.query('SELECT COUNT(*) AS total FROM pegawai'),
    db.query('SELECT id, nama, nip FROM pegawai ORDER BY nama ASC'),
    db.query(
      `SELECT hcr_assesmen_kompetensi.*, pegawai.nama, pegawai.nip
       FROM hcr_assesmen_kompetensi
       JOIN pegawai ON pegawai.id = hcr_assesmen_kompetensi.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_identifikasi_ppk.*, pegawai.nama, pegawai.nip
       FROM hcr_identifikasi_ppk
       JOIN pegawai ON pegawai.id = hcr_identifikasi_ppk.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_pelaksanaan_ppk.*, pegawai.nama, pegawai.nip
       FROM hcr_pelaksanaan_ppk
       JOIN pegawai ON pegawai.id = hcr_pelaksanaan_ppk.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_evaluasi_ppk.*, pegawai.nama, pegawai.nip
       FROM hcr_evaluasi_ppk
       JOIN pegawai ON pegawai.id = hcr_evaluasi_ppk.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_aksi.*, pegawai.nama AS nama_pic
       FROM hcr_aksi
       LEFT JOIN pegawai ON pegawai.id = hcr_aksi.pic_pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY hcr_aksi.id DESC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_penugasan.*, pegawai.nama, pegawai.nip
       FROM hcr_penugasan
       JOIN pegawai ON pegawai.id = hcr_penugasan.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_sertifikasi.*, pegawai.nama, pegawai.nip
       FROM hcr_sertifikasi
       JOIN pegawai ON pegawai.id = hcr_sertifikasi.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT hcr_hari_pengembangan.*, pegawai.nama, pegawai.nip
       FROM hcr_hari_pengembangan
       JOIN pegawai ON pegawai.id = hcr_hari_pengembangan.pegawai_id
       WHERE periode_bulan = ? AND periode_tahun = ?
       ORDER BY pegawai.nama ASC`, [bulan, tahun]),
    db.query(
      `SELECT periode_bulan, SUM(jumlah_hari) AS total_hari
       FROM hcr_hari_pengembangan WHERE periode_tahun = ? GROUP BY periode_bulan`, [tahun]),
    db.query(
      `SELECT pegawai.id, pegawai.nama, COALESCE(SUM(hcr_hari_pengembangan.jumlah_hari), 0) AS total_hari
       FROM pegawai
       LEFT JOIN hcr_hari_pengembangan
         ON hcr_hari_pengembangan.pegawai_id = pegawai.id
         AND hcr_hari_pengembangan.periode_tahun = ?
       GROUP BY pegawai.id, pegawai.nama
       ORDER BY pegawai.nama ASC`, [tahun]),
    db.query(
      `SELECT hcr_items.id, hcr_items.kode, hcr_items.nama_item, hcr_items.tipe,
              AVG(hcr_realisasi.skor) AS rata_skor
       FROM hcr_items
       LEFT JOIN hcr_realisasi
         ON hcr_realisasi.hcr_item_id = hcr_items.id
         AND hcr_realisasi.periode_bulan = ?
         AND hcr_realisasi.periode_tahun = ?
       GROUP BY hcr_items.id
       ORDER BY hcr_items.id ASC`, [bulan, tahun])
  ]);

  const totalPegawai = totalPegawaiRes[0][0].total;
  const pegawai = pegawaiRes[0];

  const dataAssesmen = assesmenRes[0];
  const dataIdentifikasi = identifikasiRes[0];
  const dataPelaksanaan = pelaksanaanRes[0];
  const dataEvaluasi = evaluasiRes[0];
  const dataAksi = aksiRes[0];
  const dataPenugasan = penugasanRes[0];
  const dataSertifikasi = sertifikasiRes[0];
  const dataPelatihan = pelatihanRes[0];
  const trenBulanan = trenRes[0];
  const totalPerPegawaiHari = totalPerPegawaiHariRes[0];
  const rekapItems = rekapItemsRes[0];

  // ---- Ringkasan tiap modul (dipakai untuk mini stat & progress bar per tab) ----
  const jumlahSelesaiAssesmen = dataAssesmen.filter(d => d.status === 'Selesai').length;
  const persentaseAssesmen = totalPegawai > 0 ? (jumlahSelesaiAssesmen / totalPegawai) * 100 : 0;

  const jumlahDisetujuiIdentifikasi = dataIdentifikasi.filter(d => d.status === 'Disetujui').length;
  const persentaseIdentifikasi = totalPegawai > 0 ? (dataIdentifikasi.length / totalPegawai) * 100 : 0;

  const jumlahSelesaiPelaksanaan = dataPelaksanaan.filter(d => d.status === 'Selesai').length;
  const jumlahTerlambatPelaksanaan = dataPelaksanaan.filter(d => d.status === 'Terlambat').length;
  const persentasePelaksanaan = totalPegawai > 0 ? (jumlahSelesaiPelaksanaan / totalPegawai) * 100 : 0;

  const rataSkorEvaluasi = dataEvaluasi.length > 0
    ? dataEvaluasi.reduce((a, b) => a + parseFloat(b.skor_evaluasi), 0) / dataEvaluasi.length
    : 0;

  const kolomBelum = dataAksi.filter(a => a.status === 'Belum');
  const kolomProses = dataAksi.filter(a => a.status === 'Proses');
  const kolomSelesai = dataAksi.filter(a => a.status === 'Selesai');
  const persentaseAksi = dataAksi.length > 0 ? (kolomSelesai.length / dataAksi.length) * 100 : 0;

  const dataPenugasanPersen = dataPenugasan.map(d => ({
    ...d,
    persen: d.target > 0 ? ((d.realisasi / d.target) * 100).toFixed(1) : 0
  }));
  const rataPersenPenugasan = dataPenugasanPersen.length > 0
    ? dataPenugasanPersen.reduce((a, b) => a + parseFloat(b.persen), 0) / dataPenugasanPersen.length
    : 0;

  const hariIni = new Date();
  const dataSertifikasiStatus = dataSertifikasi.map(d => {
    let statusMasaBerlaku = 'Tanpa batas';
    if (d.masa_berlaku) {
      const tanggalExpired = new Date(d.masa_berlaku);
      statusMasaBerlaku = tanggalExpired < hariIni ? 'Kadaluarsa' : 'Aktif';
    }
    return { ...d, statusMasaBerlaku };
  });
  const pegawaiUnikTersertifikasi = new Set(dataSertifikasi.map(d => d.pegawai_id)).size;
  const persentaseSertifikasi = totalPegawai > 0 ? (pegawaiUnikTersertifikasi / totalPegawai) * 100 : 0;

  const totalHariBulanIni = dataPelatihan.reduce((a, b) => a + parseFloat(b.jumlah_hari), 0);
  const trenMap = {};
  trenBulanan.forEach(t => { trenMap[t.periode_bulan] = parseFloat(t.total_hari); });
  const dataTren = [];
  for (let b = 1; b <= 12; b++) dataTren.push(trenMap[b] || 0);

  // ---- Skor gabungan per item (dari hcr_realisasi, sudah disinkron otomatis oleh tiap modul) ----
  const skorPerKode = {};
  rekapItems.forEach(r => { skorPerKode[r.kode] = r.rata_skor !== null ? parseFloat(r.rata_skor) : 0; });
  const skorKeseluruhan = rekapItems.length > 0
    ? rekapItems.reduce((a, b) => a + (b.rata_skor !== null ? parseFloat(b.rata_skor) : 0), 0) / rekapItems.length
    : 0;

  const kembali = `/hcr-dashboard?bulan=${bulan}&tahun=${tahun}`;

  res.render('hcr/dashboard-terpadu', {
    bulan, tahun, kembali,
    totalPegawai, pegawai,
    skorKeseluruhan: skorKeseluruhan.toFixed(1),
    skorPerKode,

    dataAssesmen, jumlahSelesaiAssesmen, persentaseAssesmen: persentaseAssesmen.toFixed(1),
    dataIdentifikasi, jumlahDisetujuiIdentifikasi, persentaseIdentifikasi: persentaseIdentifikasi.toFixed(1),
    dataPelaksanaan, jumlahSelesaiPelaksanaan, jumlahTerlambatPelaksanaan, persentasePelaksanaan: persentasePelaksanaan.toFixed(1),
    dataEvaluasi, rataSkorEvaluasi: rataSkorEvaluasi.toFixed(1),
    kolomBelum, kolomProses, kolomSelesai, totalAksi: dataAksi.length, persentaseAksi: persentaseAksi.toFixed(1),
    dataPenugasan: dataPenugasanPersen, rataPersenPenugasan: rataPersenPenugasan.toFixed(1),
    dataSertifikasi: dataSertifikasiStatus, pegawaiUnikTersertifikasi, persentaseSertifikasi: persentaseSertifikasi.toFixed(1),
    dataPelatihan, totalHariBulanIni, dataTren, totalPerPegawaiHari
  });
};
