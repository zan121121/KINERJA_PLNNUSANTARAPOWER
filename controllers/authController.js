const bcrypt = require('bcrypt');
const db = require('../config/db');

// Tampilkan halaman login
exports.showLogin = (req, res) => {
  res.render('auth/login');
};

// Proses login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT users.*, roles.nama_role 
       FROM users 
       JOIN roles ON users.role_id = roles.id 
       WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      req.flash('error', 'Email tidak ditemukan');
      return res.redirect('/login');
    }

    const user = rows[0];
    const cocok = await bcrypt.compare(password, user.password);

    if (!cocok) {
      req.flash('error', 'Password salah');
      return res.redirect('/login');
    }

    // Simpan data user ke session (tanpa password!)
    req.session.user = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.nama_role
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan server');
    res.redirect('/login');
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};