const db = require('../config/db');
const AppError = require('../utils/AppError');
const { lerId, lerQuantidade } = require('../utils/validacao');

async function montarCarrinho(usuarioId) {
  const [linhas] = await db.execute(
    `SELECT ci.item_id AS itemId, ic.nome, ic.preco AS precoUnitario, ci.quantidade, ic.disponivel
       FROM carrinho_itens ci
       JOIN itens_cardapio ic ON ic.id = ci.item_id
      WHERE ci.usuario_id = ?
      ORDER BY ic.nome`,
    [usuarioId]
  );

  let totalCentavos = 0;
  const itens = linhas.map((linha) => {
    const subtotalCentavos = Math.round(linha.precoUnitario * 100) * linha.quantidade;
    totalCentavos += subtotalCentavos;
    return { ...linha, disponivel: Boolean(linha.disponivel), subtotal: subtotalCentavos / 100 };
  });

  return { itens, total: totalCentavos / 100 };
}

async function ver(req, res) {
  return res.json(await montarCarrinho(req.usuario.id));
}

async function adicionarItem(req, res) {
  const corpo = req.body || {};
  const itemId = lerId(corpo.itemId, 'itemId');
  const quantidade = corpo.quantidade === undefined ? 1 : lerQuantidade(corpo.quantidade);

  const [itens] = await db.execute('SELECT disponivel FROM itens_cardapio WHERE id = ?', [itemId]);
  if (!itens[0]) {
    throw new AppError(404, 'Item do cardápio não encontrado');
  }
  if (!itens[0].disponivel) {
    throw new AppError(409, 'Este item está indisponível no momento');
  }

  await db.execute(
    `INSERT INTO carrinho_itens (usuario_id, item_id, quantidade) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantidade = quantidade + ?`,
    [req.usuario.id, itemId, quantidade, quantidade]
  );

  return res.status(201).json(await montarCarrinho(req.usuario.id));
}

async function alterarQuantidade(req, res) {
  const itemId = lerId(req.params.itemId, 'itemId');
  const quantidade = lerQuantidade((req.body || {}).quantidade);

  const [resultado] = await db.execute(
    'UPDATE carrinho_itens SET quantidade = ? WHERE usuario_id = ? AND item_id = ?',
    [quantidade, req.usuario.id, itemId]
  );
  if (resultado.affectedRows === 0) {
    throw new AppError(404, 'Este item não está no seu carrinho');
  }
  return res.json(await montarCarrinho(req.usuario.id));
}

async function removerItem(req, res) {
  const itemId = lerId(req.params.itemId, 'itemId');
  const [resultado] = await db.execute(
    'DELETE FROM carrinho_itens WHERE usuario_id = ? AND item_id = ?',
    [req.usuario.id, itemId]
  );
  if (resultado.affectedRows === 0) {
    throw new AppError(404, 'Este item não está no seu carrinho');
  }
  return res.json(await montarCarrinho(req.usuario.id));
}

async function esvaziar(req, res) {
  await db.execute('DELETE FROM carrinho_itens WHERE usuario_id = ?', [req.usuario.id]);
  return res.status(204).end();
}

module.exports = { ver, adicionarItem, alterarQuantidade, removerItem, esvaziar };
