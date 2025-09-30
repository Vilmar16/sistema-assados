const express = require("express")
const router = express.Router()
const pool = require("../db")

// Criar pedido com comanda e controle de estoque
router.post("/", async (req, res) => {
  const { id_cliente, tipo_entrega, observacao, produtos } = req.body

  if (!id_cliente || !tipo_entrega || !Array.isArray(produtos) || produtos.length === 0) {
    return res.status(400).json({ error: "Dados do pedido incompletos ou inválidos" })
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    // Verifica e atualiza estoque
    for (const item of produtos) {
      const [[produto]] = await conn.query("SELECT nome, quantidade_maxima FROM produto WHERE id = ? FOR UPDATE", [
        item.id_produto,
      ])

      if (!produto) {
        await conn.rollback()
        return res.status(400).json({ error: `Produto com id ${item.id_produto} não encontrado.` })
      }

      if (produto.quantidade_maxima <= 0) {
        await conn.rollback()
        return res.status(400).json({ error: `Produto ${produto.nome} está indisponível (sem estoque).` })
      }

      if (item.qtd_produto > produto.quantidade_maxima) {
        await conn.rollback()
        return res.status(400).json({
          error: `Quantidade máxima excedida para o produto ${produto.nome}. Limite atual: ${produto.quantidade_maxima}`,
        })
      }

      // Atualiza o estoque (subtrai a quantidade pedida)
      await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima - ? WHERE id = ?", [
        item.qtd_produto,
        item.id_produto,
      ])
    }

    // Gerar número da comanda
    const [[{ comanda }]] = await conn.query("SELECT comanda FROM controle_comanda WHERE id = 1")
    const numero_comanda = comanda

    await conn.query("UPDATE controle_comanda SET comanda = comanda + 1 WHERE id = 1")

    // Inserir pedido
    const [pedidoResult] = await conn.query(
      "INSERT INTO pedido (id_cliente, data_hora, id_status, tipo_entrega, observacao, comanda) VALUES (?, NOW(), ?, ?, ?, ?)",
      [id_cliente, 1, tipo_entrega, observacao, numero_comanda],
    )

    const id_pedido = pedidoResult.insertId

    // Inserir itens do pedido
    for (const item of produtos) {
      await conn.query("INSERT INTO itenspedido (id_pedido, id_produto, qtd_produto) VALUES (?, ?, ?)", [
        id_pedido,
        item.id_produto,
        item.qtd_produto,
      ])
    }

    await conn.commit()

    res.status(201).json({ message: "Pedido cadastrado com sucesso", id_pedido, comanda: numero_comanda })
  } catch (error) {
    await conn.rollback()
    console.error("Erro ao cadastrar pedido:", error)
    res.status(500).json({ error: "Erro ao cadastrar pedido" })
  } finally {
    conn.release()
  }
})

// Listar pedidos com itens e comanda
router.get("/", async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      `SELECT p.id AS id_pedido, p.comanda, p.data_hora, p.tipo_entrega, p.observacao, p.id_status, s.nome AS status, c.id AS id_cliente, c.nome AS nome_cliente FROM pedido p JOIN cliente c ON p.id_cliente = c.id JOIN status s ON p.id_status = s.id ORDER BY p.data_hora DESC`,
    )

    if (pedidos.length === 0) {
      return res.json([])
    }

    const pedidosComItens = await Promise.all(
      pedidos.map(async (pedido) => {
        const [itens] = await pool.query(
          `SELECT ip.qtd_produto, pr.nome AS nome_produto, CAST(pr.valor AS DECIMAL(10,2)) AS valor FROM itenspedido ip JOIN produto pr ON ip.id_produto = pr.id WHERE ip.id_pedido = ?`,
          [pedido.id_pedido],
        )

        return {
          ...pedido,
          itens: itens.map((item) => ({ ...item, valor: Number.parseFloat(item.valor) })),
        }
      }),
    )

    res.json(pedidosComItens)
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error)
    res.status(500).json({ error: "Erro ao buscar pedidos" })
  }
})

