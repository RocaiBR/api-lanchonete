const AppError = require('./AppError');

function lerId(valor, campo = 'id') {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new AppError(400, `${campo} inválido`);
  }
  return numero;
}

function lerTexto(valor, campo, { obrigatorio = true, max = 255 } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (obrigatorio) throw new AppError(400, `${campo} é obrigatório`);
    return null;
  }
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new AppError(400, `${campo} deve ser um texto`);
  }
  const texto = valor.trim();
  if (texto.length > max) {
    throw new AppError(400, `${campo} deve ter no máximo ${max} caracteres`);
  }
  return texto;
}

function lerEmail(valor) {
  const email = lerTexto(valor, 'email', { max: 150 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'email inválido');
  }
  return email;
}

function lerSenha(valor) {
  if (typeof valor !== 'string' || valor.length < 6) {
    throw new AppError(400, 'senha deve ter pelo menos 6 caracteres');
  }
  return valor;
}

function lerPreco(valor) {
  const preco = Number(valor);
  if (typeof valor === 'boolean' || valor === null || valor === '' || !Number.isFinite(preco) || preco <= 0) {
    throw new AppError(400, 'preco deve ser um número maior que zero');
  }
  return Math.round(preco * 100) / 100;
}

function lerQuantidade(valor) {
  const quantidade = Number(valor);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) {
    throw new AppError(400, 'quantidade deve ser um número inteiro entre 1 e 50');
  }
  return quantidade;
}

module.exports = { lerId, lerTexto, lerEmail, lerSenha, lerPreco, lerQuantidade };
