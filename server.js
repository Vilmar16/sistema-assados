const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
})

const PORT = 3000

// Importa rotas
const clientesRoutes = require("./routes/clientes")
const produtosRoutes = require("./routes/produtos")
const pedidosRoutes = require("./routes/pedidos")
const pagamentosRoutes = require("./routes/pagamentos")
const comandasRoutes = require("./routes/comandas")
const combosRoutes = require("./routes/combos")

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.set("io", io)

// Rotas frontend
app.get("/", (req, res) => {
  res.redirect("/cadastro-pedido.html")
})

// Usa rotas
app.use("/clientes", clientesRoutes)
app.use("/produtos", produtosRoutes)
app.use("/pedidos", pedidosRoutes)
app.use("/pagamentos", pagamentosRoutes)
app.use("/comandas", comandasRoutes)
app.use("/combos", combosRoutes)

io.on("connection", (socket) => {
  console.log("✅ Cliente conectado:", socket.id)

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`)
  console.log(`✅ Socket.IO ativo`)
})

module.exports = { app, io }
