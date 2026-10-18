const express = require("express")
const app = express()
const cors = require("cors")
const db = require("./db")
const cookieParser = require("cookie-parser")
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8081 });

app.use(express.json())

app.use(cors({
    origin: "http://localhost:5173",
}))

app.use(cookieParser())

const PORT = 3000;

const routes = require('./src/rutas/index.js')
app.use("/", routes)

app.listen(PORT, () => {
    console.log('Escuchando en el puerto 3000')
})