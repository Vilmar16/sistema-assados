-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Tempo de geração: 30/09/2025 às 00:03
-- Versão do servidor: 9.1.0
-- Versão do PHP: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `assados`
--
CREATE DATABASE IF NOT EXISTS `assados` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `assados`;

-- --------------------------------------------------------

--
-- Estrutura para tabela `cliente`
--

DROP TABLE IF EXISTS `cliente`;
CREATE TABLE IF NOT EXISTS `cliente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `telefone` varchar(20) NOT NULL,
  `endereco` varchar(255) NOT NULL,
  `observacao` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `cliente`
--

INSERT INTO `cliente` (`id`, `nome`, `telefone`, `endereco`, `observacao`) VALUES
(1, '#null', '', '', ''),
(2, 'Victor Mateus Teixeira Da Cruz', '41 996204282', 'Rua Habib Sarkis, 173', ''),
(3, 'Gabriel Schultz', '41 99620-2309', 'Rua Habib Sarkis, 173', ''),
(4, 'Danielle', '41996358178', 'Rua Habib Sarkis, 173', '');

-- --------------------------------------------------------

--
-- Estrutura para tabela `controle_comanda`
--

DROP TABLE IF EXISTS `controle_comanda`;
CREATE TABLE IF NOT EXISTS `controle_comanda` (
  `id` int NOT NULL,
  `comanda` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `controle_comanda`
--

INSERT INTO `controle_comanda` (`id`, `comanda`) VALUES
(1, 25);

-- --------------------------------------------------------

--
-- Estrutura para tabela `itenspedido`
--

DROP TABLE IF EXISTS `itenspedido`;
CREATE TABLE IF NOT EXISTS `itenspedido` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_pedido` int NOT NULL,
  `id_produto` int NOT NULL,
  `qtd_produto` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_itenspedido_pedido` (`id_pedido`),
  KEY `fk_itenspedido_produto` (`id_produto`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `itenspedido`
--

INSERT INTO `itenspedido` (`id`, `id_pedido`, `id_produto`, `qtd_produto`) VALUES
(29, 24, 6, 1),
(30, 25, 1, 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela `pagamento`
--

DROP TABLE IF EXISTS `pagamento`;
CREATE TABLE IF NOT EXISTS `pagamento` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_pedido` int DEFAULT NULL,
  `status` enum('Pago','Não pago') NOT NULL,
  `tipo_pagamento` varchar(50) NOT NULL,
  `valor_pago` decimal(10,2) NOT NULL,
  `data_pagamento` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_pedido` (`id_pedido`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `pagamento`
--

INSERT INTO `pagamento` (`id`, `id_pedido`, `status`, `tipo_pagamento`, `valor_pago`, `data_pagamento`) VALUES
(4, 25, 'Pago', 'Debito', 60.00, '2025-09-29 20:40:39');

-- --------------------------------------------------------

--
-- Estrutura para tabela `pedido`
--

DROP TABLE IF EXISTS `pedido`;
CREATE TABLE IF NOT EXISTS `pedido` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_cliente` int NOT NULL,
  `data_hora` datetime NOT NULL,
  `id_status` int NOT NULL,
  `tipo_entrega` enum('Local','Entrega') NOT NULL,
  `id_pagamento` int DEFAULT NULL,
  `observacao` text,
  `comanda` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_pagamento` (`id_pagamento`),
  KEY `fk_pedido_cliente` (`id_cliente`),
  KEY `fk_pedido_status` (`id_status`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `pedido`
--

INSERT INTO `pedido` (`id`, `id_cliente`, `data_hora`, `id_status`, `tipo_entrega`, `id_pagamento`, `observacao`, `comanda`) VALUES
(24, 1, '2025-09-29 20:39:05', 1, 'Entrega', NULL, '', 11),
(25, 1, '2025-09-29 20:39:29', 3, 'Local', NULL, '', 24);

-- --------------------------------------------------------

--
-- Estrutura para tabela `produto`
--

DROP TABLE IF EXISTS `produto`;
CREATE TABLE IF NOT EXISTS `produto` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `tamanho` varchar(50) DEFAULT NULL,
  `valor` decimal(10,2) NOT NULL,
  `quantidade_maxima` int DEFAULT NULL,
  `categoria` varchar(50) DEFAULT NULL,
  `unidade` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `produto`
--

INSERT INTO `produto` (`id`, `nome`, `tamanho`, `valor`, `quantidade_maxima`, `categoria`, `unidade`) VALUES
(1, 'Frango assado', NULL, 55.00, 9, 'Carne', 'Un'),
(2, 'Costela assada', '', 68.00, 14, 'Carne', 'Kg'),
(3, 'Coxa sobrecoxa', '', 15.00, 10, 'Carne', 'Un'),
(4, 'Linguiça', '', 4.00, 30, 'Carne', 'Un'),
(5, 'Medalhão de porco', '', 5.00, 35, 'Carne', 'Un'),
(6, 'Risoto', 'Média', 25.00, 9, 'Acompanhamento', 'Un'),
(7, 'Maionese', 'Média', 25.00, 10, 'Acompanhamento', 'Un'),
(8, 'Coca-cola 2L', '2 litros', 15.00, 3, 'Bebida', 'Un'),
(9, 'Cini 2L', '2 litros', 8.50, 0, 'Bebida', 'Un'),
(10, 'Refrigerante (lata)', 'Lata', 5.00, 5, 'Bebida', 'Un');

-- --------------------------------------------------------

--
-- Estrutura para tabela `status`
--

DROP TABLE IF EXISTS `status`;
CREATE TABLE IF NOT EXISTS `status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Despejando dados para a tabela `status`
--

INSERT INTO `status` (`id`, `nome`) VALUES
(1, 'Aguardando Preparo'),
(2, 'Em Preparo'),
(3, 'Finalizado'),
(4, 'Entregue'),
(5, 'Cancelado');

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `itenspedido`
--
ALTER TABLE `itenspedido`
  ADD CONSTRAINT `fk_itenspedido_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedido` (`id`),
  ADD CONSTRAINT `fk_itenspedido_produto` FOREIGN KEY (`id_produto`) REFERENCES `produto` (`id`);

--
-- Restrições para tabelas `pedido`
--
ALTER TABLE `pedido`
  ADD CONSTRAINT `fk_pedido_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id`),
  ADD CONSTRAINT `fk_pedido_status` FOREIGN KEY (`id_status`) REFERENCES `status` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
