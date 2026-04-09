const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new sqlite3.Database("database.db");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            content TEXT
        )
    `);
});

app.get("/", (req, res) => {
    db.all("SELECT * FROM messages", (err, rows) => {
        res.render("index", { messages: rows });
    });
});

app.post("/message", (req, res) => {
    const content = req.body.content;

    db.run(
        "INSERT INTO messages (username, content) VALUES (?, ?)",
        ["Anonym", content],
        () => {
            res.redirect("/");
        }
    );
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        function (err) {
            if (err) {
                return res.send("Brukernavn finnes allerede");
            }
            res.redirect("/login");
        }
    );
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, user) => {
            if (!user) {
                return res.send("Feil brukernavn");
            }

            const valid = await bcrypt.compare(password, user.password);

            if (!valid) {
                return res.send("Feil passord");
            }

            res.send("Innlogging vellykket");
        }
    );
});

app.post("/delete-user", (req, res) => {
    const username = req.body.username;

    db.run(
        "DELETE FROM users WHERE username = ?",
        [username],
        () => {
            res.send("Bruker slettet");
        }
    );
});

app.listen(3000, () => {
    console.log("Server kjører på http://localhost:3000");
});