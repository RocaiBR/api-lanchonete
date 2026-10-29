const db = require('../config/db');
const AppError = require('../utils/AppError');
const { lerId } = require('../utils/validacao');

async function verificarAcessoAoPedido(req, res, next) {
  const pedidoId = lerId(req.params.id, 'id do pedido');

  const [linhas] = await db.execute(
    'SELECT id, cliente_id, motoboy_id, status FROM pedidos WHERE id = ?',
    [pedidoId]
  );
  const pedido = linhas[0];
  if (!pedido) {
    throw new AppError(404, 'Pedido não encontrado');
  }

  const { id: usuarioId, perfil } = req.usuario;
  const temAcesso =
    perfil === 'GERENTE' ||
    (perfil === 'CLIENTE' && pedido.cliente_id === usuarioId) ||
    (perfil === 'MOTOBOY' && pedido.motoboy_id === usuarioId);

  if (!temAcesso) {
    throw new AppError(403, 'Este pedido não pertence a você');
  }

  req.pedido = pedido;
  return next();
}

module.exports = verificarAcessoAoPedido;
