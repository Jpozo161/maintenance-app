const mysql = require('mysql2')

const connection = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: "root",
    password: "12345678",
    database: "mantenimiento"
})


connection.connect((error) => {
    if(error) {
        console.log(error)
        return;
    }
    console.log("connected to the DB ")
})

module.exports = connection;
