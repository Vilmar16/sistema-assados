// db.js

// require('dotenv').config();
// const mysql = require('mysql2/promise');
// const fs = require('fs');
// const path = require('path');

// // Verifica se a variável de ambiente CA_CERT existe (Render)
// // Se existir, usa ela; se não, usa o arquivo local ca.pem
// const sslConfig = process.env.CA_CERT
//   ? { ca: process.env.CA_CERT, rejectUnauthorized: false }
//   : { ca: fs.readFileSync(path.join(__dirname, 'ca.pem')), rejectUnauthorized: false };

// const pool = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT,
//   ssl: sslConfig,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// module.exports = pool;

// Versão anterior sem SSL (local)

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'assados',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
