const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: false
}));

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
            content TEXT,
            channel TEXT
        )
    `);
});

function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect("/login");
    next();
}

app.get("/", (req, res) => res.redirect("/channel/general"));

app.get("/channel/:name", (req, res) => {
    const channel = req.params.name;

    db.all("SELECT * FROM messages WHERE channel = ?", [channel], (err, rows) => {
        res.render("index", {
            messages: rows || [],
            channel: channel,
            user: req.session.user || null
        });
    });
});

app.post("/message", requireLogin, (req, res) => {
    const { content, channel } = req.body;
    if (!content || !channel) return res.redirect("/"); // fallback

    db.run(
        "INSERT INTO messages (username, content, channel) VALUES (?, ?, ?)",
        [req.session.user.username, content, channel],
        (err) => {
            res.redirect("/channel/" + channel);
        }
    );
});

app.post("/delete-message/:id", requireLogin, (req, res) => {
    const id = req.params.id;

    db.get("SELECT * FROM messages WHERE id = ?", [id], (err, msg) => {
        if (!msg || msg.username !== req.session.user.username) return res.send("Ikke lov");
        db.run("DELETE FROM messages WHERE id = ?", [id], () => res.redirect("back"));
    });
});

app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send("Fyll inn alt");

    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (err) => {
        if (err) return res.send("Brukernavn tatt");
        res.redirect("/login");
    });
});

app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send("Fyll inn alt");

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user) return res.send("Feil brukernavn eller passord");
        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.send("Feil brukernavn eller passord");

        req.session.user = { username: user.username };
        res.redirect("/channel/general");
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

app.listen(8000, () => console.log("http://localhost:8000"));