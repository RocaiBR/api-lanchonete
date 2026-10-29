require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const USUARIOS_INICIAIS = [
  { nome: 'Gerente da Lanchonete', email: 'gerente@lanchonete.com', senha: 'gerente123', perfil: 'GERENTE' },
  { nome: 'Motoboy Teste', email: 'motoboy@lanchonete.com', senha: 'motoboy123', perfil: 'MOTOBOY' },
  { nome: 'Cliente Teste', email: 'cliente@lanchonete.com', senha: 'cliente123', perfil: 'CLIENTE' },
];

const CARDAPIO_INICIAL = [
  { nome: 'X-Burguer', descricao: 'Pão, hambúrguer, queijo e maionese da casa', preco: 22.9 },
  { nome: 'X-Salada', descricao: 'X-Burguer com alface e tomate', preco: 25.5 },
  { nome: 'X-Bacon', descricao: 'Hambúrguer, queijo e bacon crocante', preco: 29.9 },
  { nome: 'Batata frita', descricao: 'Porção média', preco: 14.0 },
  { nome: 'Refrigerante lata', descricao: '350 ml', preco: 6.5 },
];

async function main() {
  const nomeBanco = process.env.DB_NAME || 'lanchonete';

  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await conexao.query(
    `CREATE DATABASE IF NOT EXISTS \`${nomeBanco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conexao.query(`USE \`${nomeBanco}\``);

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conexao.query(schema);
  console.log(`Tabelas criadas no banco "${nomeBanco}".`);

  for (const u of USUARIOS_INICIAIS) {
    const hash = await bcrypt.hash(u.senha, 10);
    await conexao.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
      [u.nome, u.email, hash, u.perfil]
    );
  }

  for (const item of CARDAPIO_INICIAL) {
    await conexao.execute(
      'INSERT INTO itens_cardapio (nome, descricao, preco) VALUES (?, ?, ?)',
      [item.nome, item.descricao, item.preco]
    );
  }

  console.log('Dados iniciais inseridos:');
  for (const u of USUARIOS_INICIAIS) {
    console.log(`  ${u.perfil.padEnd(8)} ${u.email} / ${u.senha}`);
  }

  await conexao.end();
}

main().catch((erro) => {
  console.error('Falha ao preparar o banco:', erro.message);
  process.exit(1);
});
