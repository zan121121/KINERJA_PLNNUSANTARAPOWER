const bcrypt = require('bcrypt');

const passwordAsli = 'admin123'; // ganti sesuai mau kamu

bcrypt.hash(passwordAsli, 10, (err, hash) => {
  if (err) throw err;
  console.log('Password asli :', passwordAsli);
  console.log('Hasil hash    :', hash);
});