router.get("/:id", async (req, res) => {
  const id_pedido = req.params.id

  try {
    // Buscar dados do pedido
    const [[pedido]] = await pool.query(
      `
      SELECT 
        p.id AS id_pedido,
        p.comanda,
        p.data_hora,
        p.tipo_entrega,
        p.observacao,
        p.id_status,
        p.id_cliente,
        s.nome AS status,
        c.nome AS nome_cliente
      FROM pedido p
      JOIN cliente c ON p.id_cliente = c.id
      JOIN status s ON p.id_status = s.id
      WHERE p.id = ?
    `,
      [id_pedido],
    )

    if (!pedido) {
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    // Buscar itens do pedido
    const [itens] = await pool.query(
      `
      SELECT 
        ip.id,
        ip.id_produto,
        ip.qtd_produto,
        pr.nome AS nome_produto,
        CAST(pr.valor AS DECIMAL(10,2)) AS valor
      FROM itenspedido ip
      JOIN produto pr ON ip.id_produto = pr.id
      WHERE ip.id_pedido = ?
    `,
      [id_pedido],
    )

    pedido.itens = itens.map((item) => ({ ...item, valor: Number.parseFloat(item.valor) }))

    res.json(pedido)
  } catch (error) {
    console.error("Erro ao buscar pedido:", error)
    res.status(500).json({ error: "Erro ao buscar pedido" })
  }
})

// Atualizar status do pedido
router.put("/:id/status", async (req, res) => {
  const id_pedido = req.params.id
  const { novoStatus } = req.body

  if (!novoStatus || isNaN(novoStatus)) {
    return res.status(400).json({ error: "Status inválido" })
  }

  try {
    const [result] = await pool.query("UPDATE pedido SET id_status = ? WHERE id = ?", [novoStatus, id_pedido])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    res.json({ message: "Status atualizado com sucesso" })
  } catch (error) {
    console.error("Erro ao atualizar status do pedido:", error)
    res.status(500).json({ error: "Erro ao atualizar status do pedido" })
  }
})

router.put("/:id", async (req, res) => {
  const id_pedido = req.params.id
  const { id_cliente, tipo_entrega, observacao, id_status, produtos } = req.body

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    // Atualizar dados básicos do pedido
    const fields = []
    const values = []

    if (id_cliente) {
      fields.push("id_cliente = ?")
      values.push(id_cliente)
    }
    if (tipo_entrega) {
      fields.push("tipo_entrega = ?")
      values.push(tipo_entrega)
    }
    if (observacao !== undefined) {
      fields.push("observacao = ?")
      values.push(observacao)
    }
    if (id_status) {
      fields.push("id_status = ?")
      values.push(id_status)
    }

    if (fields.length > 0) {
      values.push(id_pedido)
      const query = `UPDATE pedido SET ${fields.join(", ")} WHERE id = ?`
      await conn.query(query, values)
    }

    // Se produtos foram enviados, atualizar os itens do pedido
    if (produtos && Array.isArray(produtos)) {
      // Buscar itens antigos para devolver ao estoque
      const [itensAntigos] = await conn.query("SELECT id_produto, qtd_produto FROM itenspedido WHERE id_pedido = ?", [
        id_pedido,
      ])

      // Devolver quantidades ao estoque
      for (const item of itensAntigos) {
        await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima + ? WHERE id = ?", [
          item.qtd_produto,
          item.id_produto,
        ])
      }

      // Deletar itens antigos
      await conn.query("DELETE FROM itenspedido WHERE id_pedido = ?", [id_pedido])

      // Verificar e subtrair novo estoque
      for (const item of produtos) {
        const [[produto]] = await conn.query("SELECT nome, quantidade_maxima FROM produto WHERE id = ? FOR UPDATE", [
          item.id_produto,
        ])

        if (!produto) {
          await conn.rollback()
          return res.status(400).json({ error: `Produto com id ${item.id_produto} não encontrado.` })
        }

        if (item.qtd_produto > produto.quantidade_maxima) {
          await conn.rollback()
          return res.status(400).json({
            error: `Quantidade máxima excedida para o produto ${produto.nome}. Limite atual: ${produto.quantidade_maxima}`,
          })
        }

        // Subtrair do estoque
        await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima - ? WHERE id = ?", [
          item.qtd_produto,
          item.id_produto,
        ])

        // Inserir novo item
        await conn.query("INSERT INTO itenspedido (id_pedido, id_produto, qtd_produto) VALUES (?, ?, ?)", [
          id_pedido,
          item.id_produto,
          item.qtd_produto,
        ])
      }
    }

    await conn.commit()
    res.json({ message: "Pedido atualizado com sucesso" })
  } catch (error) {
    await conn.rollback()
    console.error("Erro ao atualizar pedido:", error)
    res.status(500).json({ error: "Erro ao atualizar pedido" })
  } finally {
    conn.release()
  }
})

// Excluir pedido e seus itens
router.delete("/:id", async (req, res) => {
  const id_pedido = req.params.id

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    // Deleta itens do pedido
    await conn.query("DELETE FROM itenspedido WHERE id_pedido = ?", [id_pedido])

    // Deleta pedido
    const [result] = await conn.query("DELETE FROM pedido WHERE id = ?", [id_pedido])

    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    await conn.commit()
    res.json({ message: "Pedido excluído com sucesso" })
  } catch (error) {
    await conn.rollback()
    console.error("Erro ao excluir pedido:", error)
    res.status(500).json({ error: "Erro ao excluir pedido" })
  } finally {
    conn.release()
  }
})

module.exports = router
