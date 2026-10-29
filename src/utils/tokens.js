const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function gerarAccessToken(usuario) {
  return jwt.sign({ id: usuario.id, perfil: usuario.perfil }, env.jwt.segredo, {
    expiresIn: env.jwt.expiraEm,
  });
}

function verificarAccessToken(token) {
  return jwt.verify(token, env.jwt.segredo);
}

function gerarRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { gerarAccessToken, verificarAccessToken, gerarRefreshToken, hashToken };
