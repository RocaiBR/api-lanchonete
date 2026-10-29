const AppError = require('../utils/AppError');

function tratarErros(erro, req, res, next) {
  if (erro instanceof AppError) {
    return res.status(erro.status).json({ erro: erro.message });
  }

  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }

  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Registro já existe' });
  }

  console.error(erro);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}

module.exports = tratarErros;
