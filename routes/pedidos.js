const express = require("express")
const router = express.Router()
const pool = require("../db")

function calcularPrecoLinguiça(qtd) {
  const preco1 = 4
  const preco3 = 10
  let total = 0

  total += Math.floor(qtd / 3) * preco3
  total += (qtd % 3) * preco1

  return total
}

function calcularPrecoKg(qtdGramas, precoKg) {
  return (qtdGramas / 1000) * precoKg
}

router.post("/", async (req, res) => {
  const { id_cliente, tipo_entrega, observacao, produtos, combos } = req.body

  if (!id_cliente || !tipo_entrega) {
    return res.status(400).json({ error: "Cliente e tipo de entrega são obrigatórios" })
  }

  if ((!Array.isArray(produtos) || produtos.length === 0) && (!Array.isArray(combos) || combos.length === 0)) {
    return res.status(400).json({ error: "Adicione pelo menos um produto ou combo ao pedido" })
  }

  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const itensProdutos = []
    if (Array.isArray(produtos) && produtos.length > 0) {
      for (const item of produtos) {
        const [[produto]] = await conn.query(
          "SELECT nome, quantidade_maxima, valor, unidade FROM produto WHERE id = ? FOR UPDATE",
          [item.id_produto],
        )

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

        await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima - ? WHERE id = ?", [
          item.qtd_produto,
          item.id_produto,
        ])

        if (produto.nome.toLowerCase() === "linguiça") {
          item.valor = calcularPrecoLinguiça(item.qtd_produto)
        } else if (produto.unidade && produto.unidade.toLowerCase() === "kg") {
          item.valor = calcularPrecoKg(item.qtd_produto, Number.parseFloat(produto.valor))
        } else {
          item.valor = produto.valor
        }

        itensProdutos.push(item)
      }
    }

    const itensCombos = []
    if (Array.isArray(combos) && combos.length > 0) {
      for (const itemCombo of combos) {
        const [[combo]] = await conn.query("SELECT id, nome, valor FROM combo WHERE id = ?", [itemCombo.id_combo])

        if (!combo) {
          await conn.rollback()
          return res.status(400).json({ error: `Combo com id ${itemCombo.id_combo} não encontrado.` })
        }

        const [produtosCombo] = await conn.query(
          `SELECT cp.id_produto, cp.quantidade, p.nome, p.quantidade_maxima 
           FROM combo_produto cp 
           JOIN produto p ON cp.id_produto = p.id 
           WHERE cp.id_combo = ? FOR UPDATE`,
          [itemCombo.id_combo],
        )

        for (const prodCombo of produtosCombo) {
          const qtdNecessaria = prodCombo.quantidade * itemCombo.qtd_combo

          if (prodCombo.quantidade_maxima < qtdNecessaria) {
            await conn.rollback()
            return res.status(400).json({
              error: `Estoque insuficiente para o combo ${combo.nome}. Produto ${prodCombo.nome} tem apenas ${prodCombo.quantidade_maxima} unidades disponíveis.`,
            })
          }
        }

        for (const prodCombo of produtosCombo) {
          const qtdNecessaria = prodCombo.quantidade * itemCombo.qtd_combo
          await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima - ? WHERE id = ?", [
            qtdNecessaria,
            prodCombo.id_produto,
          ])
        }

        itensCombos.push({
          id_combo: itemCombo.id_combo,
          qtd_combo: itemCombo.qtd_combo,
          valor: combo.valor,
        })
      }
    }

    const [[{ comanda }]] = await conn.query("SELECT comanda FROM controle_comanda WHERE id = 1")
    const numero_comanda = comanda
    await conn.query("UPDATE controle_comanda SET comanda = comanda + 1 WHERE id = 1")

    const [pedidoResult] = await conn.query(
      "INSERT INTO pedido (id_cliente, data_hora, id_status, tipo_entrega, observacao, comanda) VALUES (?, NOW(), ?, ?, ?, ?)",
      [id_cliente, 1, tipo_entrega, observacao, numero_comanda],
    )

    const id_pedido = pedidoResult.insertId

    for (const item of itensProdutos) {
      await conn.query("INSERT INTO itenspedido (id_pedido, id_produto, qtd_produto) VALUES (?, ?, ?)", [
        id_pedido,
        item.id_produto,
        item.qtd_produto,
      ])
    }

    for (const itemCombo of itensCombos) {
      await conn.query("INSERT INTO itenspedido_combo (id_pedido, id_combo, qtd_combo) VALUES (?, ?, ?)", [
        id_pedido,
        itemCombo.id_combo,
        itemCombo.qtd_combo,
      ])
    }

    await conn.commit()

    const io = req.app.get("io")
    io.emit("pedido:criado", { id_pedido, comanda: numero_comanda })
    io.emit("produto:atualizado")

    res.status(201).json({ message: "Pedido cadastrado com sucesso", id_pedido, comanda: numero_comanda })
  } catch (error) {
    await conn.rollback()
    console.error("Erro ao cadastrar pedido:", error)
    res.status(500).json({ error: "Erro ao cadastrar pedido" })
  } finally {
    conn.release()
  }
})

