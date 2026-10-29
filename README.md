# API da Lanchonete

Backend de uma lanchonete com entrega, em **Node.js + Express + MySQL**.
O cliente vê o cardápio e faz pedidos, o motoboy retira e entrega, e o gerente
administra cardápio, pedidos e pagamentos. O foco é **controlar quem pode fazer o quê**.

> **Status: entrega parcial (≈ 50%).** Autenticação, as três checagens de
> autorização, o cardápio e a jornada do cliente até o pedido **PAGO** estão
> prontos e testados. O fluxo do motoboy e o cancelamento/estorno do gerente
> ficam para a segunda metade (ver [Próxima etapa](#próxima-etapa)).

## Como rodar

Pré-requisitos: Node.js 18+ e MySQL 8 (ou MariaDB 10.5+).

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
# edite o .env com usuário/senha do seu MySQL e um JWT_SECRET próprio
npm run db:setup          # cria o banco, as tabelas e os usuários de teste (apaga dados anteriores)
npm run dev               # ou: npm start
```

A API sobe em `http://localhost:3000`.

### Usuários de teste (criados pelo `db:setup`)

| Perfil  | E-mail                   | Senha      |
|---------|--------------------------|------------|
| GERENTE | gerente@lanchonete.com   | gerente123 |
| MOTOBOY | motoboy@lanchonete.com   | motoboy123 |
| CLIENTE | cliente@lanchonete.com   | cliente123 |

### Testando

- **Automático:** `npm test` roda 10 cenários de ponta a ponta (401, 403, dono do recurso, 409, jornada do pedido, refresh token). Precisa do banco preparado com `npm run db:setup`.
- **Manual:** abra `requests.http` no VS Code com a extensão **REST Client**. Faça os logins primeiro; os tokens são reaproveitados nas outras requisições.
- **Insomnia:** importe `insomnia.json` (Import → From File). Rode os logins da pasta *1. Autenticação* primeiro; eles salvam os tokens no ambiente, e o *Finalizar compra* salva o `pedido_id`.

## Autenticação

- O cadastro (`POST /auth/cadastro`) **sempre** cria um CLIENTE. Um campo `perfil` enviado no corpo é ignorado.
- A senha é guardada com hash **bcrypt** (10 rodadas).
- O login devolve um **JWT de 15 minutos** com o `id` e o `perfil` do usuário, e um **refresh token** (7 dias).
- `POST /auth/refresh` troca o refresh token por um par novo. O token usado é revogado (rotação), então não pode ser reutilizado.
- No banco fica só o hash SHA-256 do refresh token, nunca o token puro.
- Login incorreto → **401** (mesma mensagem para e-mail inexistente e senha errada).

## Autorização: as três checagens

Em toda rota protegida, nesta ordem:

| # | Pergunta | Onde está | Se falhar |
|---|----------|-----------|-----------|
| 1 | O token é válido? | `src/middlewares/autenticar.js` | **401** (ausente, inválido ou expirado) |
| 2 | O perfil tem permissão? | `src/middlewares/autorizar.js` | **403** (ex.: cliente criando item do cardápio) |
| 3 | O recurso é do usuário? | `src/middlewares/verificarAcessoAoPedido.js` | **403** (ex.: cliente vendo pedido de outro) |

Regras de negócio violadas respondem **409** (ex.: finalizar com carrinho vazio, comprar item indisponível).
Uma rota protegida monta as checagens como uma fila de middlewares:

```js
router.get('/:id', autenticar, autorizar('CLIENTE', 'MOTOBOY', 'GERENTE'), verificarAcessoAoPedido, pedidos.detalhar);
```

## Endpoints

✅ pronto · ⏳ próxima etapa

| Método | Rota | Quem pode | Status |
|--------|------|-----------|--------|
| POST | `/auth/cadastro` | público | ✅ |
| POST | `/auth/login` | público | ✅ |
| POST | `/auth/refresh` | público (com refresh token) | ✅ |
| POST | `/auth/logout` | público (com refresh token) | ✅ |
| GET | `/auth/me` | qualquer perfil logado | ✅ |
| GET | `/cardapio` | qualquer perfil logado (`?todos=true` só gerente) | ✅ |
| GET | `/cardapio/:id` | qualquer perfil logado | ✅ |
| POST | `/cardapio` | GERENTE | ✅ |
| PATCH | `/cardapio/:id` | GERENTE (nome, descrição, preço, disponível) | ✅ |
| DELETE | `/cardapio/:id` | GERENTE (deixa indisponível) | ✅ |
| GET | `/carrinho` | CLIENTE | ✅ |
| POST | `/carrinho/itens` | CLIENTE | ✅ |
| PATCH | `/carrinho/itens/:itemId` | CLIENTE | ✅ |
| DELETE | `/carrinho/itens/:itemId` | CLIENTE | ✅ |
| DELETE | `/carrinho` | CLIENTE | ✅ |
| POST | `/pedidos` | CLIENTE — finaliza a compra, pedido fica **PAGO** | ✅ |
| GET | `/pedidos` | CLIENTE (só os seus) · GERENTE (todos, `?status=`) | ✅ |
| GET | `/pedidos/:id` | dono do pedido · motoboy do pedido · GERENTE | ✅ |
| GET | `/pedidos/disponiveis` | MOTOBOY | ⏳ |
| PATCH | `/pedidos/:id/pegar` | MOTOBOY — PAGO → EM_ROTA | ⏳ |
| PATCH | `/pedidos/:id/entregar` | MOTOBOY que pegou — EM_ROTA → ENTREGUE | ⏳ |
| PATCH | `/pedidos/:id/cancelar` | GERENTE — → CANCELADO | ⏳ |
| PATCH | `/pedidos/:id/estornar` | GERENTE — → ESTORNADO (409 se já estornado) | ⏳ |

## Jornada do pedido

```
carrinho ──finalizar──▶ PAGO ──motoboy pega──▶ EM_ROTA ──entrega──▶ ENTREGUE
                          │                       │
                          └──── gerente ──────────┴──▶ CANCELADO / ESTORNADO
```

Pronto nesta etapa: carrinho → **PAGO** (pagamento simulado, aprovado na hora).
A finalização roda numa **transação**: cria o pedido, copia os itens com o preço do momento,
registra o pagamento e esvazia o carrinho. Se qualquer passo falhar, nada é gravado.

## Estrutura

```
database/
  schema.sql            tabelas do projeto inteiro (já inclui motoboy, pagamentos e estorno)
  setup.js              cria banco + tabelas + dados de teste
src/
  app.js                monta o Express, rotas e tratamento de erros
  server.js             sobe o servidor
  config/               .env e pool do MySQL
  middlewares/          autenticar (401), autorizar (403), verificarAcessoAoPedido (403), tratarErros
  controllers/          auth, cardápio, carrinho, pedidos
  routes/               uma rota por recurso
  utils/                AppError, tokens JWT/refresh, validações
testes/fluxo.test.js    testes de ponta a ponta
requests.http           requisições prontas para o REST Client
insomnia.json           coleção para importar no Insomnia
```

## Próxima etapa

1. **Motoboy:** listar pedidos `PAGO` sem motoboy, pegar (`EM_ROTA`, 409 se outro já pegou) e entregar (`ENTREGUE`, só quem pegou — reaproveita `verificarAcessoAoPedido`).
2. **Gerente:** cancelar e estornar pedidos, com as transições permitidas (ex.: não estornar pedido já estornado → 409) e o pagamento indo para `ESTORNADO`.
3. **Gerente:** cadastrar motoboys (hoje só existem via `db:setup`).
4. Testes dos fluxos novos e diagramas da jornada.

As tabelas para tudo isso já existem no `schema.sql`; falta só o código.
