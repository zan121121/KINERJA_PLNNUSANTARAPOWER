// 1. Semua require
const express = require('express');
const path = require('path');
const db = require('./config/db');
const session = require('express-session');
const flash = require('connect-flash');
const { isLoggedIn } = require('./middlewares/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const pegawaiRoutes = require('./routes/pegawaiRoutes');
const hcrRoutes = require('./routes/hcrRoutes');
const customFieldRoutes = require('./routes/customFieldRoutes');
const hcrAssesmenRoutes = require('./routes/hcrAssesmenRoutes');
const hcrIdentifikasiRoutes = require('./routes/hcrIdentifikasiRoutes');
const hcrPelaksanaanRoutes = require('./routes/hcrPelaksanaanRoutes');
const hcrEvaluasiRoutes = require('./routes/hcrEvaluasiRoutes');
const hcrAksiRoutes = require('./routes/hcrAksiRoutes');
const hcrPenugasanRoutes = require('./routes/hcrPenugasanRoutes');
const hcrSertifikasiRoutes = require('./routes/hcrSertifikasiRoutes');
const hcrHariPengembanganRoutes = require('./routes/hcrHariPengembanganRoutes');


const app = express();
const PORT = 3000;

// 2. View engine & static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// 3. Body parser
app.use(express.urlencoded({ extended: true }));

// 4. SESSION — harus di sini, sebelum semua routes
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));
app.use(flash());

// 5. Middleware global
app.use((req, res, next) => {
  // MODE TESTING: auto-login sebagai admin, biar gak perlu login manual
  if (!req.session.user) {
    req.session.user = {
      id: 1,
      nama: 'Admin Utama',
      email: 'admin@ekinerjahc.com',
      role: 'admin'
    };
  }

  res.locals.user = req.session.user || null;
  res.locals.successMsg = req.flash('success');
  res.locals.errorMsg = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// 6. BARU semua routes didaftarkan di sini
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', pegawaiRoutes);
app.use('/', hcrRoutes);
app.use('/', customFieldRoutes);
app.use('/', hcrAssesmenRoutes);
app.use('/', hcrIdentifikasiRoutes);
app.use('/', hcrPelaksanaanRoutes);
app.use('/', hcrEvaluasiRoutes);
app.use('/', hcrAksiRoutes);
app.use('/', hcrPenugasanRoutes);
app.use('/', hcrSertifikasiRoutes);
app.use('/', hcrHariPengembanganRoutes);


app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/dashboard', isLoggedIn, (req, res) => {
  res.render('dashboard');
});

app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM hcr_items');
    res.json(rows);
  } catch (err) {
    res.status(500).send('Gagal konek database: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});