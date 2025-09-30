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

// --- Resend ---
const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM;                 // np. onboarding@resend.dev lub no-reply@twojadomena.pl
const EMAIL_TO = process.env.EMAIL_TO || "ewa.dusinska@emerlog.eu";

// --- utils ---
function ensureEnv(res) {
  if (!process.env.RESEND_API_KEY || !EMAIL_FROM || !EMAIL_TO) {
    return res.status(500).json({ error: "Brak konfiguracji e-mail (ENV)." });
  }
}
function logSentMail(name) {
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  const i = data.findIndex(e => e.name === name);
  if (i !== -1) data[i].sent = true;
  else data.push({ name, sent: true });
  fs.writeFileSync(mailDB, JSON.stringify(data, null, 2));
}
async function sendViaResend({ subject, text, filename, base64 }) {
  const payload = {
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    text,
    attachments: filename && base64 ? [{ filename, content: Buffer.from(base64, "base64") }] : [],
  };
  const { data, error } = await resend.emails.send(payload);
  if (error) throw error;
  return data;
}

// --- middleware ---
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

// --- health/debug ---
app.get("/test", (_req, res) => res.json({ ok: true }));
app.get("/debug/mail", async (_req, res) => {
  try {
    if (ensureEnv(res)) return;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM, to: EMAIL_TO, subject: "Test Resend", text: "Ping"
    });
    if (error) return res.status(500).send(error.message || String(error));
    res.json({ id: data?.id || null });
  } catch (e) {
    res.status(500).send(e.message || String(e));
  }
});

// --- send PDF ---
app.post("/send-pdf", async (req, res) => {
  try {
    if (ensureEnv(res)) return;
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    await sendViaResend({
      subject: `Rozliczenie godzin (PDF) - ${name}`,
      text: "W załączniku PDF z harmonogramem.",
      filename: "harmonogram.pdf",
      base64: pdfData
    });

    logSentMail(name);
    res.json({ message: "PDF wysłany OK" });
  } catch (err) {
    console.error("Resend PDF error:", err?.statusCode, err?.message);
    res.status(500).json({ error: "Błąd wysyłki PDF", detail: err?.message || String(err) });
  }
});

// --- send DOCX ---
app.post("/send-docx", async (req, res) => {
  try {
    if (ensureEnv(res)) return;
    const { name, docxData } = req.body;
    if (!name || !docxData) return res.status(400).json({ error: "Brak danych" });

    await sendViaResend({
      subject: `Rozliczenie godzin (DOCX) - ${name}`,
      text: "W załączniku DOCX z harmonogramem.",
      filename: "harmonogram.docx",
      base64: docxData
    });

    logSentMail(name);
    res.json({ message: "DOCX wysłany OK" });
  } catch (err) {
    console.error("Resend DOCX error:", err?.statusCode, err?.message);
    res.status(500).json({ error: "Błąd wysyłki DOCX", detail: err?.message || String(err) });
  }
});

// --- admin ---
app.get("/admin-data", (_req, res) => {
  if (fs.existsSync(mailDB)) return res.json(JSON.parse(fs.readFileSync(mailDB, "utf8")));
  res.json([]);
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

app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
