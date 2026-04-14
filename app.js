const express = require("express"); //basic routing (log in)
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt"); //passkey hash
const session = require("express-session"); //keeps user logged in

const app = express();

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true })); //read post requests
app.use(express.static("public")); //use static

app.use(session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, //no https support
        httpOnly: true //prevents client side scripts
    }
}));

const db = new sqlite3.Database("database.db"); //create db

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
            channel TEXT,
            timestamp TEXT
        )
    `);


});

//block route
function requireLogin(req, res, next) { 
    if (!req.session.user) return res.redirect("/login"); 
    next();
}

app.get("/", (req, res) => res.redirect("/channel/general")); //redirect

app.get("/channel/:name", (req, res) => { //:name is dynamic
    const channel = req.params.name;

    db.all("SELECT * FROM messages WHERE channel = ?", [channel], (err, rows) => { //fetch message
        //sends data to index
        res.render("index", {
            messages: rows || [],
            channel,
            user: req.session.user || null,
            onlineUsers: req.session.user ? [req.session.user.username] : [] //online status(fake)
        });
    });
});

app.post("/message", requireLogin, (req, res) => { //must be logged in
    let { content, channel } = req.body; //get message + channel

    //trim for clean input
    content = content?.trim();
    channel = channel?.trim() || "general";

    if (!content) return res.redirect("/channel/" + channel);

    //create timestamp
    const timestamp = new Date().toLocaleTimeString("no-NO", {
        hour: "2-digit",
        minute: "2-digit"
    });

    //stores everything into db
    db.run(
        "INSERT INTO messages (username, content, channel, timestamp) VALUES (?, ?, ?, ?)",
        [req.session.user.username, content, channel, timestamp],
        () => res.redirect("/channel/" + channel) //show changes
    );
});

app.post("/delete-message/:id", requireLogin, (req, res) => { //must be logged in
    const id = req.params.id;

    db.get("SELECT * FROM messages WHERE id = ?", [id], (err, msg) => { //fetches the message from db
        if (!msg || msg.username !== req.session.user.username) { //only the owner can delete
            return res.send("Ikke lov");
        }

        db.run("DELETE FROM messages WHERE id = ?", [id], () => { //deletes message
            res.redirect("/channel/" + msg.channel); //show changes
        });
    });
});

app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send("Fyll inn alt");

    const hash = await bcrypt.hash(password, 10); //hash password

    //insert hashed password into db
    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hash],
        (err) => { 
            if (err) return res.send("Brukernavn tatt"); //username must be unique
            res.redirect("/login");
        }
    );
});

app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => { //find user
        if (!user) return res.send("Feil brukernavn eller passord"); //wrong username

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.send("Feil brukernavn eller passord"); //wrong password

        req.session.user = { username: user.username }; //user confirmed
        res.redirect("/channel/general"); //redirects to main page
    });
});

app.get("/settings", (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    res.render("settings", { user: req.session.user });
});

//stores only in session (no db save)
app.post("/settings", (req, res) => {
    const { fontSize, theme, lineHeight, contrast, nameColor, sidebar } = req.body;

    req.session.user = {
        ...req.session.user,
        fontSize,
        theme,
        lineHeight,
        contrast,
        nameColor,
        sidebar
    };

    res.redirect("/");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login")); //detroys session and logs out
});

app.listen(3000, () => console.log("http://localhost:3000"));