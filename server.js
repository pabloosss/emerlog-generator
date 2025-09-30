const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const mailDB = path.join(__dirname, "mailDB.json");

// ===== helpers =====
function logSentMail(name) {
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  const i = data.findIndex(e => e.name === name);
  if (i !== -1) data[i].sent = true;
  else data.push({ name, sent: true });
  fs.writeFileSync(mailDB, JSON.stringify(data, null, 2));
}

// Optionalne sprawdzanie API key (jeśli ustawisz w env)
function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return next();
  const given = req.header("x-api-key");
  if (given && given === expected) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// ===== SMTP transporty =====
const transporter587 = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,          // STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,          // testemerlog2@gmail.com
    pass: process.env.EMAIL_PASS,          // hasło aplikacji BEZ spacji
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
  pool: true,
  maxConnections: 1,
});

const transporter465 = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,           // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
  pool: true,
  maxConnections: 1,
});

async function sendMailSmart(mailOptions) {
  try {
    await transporter587.verify();
    return await transporter587.sendMail(mailOptions);
  } catch (e1) {
    console.error("SMTP 587 error:", e1.code || e1.message);
    await transporter465.verify();
    return await transporter465.sendMail(mailOptions);
  }
}

// ===== middleware =====
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ===== endpoints =====
app.get("/test", (_req, res) => res.json({ message: "Serwer działa poprawnie!" }));

app.get("/smtp-check", async (_req, res) => {
  try {
    await transporter587.verify();
    return res.send("SMTP 587 OK");
  } catch (e1) {
    try {
      await transporter465.verify();
      return res.send("SMTP 465 OK");
    } catch (e2) {
      return res.status(500).send(`SMTP error: ${e1.code || e1} | ${e2.code || e2}`);
    }
  }
});

// wysyłka DOCX
app.post("/send-docx", requireApiKey, async (req, res) => {
  try {
    const { name, docxData } = req.body;
    if (!name || !docxData) return res.status(400).json({ error: "Brak danych" });

    const mailOptions = {
      from: process.env.EMAIL_USER,                // musi być ten sam co auth.user
      to: "ewa.dusinska@emerlog.eu",
      subject: `Rozliczenie godzin (DOCX) - ${name}`,
      text: "W załączniku przesyłamy plik Word z harmonogramem.",
      attachments: [
        {
          filename: "harmonogram.docx",
          content: Buffer.from(docxData, "base64"),
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ],
    };

    await sendMailSmart(mailOptions);
    logSentMail(name);
    res.json({ message: "DOCX wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki DOCX:", err);
    res.status(500).json({ error: "Błąd wysyłki DOCX" });
  }
});

// wysyłka PDF
app.post("/send-pdf", requireApiKey, async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "ewa.dusinska@emerlog.eu",
      subject: `Rozliczenie godzin (PDF) - ${name}`,
      text: "W załączniku przesyłamy plik PDF z harmonogramem.",
      attachments: [
        {
          filename: "harmonogram.pdf",
          content: Buffer.from(pdfData, "base64"),
          contentType: "application/pdf",
        },
      ],
    };

    await sendMailSmart(mailOptions);
    logSentMail(name);
    res.json({ message: "PDF wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki PDF:", err);
    res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

// admin data
app.get("/admin-data", (_req, res) => {
  if (fs.existsSync(mailDB)) return res.json(JSON.parse(fs.readFileSync(mailDB, "utf8")));
  return res.json([]);
});

app.post("/add-user", (req, res) => {
  const { name, manual } = req.body;
  if (!name) return res.status(400).send("Brak imienia");
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  if (!data.find(e => e.name === name)) {
    data.push({ name, sent: !!manual });
    fs.writeFileSync(mailDB, JSON.stringify(data, null, 2));
  }
  res.sendStatus(200);
});

app.post("/remove-user", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send("Brak identyfikatora użytkownika");
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  const newData = data.filter(e => e.name !== id);
  fs.writeFileSync(mailDB, JSON.stringify(newData, null, 2));
  res.sendStatus(200);
});

app.post("/remove-all-users", (_req, res) => {
  fs.writeFileSync(mailDB, JSON.stringify([], null, 2));
  res.sendStatus(200);
});

// start
app.listen(PORT, () => console.log(`🚀 Serwer działa na porcie ${PORT}`));
