// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// statics
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/test", (_, res) => res.json({ ok: true }));

// ====== Brevo SMTP (Sendinblue) ======
function brevoTransport() {
  return nodemailer.createTransport({
    host: "smtp-relay.sendinblue.com",
    port: 587,
    secure: false,
    auth: { user: "apikey", pass: process.env.BREVO_API_KEY },
  });
}

// ====== Wyślij PDF ======
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    const transporter = brevoTransport();

    await transporter.sendMail({
      from: process.env.MAIL_FROM, // np. "Emerlog Test <notingss@gmail.com>"
      to: "pawel.ruchlicki@emerlog.eu",
      subject: `Rozliczenie godzin – ${name}`,
      text: `W załączniku PDF z rozliczeniem godzin (${name}).`,
      attachments: [
        {
          filename: "rozliczenie.pdf",
          content: Buffer.from(pdfData, "base64"),
          contentType: "application/pdf",
        },
      ],
    });

    res.json({ ok: true, sent: "pawel.ruchlicki@emerlog.eu" });
  } catch (e) {
    console.error("❌ Błąd wysyłki PDF:", e);
    res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

app.listen(PORT, () => console.log(`🚀 Serwer na porcie ${PORT}`));