router.get("/", async (req, res) => {
  try {
    const [pedidos] = await pool.query(`
      SELECT p.id AS id_pedido, p.comanda, p.data_hora, p.tipo_entrega, p.observacao, p.id_status, s.nome AS status, c.id AS id_cliente, c.nome AS nome_cliente
      FROM pedido p
      JOIN cliente c ON p.id_cliente = c.id
      JOIN status s ON p.id_status = s.id
      ORDER BY p.data_hora DESC
    `)

    if (pedidos.length === 0) return res.json([])

    const pedidosComItens = await Promise.all(
      pedidos.map(async (pedido) => {
        const [itens] = await pool.query(
          `
          SELECT ip.qtd_produto, pr.nome AS nome_produto, CAST(pr.valor AS DECIMAL(10,2)) AS valor_unitario_db, pr.categoria, pr.unidade
          FROM itenspedido ip
          JOIN produto pr ON ip.id_produto = pr.id
          WHERE ip.id_pedido = ?
        `,
          [pedido.id_pedido],
        )

        const itensComPreco = itens.map((item) => {
          const isLinguica = item.nome_produto.toLowerCase() === "linguiça"
          const isKg = item.unidade && item.unidade.toLowerCase() === "kg"

          const valorUnitario = Number.parseFloat(item.valor_unitario_db)
          let subtotalCalculado

          if (isLinguica) {
            subtotalCalculado = calcularPrecoLinguiça(item.qtd_produto)
          } else if (isKg) {
            subtotalCalculado = calcularPrecoKg(item.qtd_produto, valorUnitario)
          } else {
            subtotalCalculado = valorUnitario * item.qtd_produto
          }

          return {
            ...item,
            valor: valorUnitario,
            subtotal: subtotalCalculado,
            tipo: "produto",
          }
        })

        const [itensCombos] = await pool.query(
          `
          SELECT ipc.qtd_combo, c.nome AS nome_combo, CAST(c.valor AS DECIMAL(10,2)) AS valor_combo
          FROM itenspedido_combo ipc
          JOIN combo c ON ipc.id_combo = c.id
          WHERE ipc.id_pedido = ?
        `,
          [pedido.id_pedido],
        )

        const combosComPreco = itensCombos.map((combo) => {
          const valorUnitario = Number.parseFloat(combo.valor_combo)
          const subtotalCalculado = valorUnitario * combo.qtd_combo

          return {
            nome_produto: combo.nome_combo,
            qtd_produto: combo.qtd_combo,
            valor: valorUnitario,
            subtotal: subtotalCalculado,
            tipo: "combo",
          }
        })

        return { ...pedido, itens: [...itensComPreco, ...combosComPreco] }
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

    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" })

    const [itens] = await pool.query(
      `
      SELECT 
        ip.id,
        ip.id_produto,
        ip.qtd_produto,
        pr.nome AS nome_produto,
        CAST(pr.valor AS DECIMAL(10,2)) AS valor_unitario_db,
        pr.categoria,
        pr.unidade
      FROM itenspedido ip
      JOIN produto pr ON ip.id_produto = pr.id
      WHERE ip.id_pedido = ?
    `,
      [id_pedido],
    )

    const itensProdutos = itens.map((item) => {
      const isLinguica = item.nome_produto.toLowerCase() === "linguiça"
      const isKg = item.unidade && item.unidade.toLowerCase() === "kg"

      const valorUnitario = Number.parseFloat(item.valor_unitario_db)
      let subtotalCalculado

      if (isLinguica) {
        subtotalCalculado = calcularPrecoLinguiça(item.qtd_produto)
      } else if (isKg) {
        subtotalCalculado = calcularPrecoKg(item.qtd_produto, valorUnitario)
      } else {
        subtotalCalculado = valorUnitario * item.qtd_produto
      }

      return {
        ...item,
        valor: valorUnitario,
        subtotal: subtotalCalculado,
        tipo: "produto",
      }
    })

    const [itensCombos] = await pool.query(
      `
      SELECT 
        ipc.id,
        ipc.id_combo,
        ipc.qtd_combo,
        c.nome AS nome_combo,
        CAST(c.valor AS DECIMAL(10,2)) AS valor_combo
      FROM itenspedido_combo ipc
      JOIN combo c ON ipc.id_combo = c.id
      WHERE ipc.id_pedido = ?
    `,
      [id_pedido],
    )

    const combos = itensCombos.map((combo) => {
      const valorUnitario = Number.parseFloat(combo.valor_combo)
      const subtotalCalculado = valorUnitario * combo.qtd_combo

      return {
        id: combo.id,
        id_combo: combo.id_combo,
        nome_produto: combo.nome_combo,
        qtd_produto: combo.qtd_combo,
        valor: valorUnitario,
        subtotal: subtotalCalculado,
        tipo: "combo",
      }
    })

    pedido.itens = [...itensProdutos, ...combos]

    res.json(pedido)
  } catch (error) {
    console.error("Erro ao buscar pedido:", error)
    res.status(500).json({ error: "Erro ao buscar pedido" })
  }
})

router.put("/:id/status", async (req, res) => {
  const id_pedido = req.params.id
  const { novoStatus } = req.body

  if (!novoStatus || isNaN(novoStatus)) return res.status(400).json({ error: "Status inválido" })

  try {
    const [result] = await pool.query("UPDATE pedido SET id_status = ? WHERE id = ?", [novoStatus, id_pedido])

    if (result.affectedRows === 0) return res.status(404).json({ error: "Pedido não encontrado" })

    const io = req.app.get("io")
    io.emit("pedido:status-atualizado", { id_pedido, novoStatus })

    res.json({ message: "Status atualizado com sucesso" })
  } catch (error) {
    console.error("Erro ao atualizar status do pedido:", error)
    res.status(500).json({ error: "Erro ao atualizar status do pedido" })
  }
})

router.put("/:id", async (req, res) => {
  const id_pedido = req.params.id
  const { id_cliente, tipo_entrega, observacao, id_status, produtos, combos } = req.body
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

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

    if ((produtos && Array.isArray(produtos)) || (combos && Array.isArray(combos))) {
      const [itensAntigos] = await conn.query("SELECT id_produto, qtd_produto FROM itenspedido WHERE id_pedido = ?", [
        id_pedido,
      ])

      for (const item of itensAntigos) {
        await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima + ? WHERE id = ?", [
          item.qtd_produto,
          item.id_produto,
        ])
      }

      const [combosAntigos] = await conn.query(
        "SELECT id_combo, qtd_combo FROM itenspedido_combo WHERE id_pedido = ?",
        [id_pedido],
      )

      for (const comboAntigo of combosAntigos) {
        const [produtosCombo] = await conn.query(
          `SELECT id_produto, quantidade FROM combo_produto WHERE id_combo = ?`,
          [comboAntigo.id_combo],
        )

        for (const prodCombo of produtosCombo) {
          const qtdRestaurar = prodCombo.quantidade * comboAntigo.qtd_combo
          await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima + ? WHERE id = ?", [
            qtdRestaurar,
            prodCombo.id_produto,
          ])
        }
      }

      await conn.query("DELETE FROM itenspedido WHERE id_pedido = ?", [id_pedido])
      await conn.query("DELETE FROM itenspedido_combo WHERE id_pedido = ?", [id_pedido])

      if (Array.isArray(produtos)) {
        for (const item of produtos) {
          const [[produto]] = await conn.query(
            "SELECT nome, quantidade_maxima, valor, unidade FROM produto WHERE id = ? FOR UPDATE",
            [item.id_produto],
          )

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

          await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima - ? WHERE id = ?", [
            item.qtd_produto,
            item.id_produto,
          ])

          await conn.query("INSERT INTO itenspedido (id_pedido, id_produto, qtd_produto) VALUES (?, ?, ?)", [
            id_pedido,
            item.id_produto,
            item.qtd_produto,
          ])
        }
      }

      if (Array.isArray(combos)) {
        for (const itemCombo of combos) {
          const [[combo]] = await conn.query("SELECT id, nome FROM combo WHERE id = ?", [itemCombo.id_combo])

          if (!combo) {
            await conn.rollback()
            return res.status(400).json({ error: `Combo com id ${itemCombo.id_combo} não encontrado.` })
          }

          const [produtosCombo] = await conn.query(
            `SELECT id_produto, quantidade, p.nome FROM combo_produto cp JOIN produto p ON cp.id_produto = p.id WHERE id_combo = ? FOR UPDATE`,
            [itemCombo.id_combo],
          )

          for (const prodCombo of produtosCombo) {
            const qtdNecessaria = prodCombo.quantidade * itemCombo.qtd_combo

            const [[prodEstoque]] = await conn.query("SELECT quantidade_maxima FROM produto WHERE id = ?", [
              prodCombo.id_produto,
            ])

            if (prodEstoque.quantidade_maxima < qtdNecessaria) {
              await conn.rollback()
              return res.status(400).json({
                error: `Estoque insuficiente para o combo ${combo.nome}. Produto ${prodCombo.nome} tem apenas ${prodEstoque.quantidade_maxima} unidades.`,
              })
            }

            await conn.query("UPDATE produto SET quantidade_maxima = quantidade_maxima - ? WHERE id = ?", [
              qtdNecessaria,
              prodCombo.id_produto,
            ])
          }

          await conn.query("INSERT INTO itenspedido_combo (id_pedido, id_combo, qtd_combo) VALUES (?, ?, ?)", [
            id_pedido,
            itemCombo.id_combo,
            itemCombo.qtd_combo,
          ])
        }
      }
    }

    await conn.commit()

    const io = req.app.get("io")
    io.emit("pedido:atualizado", { id_pedido })
    io.emit("produto:atualizado")

    res.json({ message: "Pedido atualizado com sucesso" })
  } catch (error) {
    await conn.rollback()
    console.error("Erro ao atualizar pedido:", error)
    res.status(500).json({ error: "Erro ao atualizar pedido" })
  } finally {
    conn.release()
  }
})

router.delete("/:id", async (req, res) => {
  const id_pedido = req.params.id
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    await conn.query("DELETE FROM itenspedido WHERE id_pedido = ?", [id_pedido])
    await conn.query("DELETE FROM itenspedido_combo WHERE id_pedido = ?", [id_pedido])

    const [result] = await conn.query("DELETE FROM pedido WHERE id = ?", [id_pedido])

    if (result.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ error: "Pedido não encontrado" })
    }

    await conn.commit()

    const io = req.app.get("io")
    io.emit("pedido:excluido", { id_pedido })

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
