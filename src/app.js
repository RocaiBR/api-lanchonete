const express = require('express');
const AppError = require('./utils/AppError');
const tratarErros = require('./middlewares/tratarErros');

const authRoutes = require('./routes/auth.routes');
const cardapioRoutes = require('./routes/cardapio.routes');
const carrinhoRoutes = require('./routes/carrinho.routes');
const pedidosRoutes = require('./routes/pedidos.routes');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ api: 'Lanchonete', versao: '0.5.0', status: 'online' });
});

app.use('/auth', authRoutes);
app.use('/cardapio', cardapioRoutes);
app.use('/carrinho', carrinhoRoutes);
app.use('/pedidos', pedidosRoutes);

app.use((req, res, next) => next(new AppError(404, 'Rota não encontrada')));
app.use(tratarErros);

module.exports = app;
