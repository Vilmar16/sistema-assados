const express = require("express")
const router = express.Router()
const pool = require("../db")

// Listar todos os produtos
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM produto")
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao buscar produtos" })
  }
})

// Buscar produto por id
router.get("/:id", async (req, res) => {
  const id = req.params.id
  try {
    const [rows] = await pool.query("SELECT * FROM produto WHERE id = ?", [id])
    if (rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" })
    }
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao buscar produto" })
  }
})

// Criar produto
router.post("/", async (req, res) => {
  const { nome, tamanho, valor, quantidade_maxima, categoria, unidade } = req.body

  if (!nome || valor === undefined || quantidade_maxima === undefined) {
    return res.status(400).json({ error: "Dados do produto incompletos" })
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO produto (nome, tamanho, valor, quantidade_maxima, categoria, unidade) VALUES (?, ?, ?, ?, ?, ?)",
      [nome, tamanho, valor, quantidade_maxima, categoria, unidade],
    )

    const io = req.app.get("io")
    io.emit("produto:criado", {
      id: result.insertId,
      nome,
      tamanho,
      valor,
      quantidade_maxima,
      categoria,
      unidade,
    })

    res.status(201).json({ message: "Produto cadastrado com sucesso", id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao cadastrar produto" })
  }
})

// Atualizar produto
router.put("/:id", async (req, res) => {
  const id = req.params.id
  const { nome, tamanho, valor, quantidade_maxima, categoria, unidade } = req.body

  if (
    !nome &&
    tamanho === undefined &&
    valor === undefined &&
    quantidade_maxima === undefined &&
    !categoria &&
    !unidade
  ) {
    return res.status(400).json({ error: "Nenhum dado para atualizar" })
  }

  try {
    const fields = []
    const values = []

    if (nome) {
      fields.push("nome = ?")
      values.push(nome)
    }
    if (tamanho !== undefined) {
      fields.push("tamanho = ?")
      values.push(tamanho)
    }
    if (valor !== undefined) {
      fields.push("valor = ?")
      values.push(valor)
    }
    if (quantidade_maxima !== undefined) {
      fields.push("quantidade_maxima = ?")
      values.push(quantidade_maxima)
    }
    if (categoria) {
      fields.push("categoria = ?")
      values.push(categoria)
    }
    if (unidade) {
      fields.push("unidade = ?")
      values.push(unidade)
    }

    values.push(id)

    const query = `UPDATE produto SET ${fields.join(", ")} WHERE id = ?`

    const [result] = await pool.query(query, values)

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Produto não encontrado" })
    }

    const io = req.app.get("io")
    io.emit("produto:atualizado", { id, nome, tamanho, valor, quantidade_maxima, categoria, unidade })

    res.json({ message: "Produto atualizado com sucesso" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao atualizar produto" })
  }
})

// Excluir produto
router.delete("/:id", async (req, res) => {
  const id = req.params.id

  try {
    const [result] = await pool.query("DELETE FROM produto WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Produto não encontrado" })
    }

    const io = req.app.get("io")
    io.emit("produto:excluido", { id })

    res.json({ message: "Produto excluído com sucesso" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao excluir produto" })
  }
})

module.exports = router
