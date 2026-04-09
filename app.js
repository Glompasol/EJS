const path = require("path");
const express = require("express");
const { resolve } = require("dns");
const { rejects } = require("assert");
const { title } = require("process");
const sqlite3 = require("sqlite3").verbose();
const app = express();

const port = 7270;

const db = new sqlite3.Database(path.join(__dirname, "app.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      listened_date TEXT NOT NULL
    )
  `)
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({extended: true}));

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

app.get("/", async (req, res) => {
  try {
    const songs = await dbAll(
      "SELECT id, title, artist, listened_date FROM songs ORDER BY listened_date DESC, id DESC",
      []
    );
    res.render("index", {title: "Registrer sanger", songs, message: null});
  } catch (err) {
    console.error(err);
    res.status(500).send("Noe gikk galt.");
  }
});

app.post("/songs", async(req, res) => {
  try {
    const {title, artist, listened_date} = req.body;
    if (!title || !artist || !listened_date) {
      const songs = await dbAll("SELECT id, title, artist, listened_date FROM songs ORDER BY listened_date DESC, id DESC");
      return res.status(400).render("index", {title: "Registrer sanger", songs, message: "Fyll ut tittel, artist og dato"});
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(listened_date)) {
      const songs = await dbAll("SELECT id, title, artist, listened_date FROM songs ORDER BY listened_date DESC, id DESC");
      return res.status(400).render("index", {title: "Registrer sanger", songs, message: "2009/08/25"});
    }
    await dbRun(
      "INSERT INTO songs (title, artist, listened_date) VALUES (?, ?, ?)",
      [title.trim(), artist.trim(), listened_date]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
    const songs = await dbAll("SELECT id, title, artist, listened_date FROM songs ORDER BY listened_date DESC, id, DESC");
    res.status(500).render("index", {title:"Registrer sanger", songs, message:"Kunne ikke lagre sangen"});
  }
});

app.listen(PROTOCOL, () => {
  console.log(`Server kjører på http://localhost:${PORT}`);
});