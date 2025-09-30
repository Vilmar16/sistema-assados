const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o banco
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'assados',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Rotas frontend
app.get('/', (req, res) => {
  res.redirect('/cadastro-pedido.html');
});

// Rotas API

// ---------------- CLIENTES ----------------

app.get('/clientes', async (req, res) => {
  const { busca } = req.query; // busca é opcional

  try {
    let query = 'SELECT * FROM cliente';
    let params = [];

    if (busca) {
      query += ' WHERE nome LIKE ? OR telefone LIKE ?';
      const buscaLike = `%${busca}%`;
      params.push(buscaLike, buscaLike);
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});


app.post('/clientes', async (req, res) => {
  const { nome, telefone, endereco, observacao } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO cliente (nome, telefone, endereco, observacao) VALUES (?, ?, ?, ?)',
      [nome, telefone, endereco, observacao]
    );
    res.status(201).json({ message: 'Cliente cadastrado com sucesso', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar cliente' });
  }
});

app.put('/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, telefone, endereco, observacao } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE cliente SET nome = ?, telefone = ?, endereco = ?, observacao = ? WHERE id = ?',
      [nome, telefone, endereco, observacao, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

app.delete('/clientes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM cliente WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
});

// ---------------- PRODUTOS ----------------

app.get('/produtos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produto');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

app.post('/produtos', async (req, res) => {
  const { nome, tamanho, valor, quantidade_maxima, categoria, unidade } = req.body;

  if (!nome || valor === undefined || quantidade_maxima === undefined) {
    return res.status(400).json({ error: 'Dados do produto incompletos' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO produto (nome, tamanho, valor, quantidade_maxima, categoria, unidade) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, tamanho, valor, quantidade_maxima, categoria, unidade]
    );
    res.status(201).json({ message: 'Produto cadastrado com sucesso', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar produto' });
  }
});

// ---------------- PRODUTOS ----------------
app.get('/produtos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produto');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

app.post('/produtos', async (req, res) => {
  const { nome, tamanho, valor, quantidade_maxima, categoria, unidade } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO produto (nome, tamanho, valor, quantidade_maxima, categoria, unidade) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, tamanho, valor, quantidade_maxima, categoria, unidade]
    );
    res.status(201).json({ message: 'Produto cadastrado com sucesso', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar produto' });
  }
});


// ---------------- PEDIDOS ----------------

// Criar pedido com comanda
app.post('/pedidos', async (req, res) => {
  const { id_cliente, tipo_entrega, observacao, produtos } = req.body;

  if (!id_cliente || !tipo_entrega || !Array.isArray(produtos) || produtos.length === 0) {
    return res.status(400).json({ error: 'Dados do pedido incompletos ou inválidos' });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Validar quantidade_maxima para cada produto
    for (const item of produtos) {
      const [[produto]] = await conn.query(
        'SELECT nome, quantidade_maxima FROM produto WHERE id = ?',
        [item.id_produto]
      );

      if (!produto) {
        await conn.rollback();
        return res.status(400).json({ error: `Produto com id ${item.id_produto} não encontrado.` });
      }

      if (item.qtd_produto > produto.quantidade_maxima) {
        await conn.rollback();
        return res.status(400).json({ error: `Quantidade máxima excedida para o produto ${produto.nome}. Limite: ${produto.quantidade_maxima}` });
      }
    }

    // Pega a comanda atual
    const [[{ comanda }]] = await conn.query('SELECT comanda FROM controle_comanda WHERE id = 1');
    const numero_comanda = comanda;

    // Incrementa a comanda
    await conn.query('UPDATE controle_comanda SET comanda = comanda + 1 WHERE id = 1');

    // Cria o pedido com a comanda
    const [pedidoResult] = await conn.query(
      'INSERT INTO pedido (id_cliente, data_hora, id_status, tipo_entrega, observacao, comanda) VALUES (?, NOW(), ?, ?, ?, ?)',
      [id_cliente, 1, tipo_entrega, observacao, numero_comanda] // status 1 = Aguardando Preparo
    );

    const id_pedido = pedidoResult.insertId;

    // Adiciona itens ao pedido
    for (const item of produtos) {
      await conn.query(
        'INSERT INTO itenspedido (id_pedido, id_produto, qtd_produto) VALUES (?, ?, ?)',
        [id_pedido, item.id_produto, item.qtd_produto]
      );
    }

    await conn.commit();

    res.json({ message: 'Pedido cadastrado com sucesso', id_pedido, comanda: numero_comanda });

  } catch (error) {
    await conn.rollback();
    console.error('Erro ao cadastrar pedido:', error);
    res.status(500).json({ error: 'Erro ao cadastrar pedido' });
  } finally {
    conn.release();
  }
});

// Listar pedidos com itens e comanda
app.get('/pedidos', async (req, res) => {
  try {
    const [pedidos] = await pool.query(`
      SELECT 
        p.id AS id_pedido,
        p.comanda,
        p.data_hora,
        p.tipo_entrega,
        p.observacao,
        p.id_status,
        s.nome AS status,
        c.id AS id_cliente,
        c.nome AS nome_cliente
      FROM pedido p
      JOIN cliente c ON p.id_cliente = c.id
      JOIN status s ON p.id_status = s.id
      ORDER BY p.data_hora DESC
    `);

    if (pedidos.length === 0) {
      return res.json([]);
    }

    const pedidosComItens = await Promise.all(pedidos.map(async pedido => {
      const [itens] = await pool.query(`
        SELECT 
          ip.qtd_produto,
          pr.nome AS nome_produto,
          CAST(pr.valor AS DECIMAL(10,2)) AS valor
        FROM itenspedido ip
        JOIN produto pr ON ip.id_produto = pr.id
        WHERE ip.id_pedido = ?
      `, [pedido.id_pedido]);

      return {
        ...pedido,
        itens: itens.map(item => ({ ...item, valor: parseFloat(item.valor) }))
      };
    }));

    res.json(pedidosComItens);

  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});


// Atualizar status do pedido
app.put('/pedidos/:id/status', async (req, res) => {
  const id_pedido = req.params.id;
  const { novoStatus } = req.body;

  if (!novoStatus || isNaN(novoStatus)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE pedido SET id_status = ? WHERE id = ?',
      [novoStatus, id_pedido]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json({ message: 'Status atualizado com sucesso' });

  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
  }
});


// ---------------- PAGAMENTOS ----------------
app.post('/pagamentos', async (req, res) => {
  const { id_pedido, tipo_pagamento, valor_pago, status_pagamento } = req.body;

  if (!id_pedido || !tipo_pagamento || !valor_pago) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO pagamento (id_pedido, tipo_pagamento, valor_pago, data_pagamento, status) VALUES (?, ?, ?, NOW(), ?)',
      [id_pedido, tipo_pagamento, valor_pago, status_pagamento || 'Não pago']
    );

    res.status(201).json({ message: 'Pagamento registrado', id_pagamento: result.insertId });

  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

app.get('/pagamentos/:id_pedido', async (req, res) => {
  const id_pedido = req.params.id_pedido;

  try {
    const [pagamentos] = await pool.query(
      'SELECT * FROM pagamento WHERE id_pedido = ? ORDER BY data_pagamento DESC',
      [id_pedido]
    );

    res.json(pagamentos);

  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos' });
  }
});


// ---------------- COMANDAS ----------------
// Rota para resetar a comanda manualmente
app.post('/comandas/resetar', async (req, res) => {
  const { valor } = req.body;
  const novoValor = parseInt(valor, 10);

  if (isNaN(novoValor) || novoValor < 1) {
    return res.status(400).json({ error: 'Valor inválido para comanda' });
  }

  try {
    await pool.query('UPDATE controle_comanda SET comanda = ? WHERE id = 1', [novoValor]);
    res.json({ message: `Comanda reiniciada com sucesso para ${novoValor}` });
  } catch (error) {
    console.error('Erro ao resetar comanda:', error);
    res.status(500).json({ error: 'Erro ao resetar comanda' });
  }
});


// ---------------- INICIAR SERVIDOR ----------------
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
