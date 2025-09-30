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

// ===== SMTP (Gmail, hasło aplikacji) =====
const common = {
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
  pool: true,
  maxConnections: 1,
};

const transporter587 = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  ...common,
});

const transporter465 = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  ...common,
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

// ===== diagnostics =====
app.get("/smtp-check", async (_req, res) => {
  try { await transporter587.verify(); return res.send("SMTP 587 OK"); }
  catch (e1) {
    try { await transporter465.verify(); return res.send("SMTP 465 OK"); }
    catch (e2) { return res.status(500).send(`SMTP error: ${e1.code||e1} | ${e2.code||e2}`); }
  }
});

// ===== endpoints =====
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    await sendMailSmart({
      from: process.env.EMAIL_USER,                 // ten sam co auth.user
      to: process.env.EMAIL_TO || "ewa.dusinska@emerlog.eu",
      subject: `Rozliczenie godzin (PDF) - ${name}`,
      text: "W załączniku PDF z harmonogramem.",
      attachments: [{ filename: "harmonogram.pdf", content: Buffer.from(pdfData, "base64"), contentType: "application/pdf" }],
    });

    logSentMail(name);
    res.json({ message: "PDF wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki PDF:", err);
    res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

app.post("/send-docx", async (req, res) => {
  try {
    const { name, docxData } = req.body;
    if (!name || !docxData) return res.status(400).json({ error: "Brak danych" });

    await sendMailSmart({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO || "ewa.dusinska@emerlog.eu",
      subject: `Rozliczenie godzin (DOCX) - ${name}`,
      text: "W załączniku DOCX z harmonogramem.",
      attachments: [{
        filename: "harmonogram.docx",
        content: Buffer.from(docxData, "base64"),
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }],
    });

    logSentMail(name);
    res.json({ message: "DOCX wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki DOCX:", err);
    res.status(500).json({ error: "Błąd wysyłki DOCX" });
  }
});

// ===== start =====
app.listen(PORT, () => console.log(`🚀 Serwer działa na porcie ${PORT}`));
