const { Router } = require('express');
const autenticar = require('../middlewares/autenticar');
const autorizar = require('../middlewares/autorizar');
const carrinho = require('../controllers/carrinhoController');

const router = Router();

router.use(autenticar, autorizar('CLIENTE'));

router.get('/', carrinho.ver);
router.post('/itens', carrinho.adicionarItem);
router.patch('/itens/:itemId', carrinho.alterarQuantidade);
router.delete('/itens/:itemId', carrinho.removerItem);
router.delete('/', carrinho.esvaziar);

module.exports = router;
