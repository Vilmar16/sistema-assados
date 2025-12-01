const express = require("express")
const router = express.Router()
const pool = require("../db")

// Listar todos os combos com seus produtos
router.get("/", async (req, res) => {
  try {
    const [combos] = await pool.query("SELECT * FROM combo")

    if (combos.length === 0) return res.json([])

    const combosComProdutos = await Promise.all(
      combos.map(async (combo) => {
        const [produtos] = await pool.query(
          `
          SELECT cp.id, cp.id_produto, cp.quantidade, p.nome, p.valor, p.unidade
          FROM combo_produto cp
          JOIN produto p ON cp.id_produto = p.id
          WHERE cp.id_combo = ?
        `,
          [combo.id],
        )

        return { ...combo, produtos }
      }),
    )

    res.json(combosComProdutos)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao buscar combos" })
  }
})

// Buscar combo por id
router.get("/:id", async (req, res) => {
  const id = req.params.id
  try {
    const [combos] = await pool.query("SELECT * FROM combo WHERE id = ?", [id])

    if (combos.length === 0) {
      return res.status(404).json({ error: "Combo não encontrado" })
    }

    const combo = combos[0]

    const [produtos] = await pool.query(
      `
      SELECT cp.id, cp.id_produto, cp.quantidade, p.nome, p.valor, p.unidade
      FROM combo_produto cp
      JOIN produto p ON cp.id_produto = p.id
      WHERE cp.id_combo = ?
    `,
      [id],
    )

    combo.produtos = produtos
    res.json(combo)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao buscar combo" })
  }
})

// Criar combo
router.post("/", async (req, res) => {
  const { nome, valor, produtos } = req.body

  // Validações
  if (!nome || nome.trim() === "") {
    return res.status(400).json({ error: "Nome do combo é obrigatório" })
  }

  const valorFloat = Number.parseFloat(valor)

  if (isNaN(valorFloat) || valorFloat <= 0) {
    return res.status(400).json({ error: "Valor do combo deve ser um número válido maior que 0" })
  }

  if (!Array.isArray(produtos) || produtos.length === 0) {
    return res.status(400).json({ error: "Adicione pelo menos um produto ao combo" })
  }

  // Validar cada produto
  for (let i = 0; i < produtos.length; i++) {
    const item = produtos[i]

    if (!item.id_produto || !item.quantidade) {
      return res.status(400).json({ error: `Produto ${i + 1} deve ter id_produto e quantidade` })
    }
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const [result] = await conn.query("INSERT INTO combo (nome, valor) VALUES (?, ?)", [nome.trim(), valorFloat])

    const id_combo = result.insertId

    // Inserir produtos do combo
    for (const item of produtos) {
      await conn.query("INSERT INTO combo_produto (id_combo, id_produto, quantidade) VALUES (?, ?, ?)", [
        id_combo,
        item.id_produto,
        item.quantidade,
      ])
    }

    await conn.commit()

    const io = req.app.get("io")
    io.emit("combo:criado", { id: id_combo, nome: nome.trim(), valor: valorFloat })

    res.status(201).json({ message: "Combo cadastrado com sucesso", id: id_combo })
  } catch (err) {
    console.error("Erro ao cadastrar combo:", err)

    try {
      await conn.rollback()
    } catch (rollbackErr) {
      console.error("Erro ao fazer rollback:", rollbackErr)
    }

    res.status(500).json({ error: `Erro ao cadastrar combo: ${err.message}` })
  } finally {
    conn.release()
  }
})

// Atualizar combo
router.put("/:id", async (req, res) => {
  const id = req.params.id
  const { nome, valor, produtos } = req.body

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    if (nome || valor !== undefined) {
      const fields = []
      const values = []

      if (nome) {
        fields.push("nome = ?")
        values.push(nome)
      }
      if (valor !== undefined) {
        fields.push("valor = ?")
        values.push(Number.parseFloat(valor))
      }

      values.push(id)
      const query = `UPDATE combo SET ${fields.join(", ")} WHERE id = ?`
      await conn.query(query, values)
    }

    // Atualizar produtos
    if (Array.isArray(produtos)) {
      // Deletar produtos antigos
      await conn.query("DELETE FROM combo_produto WHERE id_combo = ?", [id])

      // Inserir novos produtos
      for (const item of produtos) {
        await conn.query("INSERT INTO combo_produto (id_combo, id_produto, quantidade) VALUES (?, ?, ?)", [
          id,
          item.id_produto,
          item.quantidade,
        ])
      }
    }

    await conn.commit()

    const io = req.app.get("io")
    io.emit("combo:atualizado", { id, nome, valor, produtos })

    res.json({ message: "Combo atualizado com sucesso" })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: "Erro ao atualizar combo" })
  } finally {
    conn.release()
  }
})

// Excluir combo
router.delete("/:id", async (req, res) => {
  const id = req.params.id
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    // Deletar produtos do combo
    await conn.query("DELETE FROM combo_produto WHERE id_combo = ?", [id])

    // Deletar combo
    const [result] = await conn.query("DELETE FROM combo WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ error: "Combo não encontrado" })
    }

    await conn.commit()

    const io = req.app.get("io")
    io.emit("combo:excluido", { id })

    res.json({ message: "Combo excluído com sucesso" })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: "Erro ao excluir combo" })
  } finally {
    conn.release()
  }
})

module.exports = router
