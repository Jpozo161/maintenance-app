// Punto de entrada: `npm start`.
const { port } = require("./src/config/env");
const { createApp } = require("./src/server");

createApp().listen(port, () => {
    console.log(`Escuchando en el puerto ${port}`);
});
