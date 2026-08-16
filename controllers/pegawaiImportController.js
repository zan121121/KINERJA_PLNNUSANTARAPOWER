const db = require('../config/db');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
exports.uploadMiddleware = upload.single('file_import');

exports.showImport = (req, res) => {
  res.render('pegawai/import');
};

// Kamus nama kolom (huruf kecil, tanpa spasi berlebih) -> kolom database
const SINONIM_FIELD = {
  'nip': 'nip',
  'nama': 'nama',
  'nama pegawai': 'nama',
  'jabatan': 'jabatan',
  'tempat lahir': 'tempat_lahir',
  'tempat_lahir': 'tempat_lahir',
  'tanggal lahir': 'tanggal_lahir',
  'tgl lahir': 'tanggal_lahir',
  'tanggal_lahir': 'tanggal_lahir',
  'jenis kelamin': 'jenis_kelamin',
  'jk': 'jenis_kelamin',
  'gender': 'jenis_kelamin'
};

exports.proses = async (req, res) => {
  if (!req.file) {
    req.flash('error', 'Silakan pilih file untuk diimport');
    return res.redirect('/pegawai/import');
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      req.flash('error', 'File kosong atau tidak terbaca');
      return res.redirect('/pegawai/import');
    }

    // Ambil daftar field custom yang sudah terdaftar di sistem
    const [customFields] = await db.query('SELECT * FROM pegawai_custom_fields');
    const customFieldMap = {};
    customFields.forEach(f => { customFieldMap[f.field_label.toLowerCase().trim()] = f; });

    // Deteksi mapping kolom dari header file
    const headerAsli = Object.keys(rows[0]);
    const mapping = {}; // header asli -> { tipe: 'base'|'custom', target: kolom/fieldId }

    headerAsli.forEach(h => {
      const key = h.toLowerCase().trim();
      if (SINONIM_FIELD[key]) {
        mapping[h] = { tipe: 'base', target: SINONIM_FIELD[key] };
      } else if (customFieldMap[key]) {
        mapping[h] = { tipe: 'custom', target: customFieldMap[key].id };
      }
      // kalau tidak cocok apapun, kolom itu diabaikan (tidak masuk mapping)
    });

    let berhasil = 0, dilewati = 0;

    for (const row of rows) {
      const dataBase = {};
      const dataCustom = {};

      Object.keys(row).forEach(h => {
        const map = mapping[h];
        if (!map) return; // kolom tidak dikenali, abaikan
        const nilai = String(row[h]).trim();
        if (nilai === '') return;

        if (map.tipe === 'base') {
          dataBase[map.target] = nilai;
        } else {
          dataCustom[map.target] = nilai;
        }
      });

      // NIP dan Nama wajib ada, kalau tidak lewati baris ini
      if (!dataBase.nip || !dataBase.nama) {
        dilewati++;
        continue;
      }

      // Normalisasi jenis kelamin (L/P, laki-laki/perempuan, dll -> L atau P)
      if (dataBase.jenis_kelamin) {
        const jk = dataBase.jenis_kelamin.toLowerCase();
        dataBase.jenis_kelamin = (jk.startsWith('l') || jk === 'm') ? 'L' : 'P';
      }

      try {
        const [existing] = await db.query('SELECT id FROM pegawai WHERE nip = ?', [dataBase.nip]);

        let pegawaiId;
        if (existing.length > 0) {
          pegawaiId = existing[0].id;
          const kolomUpdate = Object.keys(dataBase).filter(k => k !== 'nip');
          if (kolomUpdate.length > 0) {
            const setClause = kolomUpdate.map(k => `${k} = ?`).join(', ');
            await db.query(`UPDATE pegawai SET ${setClause} WHERE id = ?`, [...kolomUpdate.map(k => dataBase[k]), pegawaiId]);
          }
        } else {
          const kolom = Object.keys(dataBase);
          const placeholder = kolom.map(() => '?').join(', ');
          const [hasil] = await db.query(
            `INSERT INTO pegawai (${kolom.join(', ')}) VALUES (${placeholder})`,
            kolom.map(k => dataBase[k])
          );
          pegawaiId = hasil.insertId;
        }

        // Simpan field custom yang cocok
        for (const fieldId in dataCustom) {
          await db.query(
            `INSERT INTO pegawai_custom_values (pegawai_id, field_id, value) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value)`,
            [pegawaiId, fieldId, dataCustom[fieldId]]
          );
        }

        berhasil++;
      } catch (err) {
        console.error('ERROR IMPORT BARIS:', err);
        dilewati++;
      }
    }

    req.flash('success', `Import selesai: ${berhasil} data berhasil diproses, ${dilewati} baris dilewati (NIP/Nama kosong atau error)`);
    res.redirect('/pegawai');
  } catch (err) {
    console.error('ERROR IMPORT FILE:', err);
    req.flash('error', 'Gagal membaca file. Pastikan format Excel (.xlsx) atau CSV yang valid.');
    res.redirect('/pegawai/import');
  }
};