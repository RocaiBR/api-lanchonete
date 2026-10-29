const { Router } = require('express');
const autenticar = require('../middlewares/autenticar');
const autorizar = require('../middlewares/autorizar');
const cardapio = require('../controllers/cardapioController');

const router = Router();

router.use(autenticar);

router.get('/', cardapio.listar);
router.get('/:id', cardapio.detalhar);
router.post('/', autorizar('GERENTE'), cardapio.criar);
router.patch('/:id', autorizar('GERENTE'), cardapio.atualizar);
router.delete('/:id', autorizar('GERENTE'), cardapio.remover);

module.exports = router;
