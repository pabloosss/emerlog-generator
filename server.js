const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const mailDB = path.join(__dirname, "mailDB.json");

// --- Resend (HTTPS zamiast SMTP) ---
const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const EMAIL_TO = process.env.EMAIL_TO || "ewa.dusinska@emerlog.eu";
const REQUIRE_API_KEY = !!process.env.API_KEY;

// --- helpers ---
function logSentMail(name) {
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  const i = data.findIndex(e => e.name === name);
  if (i !== -1) data[i].sent = true;
  else data.push({ name, sent: true });
  fs.writeFileSync(mailDB, JSON.stringify(data, null, 2));
}
function auth(req, res, next) {
  if (!REQUIRE_API_KEY) return next();
  if (req.header("x-api-key") === process.env.API_KEY) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
async function sendViaResend({ subject, text, filename, base64 }) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    text,
    attachments: [{ filename, content: Buffer.from(base64, "base64") }],
  });
  if (error) throw error;
  return data;
}

// --- middleware ---
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

// --- endpoints ---
app.get("/test", (_req, res) => res.json({ message: "Serwer działa" }));

app.post("/send-pdf", auth, async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    await sendViaResend({
      subject: `Rozliczenie godzin (PDF) - ${name}`,
      text: "W załączniku PDF z harmonogramem.",
      filename: "harmonogram.pdf",
      base64: pdfData,
    });

    logSentMail(name);
    res.json({ message: "PDF wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki PDF:", err);
    res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

app.post("/send-docx", auth, async (req, res) => {
  try {
    const { name, docxData } = req.body;
    if (!name || !docxData) return res.status(400).json({ error: "Brak danych" });

    await sendViaResend({
      subject: `Rozliczenie godzin (DOCX) - ${name}`,
      text: "W załączniku DOCX z harmonogramem.",
      filename: "harmonogram.docx",
      base64: docxData,
    });

    logSentMail(name);
    res.json({ message: "DOCX wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki DOCX:", err);
    res.status(500).json({ error: "Błąd wysyłki DOCX" });
  }
});

// admin
app.get("/admin-data", (_req, res) => {
  if (fs.existsSync(mailDB)) {
    return res.json(JSON.parse(fs.readFileSync(mailDB, "utf8")));
  }
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
  if (!id) return res.status(400).send("Brak identyfikatora");
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  fs.writeFileSync(mailDB, JSON.stringify(data.filter(e => e.name !== id), null, 2));
  res.sendStatus(200);
});
app.post("/remove-all-users", (_req, res) => {
  fs.writeFileSync(mailDB, JSON.stringify([], null, 2));
  res.sendStatus(200);
});

// start
app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
