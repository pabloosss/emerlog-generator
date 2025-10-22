// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ====== KONFIG ======
const MAIL_TO = "pawel.ruchlicki@emerlog.eu"; // adres docelowy
const MAIL_FROM_RAW = process.env.MAIL_FROM || "Emerlog <no-reply@emerlog.eu>";
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_API || "";

// proste rozbicie "Nazwa <email>" -> {name,email}
function parseFrom(raw) {
  const m = /^(.*)<([^>]+)>$/.exec(raw);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: raw, email: raw };
}
const SENDER = parseFrom(MAIL_FROM_RAW);

// ====== MIDDLEWARE ======
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ====== HEALTH ======
app.get("/test", (_req, res) => res.json({ ok: true }));

// ====== WYSYŁKA PDF przez Brevo REST ======
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body || {};
    if (!name || !pdfData) return res.status(400).json({ ok: false, error: "Brak danych" });
    if (!BREVO_API_KEY) return res.status(500).json({ ok: false, error: "Brak BREVO_API_KEY" });

    const payload = {
      sender: { name: SENDER.name, email: SENDER.email },
      to: [{ email: MAIL_TO, name: "Paweł Ruchlicki" }],
      subject: `Rozliczenie godzin – ${name}`,
      htmlContent:
        `<p>Dzień dobry,<br> w załączniku rozliczenie godzin dla <b>${name}</b>.</p>` +
        `<p>Pozdrawiamy,<br>Emerlog</p>`,
      attachment: [
        {
          name: "harmonogram.pdf",
          content: pdfData // Base64 (bez prefixu data:)
        }
      ]
    };

    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Brevo error:", resp.status, data);
      return res.status(502).json({ ok: false, error: data?.message || "BREVO_FAILED" });
    }
    res.json({ ok: true, messageId: data?.messageId || null });
  } catch (e) {
    console.error("❌ send-pdf error:", e);
    res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// ====== START ======
app.listen(PORT, () => {
  console.log(`🚀 Serwer działa na porcie ${PORT}`);
});
