// routes/pagamentos.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Criar pagamento
router.post('/', async (req, res) => {
  const { id_pedido, tipo_pagamento, valor_pago, status } = req.body;

  if (!id_pedido || !tipo_pagamento || !valor_pago) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO pagamento (id_pedido, tipo_pagamento, valor_pago, data_pagamento, status) VALUES (?, ?, ?, NOW(), ?)',
      [id_pedido, tipo_pagamento, valor_pago, status || 'Não pago']
    );

    res.status(201).json({ message: 'Pagamento registrado', id_pagamento: result.insertId });

  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

// Listar pagamentos de um pedido
router.get('/:id_pedido', async (req, res) => {
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

// Listar todos os pagamentos (opcional)
router.get('/', async (req, res) => {
  try {
    const [pagamentos] = await pool.query(
      'SELECT * FROM pagamento ORDER BY data_pagamento DESC'
    );

    res.json(pagamentos);

  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos' });
  }
});

// Atualizar pagamento
router.put('/:id', async (req, res) => {
  const id_pagamento = req.params.id;
  const { tipo_pagamento, valor_pago, status_pagamento } = req.body;

  if (!tipo_pagamento && !valor_pago && !status_pagamento) {
    return res.status(400).json({ error: 'Nenhum dado para atualizar' });
  }

  try {
    // Construir dinamicamente os campos para atualizar
    const fields = [];
    const values = [];

    if (tipo_pagamento) {
      fields.push('tipo_pagamento = ?');
      values.push(tipo_pagamento);
    }
    if (valor_pago !== undefined) {
      fields.push('valor_pago = ?');
      values.push(valor_pago);
    }
    if (status_pagamento) {
      fields.push('status = ?');
      values.push(status_pagamento);
    }

    values.push(id_pagamento);

    const query = `UPDATE pagamento SET ${fields.join(', ')} WHERE id = ?`;

    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    res.json({ message: 'Pagamento atualizado com sucesso' });

  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar pagamento' });
  }
});

// Deletar pagamento
router.delete('/:id', async (req, res) => {
  const id_pagamento = req.params.id;

  try {
    const [result] = await pool.query(
      'DELETE FROM pagamento WHERE id = ?',
      [id_pagamento]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    res.json({ message: 'Pagamento excluído com sucesso' });

  } catch (error) {
    console.error('Erro ao excluir pagamento:', error);
    res.status(500).json({ error: 'Erro ao excluir pagamento' });
  }
});

module.exports = router;
