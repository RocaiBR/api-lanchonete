const AppError = require('../utils/AppError');
const { verificarAccessToken } = require('../utils/tokens');

function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');

  if (tipo !== 'Bearer' || !token) {
    return next(new AppError(401, 'Token ausente. Envie o header Authorization: Bearer <token>'));
  }

  try {
    const payload = verificarAccessToken(token);
    req.usuario = { id: payload.id, perfil: payload.perfil };
    return next();
  } catch (erro) {
    const mensagem =
      erro.name === 'TokenExpiredError'
        ? 'Token expirado. Use POST /auth/refresh para renovar o acesso'
        : 'Token inválido';
    return next(new AppError(401, mensagem));
  }
}

module.exports = autenticar;
