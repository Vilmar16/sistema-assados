// routes/comandas.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Rota para resetar a comanda manualmente
router.post('/resetar', async (req, res) => {
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

module.exports = router;
