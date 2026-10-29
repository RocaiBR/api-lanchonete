const AppError = require('../utils/AppError');

function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return next(new AppError(403, `O perfil ${req.usuario.perfil} não tem permissão para esta ação`));
    }
    return next();
  };
}

module.exports = autorizar;
