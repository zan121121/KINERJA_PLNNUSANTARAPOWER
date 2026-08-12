// middlewares/authMiddleware.js

// Cek: harus login dulu buat akses halaman ini
exports.isLoggedIn = (req, res, next) => {
  if (!req.session.user) {
    req.flash('error', 'Silakan login terlebih dahulu');
    return res.redirect('/login');
  }
  next();
};

// Cek: role harus salah satu dari yang diizinkan
// Contoh pakai: hanyaRole('admin')  atau  hanyaRole('admin', 'eksekutif')
exports.hanyaRole = (...rolesYangDiizinkan) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (!rolesYangDiizinkan.includes(req.session.user.role)) {
      req.flash('error', 'Kamu tidak punya akses ke halaman ini');
      return res.redirect('/dashboard');
    }
    next();
  };
};