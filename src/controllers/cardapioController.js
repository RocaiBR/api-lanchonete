const db = require('../config/db');
const AppError = require('../utils/AppError');
const { lerId, lerTexto, lerPreco } = require('../utils/validacao');

const CAMPOS = 'id, nome, descricao, preco, disponivel';

function formatarItem(linha) {
  return { ...linha, disponivel: Boolean(linha.disponivel) };
}

async function buscarItem(id) {
  const [linhas] = await db.execute(`SELECT ${CAMPOS} FROM itens_cardapio WHERE id = ?`, [id]);
  return linhas[0] ? formatarItem(linhas[0]) : null;
}

async function listar(req, res) {
  const verTodos = req.usuario.perfil === 'GERENTE' && req.query.todos === 'true';
  const filtro = verTodos ? '' : 'WHERE disponivel = 1';
  const [linhas] = await db.query(`SELECT ${CAMPOS} FROM itens_cardapio ${filtro} ORDER BY nome`);
  return res.json(linhas.map(formatarItem));
}

async function detalhar(req, res) {
  const item = await buscarItem(lerId(req.params.id));
  const podeVer = item && (item.disponivel || req.usuario.perfil === 'GERENTE');
  if (!podeVer) {
    throw new AppError(404, 'Item do cardápio não encontrado');
  }
  return res.json(item);
}

async function criar(req, res) {
  const corpo = req.body || {};
  const nome = lerTexto(corpo.nome, 'nome', { max: 100 });
  const descricao = lerTexto(corpo.descricao, 'descricao', { obrigatorio: false });
  const preco = lerPreco(corpo.preco);

  const [resultado] = await db.execute(
    'INSERT INTO itens_cardapio (nome, descricao, preco) VALUES (?, ?, ?)',
    [nome, descricao, preco]
  );
  return res.status(201).json(await buscarItem(resultado.insertId));
}

async function atualizar(req, res) {
  const id = lerId(req.params.id);
  const corpo = req.body || {};
  const campos = [];
  const valores = [];

  if (corpo.nome !== undefined) {
    campos.push('nome = ?');
    valores.push(lerTexto(corpo.nome, 'nome', { max: 100 }));
  }
  if (corpo.descricao !== undefined) {
    campos.push('descricao = ?');
    valores.push(lerTexto(corpo.descricao, 'descricao', { obrigatorio: false }));
  }
  if (corpo.preco !== undefined) {
    campos.push('preco = ?');
    valores.push(lerPreco(corpo.preco));
  }
  if (corpo.disponivel !== undefined) {
    if (typeof corpo.disponivel !== 'boolean') {
      throw new AppError(400, 'disponivel deve ser true ou false');
    }
    campos.push('disponivel = ?');
    valores.push(corpo.disponivel ? 1 : 0);
  }

  if (campos.length === 0) {
    throw new AppError(400, 'Envie ao menos um campo: nome, descricao, preco ou disponivel');
  }

  const [resultado] = await db.execute(
    `UPDATE itens_cardapio SET ${campos.join(', ')} WHERE id = ?`,
    [...valores, id]
  );
  if (resultado.affectedRows === 0) {
    throw new AppError(404, 'Item do cardápio não encontrado');
  }
  return res.json(await buscarItem(id));
}

async function remover(req, res) {
  const id = lerId(req.params.id);
  const [resultado] = await db.execute('UPDATE itens_cardapio SET disponivel = 0 WHERE id = ?', [id]);
  if (resultado.affectedRows === 0) {
    throw new AppError(404, 'Item do cardápio não encontrado');
  }
  return res.status(204).end();
}

module.exports = { listar, detalhar, criar, atualizar, remover };
