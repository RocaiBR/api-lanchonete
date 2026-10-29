const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');

let servidor;
let baseUrl;

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';

  const resposta = await fetch(baseUrl + caminho, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

async function logar(email, senha) {
  const { status, corpo } = await chamar('POST', '/auth/login', { corpo: { email, senha } });
  assert.equal(status, 200, `login de ${email} falhou`);
  return corpo;
}

const sufixo = Date.now();
const contas = {};

before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  contas.gerente = await logar('gerente@lanchonete.com', 'gerente123');
  contas.motoboy = await logar('motoboy@lanchonete.com', 'motoboy123');
});

after(async () => {
  servidor.close();
  await db.end();
});

test('cadastro sempre cria CLIENTE, mesmo se pedir outro perfil', async () => {
  const { status, corpo } = await chamar('POST', '/auth/cadastro', {
    corpo: { nome: 'Ana', email: `ana${sufixo}@teste.com`, senha: 'senha123', perfil: 'GERENTE' },
  });
  assert.equal(status, 201);
  assert.equal(corpo.perfil, 'CLIENTE');

  await chamar('POST', '/auth/cadastro', {
    corpo: { nome: 'Bruno', email: `bruno${sufixo}@teste.com`, senha: 'senha123' },
  });
  contas.ana = await logar(`ana${sufixo}@teste.com`, 'senha123');
  contas.bruno = await logar(`bruno${sufixo}@teste.com`, 'senha123');
  assert.equal(contas.ana.usuario.perfil, 'CLIENTE');
});

test('cadastro com e-mail repetido -> 409, dados inválidos -> 400', async () => {
  const repetido = await chamar('POST', '/auth/cadastro', {
    corpo: { nome: 'Ana 2', email: `ana${sufixo}@teste.com`, senha: 'senha123' },
  });
  assert.equal(repetido.status, 409);

  const senhaCurta = await chamar('POST', '/auth/cadastro', {
    corpo: { nome: 'X', email: `x${sufixo}@teste.com`, senha: '123' },
  });
  assert.equal(senhaCurta.status, 400);
});

test('login incorreto -> 401', async () => {
  const senhaErrada = await chamar('POST', '/auth/login', {
    corpo: { email: 'gerente@lanchonete.com', senha: 'errada' },
  });
  assert.equal(senhaErrada.status, 401);

  const emailInexistente = await chamar('POST', '/auth/login', {
    corpo: { email: 'ninguem@lanchonete.com', senha: 'qualquer' },
  });
  assert.equal(emailInexistente.status, 401);
});

test('1ª checagem: token ausente, inválido ou expirado -> 401', async () => {
  assert.equal((await chamar('GET', '/cardapio')).status, 401);
  assert.equal((await chamar('GET', '/cardapio', { token: 'abc.def.ghi' })).status, 401);

  const expirado = jwt.sign(
    { id: contas.ana.usuario.id, perfil: 'CLIENTE', exp: Math.floor(Date.now() / 1000) - 60 },
    env.jwt.segredo
  );
  const resposta = await chamar('GET', '/cardapio', { token: expirado });
  assert.equal(resposta.status, 401);
  assert.match(resposta.corpo.erro, /expirado/);

  const assinadoComOutroSegredo = jwt.sign({ id: 1, perfil: 'GERENTE' }, 'segredo-falso');
  assert.equal((await chamar('POST', '/cardapio', { token: assinadoComOutroSegredo, corpo: {} })).status, 401);
});

test('2ª checagem: perfil sem permissão -> 403', async () => {
  const clienteCriandoItem = await chamar('POST', '/cardapio', {
    token: contas.ana.accessToken,
    corpo: { nome: 'Hack', preco: 1 },
  });
  assert.equal(clienteCriandoItem.status, 403);

  const motoboyNoCarrinho = await chamar('GET', '/carrinho', { token: contas.motoboy.accessToken });
  assert.equal(motoboyNoCarrinho.status, 403);

  const gerenteComprando = await chamar('POST', '/pedidos', {
    token: contas.gerente.accessToken,
    corpo: { enderecoEntrega: 'Rua A', formaPagamento: 'PIX' },
  });
  assert.equal(gerenteComprando.status, 403);
});

test('gerente cria item, altera preço e deixa indisponível', async () => {
  const criado = await chamar('POST', '/cardapio', {
    token: contas.gerente.accessToken,
    corpo: { nome: `Suco ${sufixo}`, descricao: 'Laranja 500 ml', preco: 9.9 },
  });
  assert.equal(criado.status, 201);
  contas.itemSuco = criado.corpo.id;

  const alterado = await chamar('PATCH', `/cardapio/${criado.corpo.id}`, {
    token: contas.gerente.accessToken,
    corpo: { preco: 11.5 },
  });
  assert.equal(alterado.status, 200);
  assert.equal(alterado.corpo.preco, 11.5);

  const precoInvalido = await chamar('PATCH', `/cardapio/${criado.corpo.id}`, {
    token: contas.gerente.accessToken,
    corpo: { preco: -3 },
  });
  assert.equal(precoInvalido.status, 400);

  const removido = await chamar('DELETE', `/cardapio/${criado.corpo.id}`, { token: contas.gerente.accessToken });
  assert.equal(removido.status, 204);

  const listaCliente = await chamar('GET', '/cardapio', { token: contas.ana.accessToken });
  assert.equal(listaCliente.status, 200);
  assert.ok(!listaCliente.corpo.some((item) => item.id === criado.corpo.id), 'cliente não vê item indisponível');

  const itemIndisponivel = await chamar('POST', '/carrinho/itens', {
    token: contas.ana.accessToken,
    corpo: { itemId: criado.corpo.id },
  });
  assert.equal(itemIndisponivel.status, 409);
});

