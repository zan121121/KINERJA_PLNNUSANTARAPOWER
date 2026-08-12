const bcrypt = require('bcrypt');
const db = require('../config/db');

// Tampilkan daftar user
exports.index = async (req, res) => {
  const [users] = await db.query(
    `SELECT users.id, users.nama, users.email, roles.nama_role 
     FROM users JOIN roles ON users.role_id = roles.id
     ORDER BY users.id DESC`
  );
  res.render('users/index', { users });
};

// Tampilkan form tambah user
exports.showTambah = async (req, res) => {
  const [roles] = await db.query('SELECT * FROM roles');
  res.render('users/tambah', { roles });
};

// Proses tambah user
exports.tambah = async (req, res) => {
  const { nama, email, password, role_id } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (nama, email, password, role_id) VALUES (?, ?, ?, ?)',
      [nama, email, hash, role_id]
    );
    req.flash('success', 'User berhasil ditambahkan');
    res.redirect('/kelola-user');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal menambahkan user (email mungkin sudah dipakai)');
    res.redirect('/kelola-user/tambah');
  }
};

// Hapus user
exports.hapus = async (req, res) => {
  await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  req.flash('success', 'User berhasil dihapus');
  res.redirect('/kelola-user');
};