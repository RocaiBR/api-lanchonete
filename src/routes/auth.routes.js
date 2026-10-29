const { Router } = require('express');
const autenticar = require('../middlewares/autenticar');
const auth = require('../controllers/authController');

const router = Router();

router.post('/cadastro', auth.cadastrar);
router.post('/login', auth.login);
router.post('/refresh', auth.renovar);
router.post('/logout', auth.logout);
router.get('/me', autenticar, auth.me);

module.exports = router;
