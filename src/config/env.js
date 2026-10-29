require('dotenv').config({ quiet: true });

const env = {
  porta: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lanchonete',
  },
  jwt: {
    segredo: process.env.JWT_SECRET,
    expiraEm: process.env.JWT_EXPIRES_IN || '15m',
  },
  refreshTokenDias: Number(process.env.REFRESH_TOKEN_DIAS) || 7,
};

if (!env.jwt.segredo) {
  throw new Error('Defina JWT_SECRET no arquivo .env (veja o .env.example)');
}

module.exports = env;
