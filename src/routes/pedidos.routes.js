const { Router } = require('express');
const autenticar = require('../middlewares/autenticar');
const autorizar = require('../middlewares/autorizar');
const verificarAcessoAoPedido = require('../middlewares/verificarAcessoAoPedido');
const pedidos = require('../controllers/pedidosController');

const router = Router();

router.use(autenticar);

router.post('/', autorizar('CLIENTE'), pedidos.finalizarCompra);
router.get('/', autorizar('CLIENTE', 'GERENTE'), pedidos.listar);
router.get('/:id', autorizar('CLIENTE', 'MOTOBOY', 'GERENTE'), verificarAcessoAoPedido, pedidos.detalhar);

module.exports = router;
