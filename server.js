const express = require("express");
const path = require("path");
const brevo = require("@getbrevo/brevo");

const app = express();
const PORT = process.env.PORT || 3000;

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "Emerlog <no-reply@emerlog.eu>";
const MAIL_TO = process.env.MAIL_TO || "pawel.ruchlicki@emerlog.eu";

// Brevo auth (poprawne dla @getbrevo/brevo)
const defaultClient = brevo.ApiClient.instance;
if (BREVO_API_KEY) {
  defaultClient.authentications["api-key"].apiKey = BREVO_API_KEY;
}

const emailApi = new brevo.TransactionalEmailsApi();

// MW
app.use(express.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/test", (_req, res) => res.json({ ok: true }));

app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ ok: false, error: "Brak danych" });
    if (!BREVO_API_KEY) return res.status(500).json({ ok: false, error: "Brak BREVO_API_KEY" });

    const m = MAIL_FROM.match(/^(.*)<(.+)>$/);
    const senderName  = m ? m[1].trim() : MAIL_FROM;
    const senderEmail = m ? m[2].trim() : MAIL_FROM;

    const mail = new brevo.SendSmtpEmail();
    mail.sender = { name: senderName, email: senderEmail };
    mail.to = [{ email: MAIL_TO }];
    mail.subject = `Rozliczenie godzin – ${name}`;
    mail.htmlContent = `<p>W załączniku rozliczenie godzin.</p><p><b>${name}</b></p>`;
    mail.attachment = [{ name: "Tabela_Godzinowa.pdf", content: pdfData }]; // base64 bez prefixu

    await emailApi.sendTransacEmail(mail);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Brevo error:", e?.response?.text || e.message);
    res.status(500).json({ ok: false, error: "Błąd wysyłki" });
  }
});

app.listen(PORT, () => console.log(`🚀 Serwer działa na porcie ${PORT}`));
