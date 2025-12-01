const express = require("express")
const router = express.Router()
const pool = require("../db")

router.get("/", async (req, res) => {
  const { busca } = req.query
  try {
    let query = "SELECT * FROM cliente"
    const params = []

    if (busca) {
      query += " WHERE nome LIKE ? OR telefone LIKE ?"
      const buscaLike = `%${busca}%`
      params.push(buscaLike, buscaLike)
    }

    const [rows] = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao buscar clientes" })
  }
})

router.post("/", async (req, res) => {
  const { nome, telefone, endereco, observacao } = req.body
  try {
    const [result] = await pool.query(
      "INSERT INTO cliente (nome, telefone, endereco, observacao) VALUES (?, ?, ?, ?)",
      [nome, telefone, endereco, observacao],
    )

    const io = req.app.get("io")
    io.emit("cliente:criado", { id: result.insertId, nome, telefone, endereco, observacao })

    res.status(201).json({ message: "Cliente cadastrado com sucesso", id: result.insertId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Erro ao cadastrar cliente" })
  }
})

router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { nome, telefone, endereco, observacao } = req.body
  try {
    const [result] = await pool.query(
      "UPDATE cliente SET nome = ?, telefone = ?, endereco = ?, observacao = ? WHERE id = ?",
      [nome, telefone, endereco, observacao, id],
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" })
    }

    const io = req.app.get("io")
    io.emit("cliente:atualizado", { id, nome, telefone, endereco, observacao })

    res.json({ message: "Cliente atualizado com sucesso" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Erro ao atualizar cliente" })
  }
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params
  try {
    const [result] = await pool.query("DELETE FROM cliente WHERE id = ?", [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" })
    }

    const io = req.app.get("io")
    io.emit("cliente:excluido", { id })

    res.json({ message: "Cliente excluído com sucesso" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Erro ao excluir cliente" })
  }
})

module.exports = router
