const bcrypt = require('bcrypt');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { gerarAccessToken, gerarRefreshToken, hashToken } = require('../utils/tokens');
const { lerTexto, lerEmail, lerSenha } = require('../utils/validacao');

const RODADAS_BCRYPT = 10;

async function criarRefreshToken(usuarioId) {
  const token = gerarRefreshToken();
  await db.execute(
    'INSERT INTO refresh_tokens (usuario_id, token_hash, expira_em) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [usuarioId, hashToken(token), env.refreshTokenDias]
  );
  return token;
}

function respostaDeSessao(usuario, refreshToken) {
  return {
    accessToken: gerarAccessToken(usuario),
    refreshToken,
    expiraEm: env.jwt.expiraEm,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  };
}

async function cadastrar(req, res) {
  const corpo = req.body || {};
  const nome = lerTexto(corpo.nome, 'nome', { max: 100 });
  const email = lerEmail(corpo.email);
  const senha = lerSenha(corpo.senha);

  const [existentes] = await db.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existentes.length > 0) {
    throw new AppError(409, 'Este e-mail já está cadastrado');
  }

  const senhaHash = await bcrypt.hash(senha, RODADAS_BCRYPT);
  const [resultado] = await db.execute(
    'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
    [nome, email, senhaHash, 'CLIENTE']
  );

  return res.status(201).json({ id: resultado.insertId, nome, email, perfil: 'CLIENTE' });
}

async function login(req, res) {
  const { email, senha } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
    throw new AppError(400, 'Informe email e senha');
  }

  const [linhas] = await db.execute(
    'SELECT id, nome, email, senha_hash, perfil FROM usuarios WHERE email = ?',
    [email.trim().toLowerCase()]
  );
  const usuario = linhas[0];

  const senhaConfere = usuario ? await bcrypt.compare(senha, usuario.senha_hash) : false;
  if (!senhaConfere) {
    throw new AppError(401, 'E-mail ou senha inválidos');
  }

  const refreshToken = await criarRefreshToken(usuario.id);
  return res.json(respostaDeSessao(usuario, refreshToken));
}

async function renovar(req, res) {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new AppError(401, 'Refresh token ausente');
  }

  const [linhas] = await db.execute(
    `SELECT rt.id AS tokenId, u.id, u.nome, u.email, u.perfil
       FROM refresh_tokens rt
       JOIN usuarios u ON u.id = rt.usuario_id
      WHERE rt.token_hash = ? AND rt.revogado = 0 AND rt.expira_em > NOW()`,
    [hashToken(refreshToken)]
  );
  const registro = linhas[0];
  if (!registro) {
    throw new AppError(401, 'Refresh token inválido, expirado ou já utilizado');
  }

  const [revogacao] = await db.execute(
    'UPDATE refresh_tokens SET revogado = 1 WHERE id = ? AND revogado = 0',
    [registro.tokenId]
  );
  if (revogacao.affectedRows !== 1) {
    throw new AppError(401, 'Refresh token inválido, expirado ou já utilizado');
  }

  const novoRefreshToken = await criarRefreshToken(registro.id);
  return res.json(respostaDeSessao(registro, novoRefreshToken));
}

async function logout(req, res) {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken === 'string' && refreshToken) {
    await db.execute('UPDATE refresh_tokens SET revogado = 1 WHERE token_hash = ?', [hashToken(refreshToken)]);
  }
  return res.status(204).end();
}

async function me(req, res) {
  const [linhas] = await db.execute(
    'SELECT id, nome, email, perfil, criado_em AS criadoEm FROM usuarios WHERE id = ?',
    [req.usuario.id]
  );
  if (!linhas[0]) {
    throw new AppError(401, 'Usuário do token não existe mais');
  }
  return res.json(linhas[0]);
}

module.exports = { cadastrar, login, renovar, logout, me };
