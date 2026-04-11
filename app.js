const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // ← important safety
app.use(express.static("public"));

app.use(session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // IMPORTANT (true breaks on localhost)
        httpOnly: true
    }
}));

const db = new sqlite3.Database("database.db", (err) => {
    if (err) console.error("DB ERROR:", err);
    else console.log("Connected to database");
});

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
    if (!req.session.user) {
        console.log("Not logged in");
        return res.redirect("/login");
    }
    next();
}

app.get("/", (req, res) => res.redirect("/channel/general"));

app.get("/channel/:name", (req, res) => {
    const channel = req.params.name;
    console.log("Fetching messages for:", channel);

    db.all("SELECT * FROM messages WHERE channel = ?", [channel], (err, rows) => {
        if (err) console.error(err);

        res.render("index", {
            messages: rows || [],
            channel: channel,
            user: req.session.user || null
        });
    });
});

app.post("/message", (req, res) => {
    console.log("POST /message HIT");
    console.log("SESSION:", req.session);

    if (!req.session.user) {
        console.log("SESSION LOST");
        return res.redirect("/login");
    }

    let { content, channel } = req.body;

    content = content?.trim();
    channel = channel?.trim() || "general";

    if (!content) {
        return res.redirect("/channel/" + channel);
    }

    console.log("Saving:", content, "→", channel);

    db.run(
        "INSERT INTO messages (username, content, channel) VALUES (?, ?, ?)",
        [req.session.user.username, content, channel],
        function (err) {
            if (err) {
                console.error("DB ERROR:", err.message);
                return res.send("Database error: " + err.message);
            }

            console.log("Saved with ID:", this.lastID);
            res.redirect("/channel/" + channel);
        }
    );
});

app.post("/delete-message/:id", requireLogin, (req, res) => {
    const id = req.params.id;

    db.get("SELECT * FROM messages WHERE id = ?", [id], (err, msg) => {
        if (!msg || msg.username !== req.session.user.username) {
            return res.send("Ikke lov");
        }

        db.run("DELETE FROM messages WHERE id = ?", [id], () => {
            res.redirect("back");
        });
    });
});

app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send("Fyll inn alt");

    const hash = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hash],
        (err) => {
            if (err) return res.send("Brukernavn tatt");
            res.redirect("/login");
        }
    );
});

app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user) return res.send("Feil brukernavn eller passord");

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.send("Feil brukernavn eller passord");

        req.session.user = { username: user.username };
        console.log("Logged in:", user.username);

        res.redirect("/channel/general");
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

app.get("/debug-session", (req, res) => {
    res.send(req.session);
});

app.listen(2000, () => console.log("http://localhost:2000"));

