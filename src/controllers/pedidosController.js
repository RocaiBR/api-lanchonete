const db = require('../config/db');
const AppError = require('../utils/AppError');
const { lerTexto } = require('../utils/validacao');

const STATUS_VALIDOS = ['PAGO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO', 'ESTORNADO'];
const METODOS_PAGAMENTO = ['PIX', 'CARTAO'];

const CAMPOS_PEDIDO = `p.id, p.cliente_id AS clienteId, p.motoboy_id AS motoboyId, p.status,
  p.total, p.endereco_entrega AS enderecoEntrega, p.criado_em AS criadoEm, p.atualizado_em AS atualizadoEm`;

async function buscarPedidoCompleto(pedidoId) {
  const [pedidos] = await db.execute(`SELECT ${CAMPOS_PEDIDO} FROM pedidos p WHERE p.id = ?`, [pedidoId]);
  const [itens] = await db.execute(
    `SELECT item_id AS itemId, nome_item AS nome, preco_unitario AS precoUnitario, quantidade
       FROM pedido_itens WHERE pedido_id = ? ORDER BY id`,
    [pedidoId]
  );
  const [pagamentos] = await db.execute(
    'SELECT metodo, valor, status FROM pagamentos WHERE pedido_id = ?',
    [pedidoId]
  );
  return { ...pedidos[0], itens, pagamento: pagamentos[0] || null };
}

async function finalizarCompra(req, res) {
  const corpo = req.body || {};
  const enderecoEntrega = lerTexto(corpo.enderecoEntrega, 'enderecoEntrega');
  const metodo = String(corpo.formaPagamento || '').toUpperCase();
  if (!METODOS_PAGAMENTO.includes(metodo)) {
    throw new AppError(400, `formaPagamento deve ser ${METODOS_PAGAMENTO.join(' ou ')}`);
  }

  const conexao = await db.getConnection();
  try {
    await conexao.beginTransaction();

    const [carrinho] = await conexao.execute(
      `SELECT ci.item_id AS itemId, ci.quantidade, ic.nome, ic.preco, ic.disponivel
         FROM carrinho_itens ci
         JOIN itens_cardapio ic ON ic.id = ci.item_id
        WHERE ci.usuario_id = ?
        FOR UPDATE`,
      [req.usuario.id]
    );

    if (carrinho.length === 0) {
      throw new AppError(409, 'Seu carrinho está vazio');
    }
    const indisponiveis = carrinho.filter((item) => !item.disponivel).map((item) => item.nome);
    if (indisponiveis.length > 0) {
      throw new AppError(409, `Remova do carrinho os itens indisponíveis: ${indisponiveis.join(', ')}`);
    }

    const totalCentavos = carrinho.reduce(
      (soma, item) => soma + Math.round(item.preco * 100) * item.quantidade,
      0
    );
    const total = totalCentavos / 100;

    const [novoPedido] = await conexao.execute(
      'INSERT INTO pedidos (cliente_id, status, total, endereco_entrega) VALUES (?, ?, ?, ?)',
      [req.usuario.id, 'PAGO', total, enderecoEntrega]
    );
    const pedidoId = novoPedido.insertId;

    for (const item of carrinho) {
      await conexao.execute(
        'INSERT INTO pedido_itens (pedido_id, item_id, nome_item, preco_unitario, quantidade) VALUES (?, ?, ?, ?, ?)',
        [pedidoId, item.itemId, item.nome, item.preco, item.quantidade]
      );
    }

    await conexao.execute(
      'INSERT INTO pagamentos (pedido_id, metodo, valor, status) VALUES (?, ?, ?, ?)',
      [pedidoId, metodo, total, 'APROVADO']
    );
    await conexao.execute('DELETE FROM carrinho_itens WHERE usuario_id = ?', [req.usuario.id]);

    await conexao.commit();
    return res.status(201).json(await buscarPedidoCompleto(pedidoId));
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

async function listar(req, res) {
  const condicoes = [];
  const valores = [];

  if (req.usuario.perfil === 'CLIENTE') {
    condicoes.push('p.cliente_id = ?');
    valores.push(req.usuario.id);
  }

  if (req.query.status) {
    const status = String(req.query.status).toUpperCase();
    if (!STATUS_VALIDOS.includes(status)) {
      throw new AppError(400, `status deve ser um destes: ${STATUS_VALIDOS.join(', ')}`);
    }
    condicoes.push('p.status = ?');
    valores.push(status);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const [pedidos] = await db.execute(
    `SELECT ${CAMPOS_PEDIDO} FROM pedidos p ${where} ORDER BY p.criado_em DESC, p.id DESC`,
    valores
  );
  return res.json(pedidos);
}

async function detalhar(req, res) {
  return res.json(await buscarPedidoCompleto(req.pedido.id));
}

module.exports = { finalizarCompra, listar, detalhar };