test('regra de negócio: finalizar com carrinho vazio -> 409', async () => {
  const resposta = await chamar('POST', '/pedidos', {
    token: contas.ana.accessToken,
    corpo: { enderecoEntrega: 'Rua das Flores, 10', formaPagamento: 'PIX' },
  });
  assert.equal(resposta.status, 409);
});

test('jornada do cliente: carrinho -> compra -> pedido PAGO', async () => {
  const cardapio = (await chamar('GET', '/cardapio', { token: contas.ana.accessToken })).corpo;
  const [primeiro, segundo] = cardapio;

  await chamar('POST', '/carrinho/itens', {
    token: contas.ana.accessToken,
    corpo: { itemId: primeiro.id, quantidade: 2 },
  });
  await chamar('POST', '/carrinho/itens', {
    token: contas.ana.accessToken,
    corpo: { itemId: primeiro.id, quantidade: 1 },
  });
  await chamar('POST', '/carrinho/itens', {
    token: contas.ana.accessToken,
    corpo: { itemId: segundo.id },
  });

  const quantidadeInvalida = await chamar('PATCH', `/carrinho/itens/${segundo.id}`, {
    token: contas.ana.accessToken,
    corpo: { quantidade: 0 },
  });
  assert.equal(quantidadeInvalida.status, 400);

  const carrinho = (await chamar('GET', '/carrinho', { token: contas.ana.accessToken })).corpo;
  const esperado = Math.round((primeiro.preco * 3 + segundo.preco) * 100) / 100;
  assert.equal(carrinho.itens.length, 2);
  assert.equal(carrinho.total, esperado);

  const compra = await chamar('POST', '/pedidos', {
    token: contas.ana.accessToken,
    corpo: { enderecoEntrega: 'Rua das Flores, 10', formaPagamento: 'pix' },
  });
  assert.equal(compra.status, 201);
  assert.equal(compra.corpo.status, 'PAGO');
  assert.equal(compra.corpo.total, esperado);
  assert.equal(compra.corpo.pagamento.status, 'APROVADO');
  contas.pedidoDaAna = compra.corpo.id;

  const carrinhoDepois = (await chamar('GET', '/carrinho', { token: contas.ana.accessToken })).corpo;
  assert.equal(carrinhoDepois.itens.length, 0);
});

test('3ª checagem: o pedido é do usuário? Se não -> 403', async () => {
  const caminho = `/pedidos/${contas.pedidoDaAna}`;

  assert.equal((await chamar('GET', caminho, { token: contas.ana.accessToken })).status, 200);
  assert.equal((await chamar('GET', caminho, { token: contas.gerente.accessToken })).status, 200);
  assert.equal((await chamar('GET', caminho, { token: contas.bruno.accessToken })).status, 403);
  assert.equal((await chamar('GET', caminho, { token: contas.motoboy.accessToken })).status, 403);
  assert.equal((await chamar('GET', '/pedidos/999999', { token: contas.ana.accessToken })).status, 404);

  const listaDoBruno = (await chamar('GET', '/pedidos', { token: contas.bruno.accessToken })).corpo;
  assert.equal(listaDoBruno.length, 0, 'Bruno não vê pedidos da Ana');

  const listaDoGerente = (await chamar('GET', '/pedidos?status=PAGO', { token: contas.gerente.accessToken })).corpo;
  assert.ok(listaDoGerente.some((pedido) => pedido.id === contas.pedidoDaAna));
});

test('refresh token renova o acesso e não pode ser reutilizado', async () => {
  const sessao = await logar(`bruno${sufixo}@teste.com`, 'senha123');

  const renovado = await chamar('POST', '/auth/refresh', { corpo: { refreshToken: sessao.refreshToken } });
  assert.equal(renovado.status, 200);
  assert.ok(renovado.corpo.accessToken);
  assert.notEqual(renovado.corpo.refreshToken, sessao.refreshToken);

  const reutilizado = await chamar('POST', '/auth/refresh', { corpo: { refreshToken: sessao.refreshToken } });
  assert.equal(reutilizado.status, 401);

  const sair = await chamar('POST', '/auth/logout', { corpo: { refreshToken: renovado.corpo.refreshToken } });
  assert.equal(sair.status, 204);
  const depoisDoLogout = await chamar('POST', '/auth/refresh', { corpo: { refreshToken: renovado.corpo.refreshToken } });
  assert.equal(depoisDoLogout.status, 401);
});
