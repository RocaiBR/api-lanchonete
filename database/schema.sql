DROP TABLE IF EXISTS pagamentos;
DROP TABLE IF EXISTS pedido_itens;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS carrinho_itens;
DROP TABLE IF EXISTS itens_cardapio;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  senha_hash  VARCHAR(100) NOT NULL,
  perfil      ENUM('CLIENTE', 'MOTOBOY', 'GERENTE') NOT NULL DEFAULT 'CLIENTE',
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expira_em   DATETIME NOT NULL,
  revogado    TINYINT(1) NOT NULL DEFAULT 0,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE itens_cardapio (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  descricao   VARCHAR(255),
  preco       DECIMAL(10, 2) NOT NULL,
  disponivel  TINYINT(1) NOT NULL DEFAULT 1,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_preco_positivo CHECK (preco > 0)
);

CREATE TABLE carrinho_itens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  item_id     INT NOT NULL,
  quantidade  INT NOT NULL,
  UNIQUE KEY uq_carrinho_usuario_item (usuario_id, item_id),
  CONSTRAINT fk_carrinho_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_carrinho_item    FOREIGN KEY (item_id)    REFERENCES itens_cardapio(id),
  CONSTRAINT ck_quantidade_carrinho CHECK (quantidade > 0)
);

CREATE TABLE pedidos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id        INT NOT NULL,
  motoboy_id        INT NULL,
  status            ENUM('PAGO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO', 'ESTORNADO') NOT NULL DEFAULT 'PAGO',
  total             DECIMAL(10, 2) NOT NULL,
  endereco_entrega  VARCHAR(255) NOT NULL,
  criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
  CONSTRAINT fk_pedido_motoboy FOREIGN KEY (motoboy_id) REFERENCES usuarios(id)
);

CREATE TABLE pedido_itens (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT NOT NULL,
  item_id         INT NOT NULL,
  nome_item       VARCHAR(100) NOT NULL,
  preco_unitario  DECIMAL(10, 2) NOT NULL,
  quantidade      INT NOT NULL,
  CONSTRAINT fk_pedido_itens_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pedido_itens_item   FOREIGN KEY (item_id)   REFERENCES itens_cardapio(id)
);

CREATE TABLE pagamentos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id   INT NOT NULL UNIQUE,
  metodo      ENUM('PIX', 'CARTAO') NOT NULL,
  valor       DECIMAL(10, 2) NOT NULL,
  status      ENUM('APROVADO', 'ESTORNADO') NOT NULL DEFAULT 'APROVADO',
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pagamento_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);
