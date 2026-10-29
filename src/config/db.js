const mysql = require('mysql2/promise');
const env = require('./env');

const db = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, 
});

module.exports = db;
