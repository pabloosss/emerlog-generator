const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

// Brevo (Sendinblue)
const brevo = require("@getbrevo/brevo");

const app = express();
const PORT = process.env.PORT || 3000;

// ENV
const BREVO_API_KEY = process.env.BREVO_API_KEY; // xkeysib-...
const MAIL_FROM = process.env.MAIL_FROM || "Emerlog <no-reply@emerlog.eu>";
const MAIL_TO = process.env.MAIL_TO || "pawel.ruchlicki@emerlog.eu";

// Brevo client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

// MW
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/test", (_req, res) => res.json({ ok: true }));

// wysyłka PDF (base64)
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ ok: false, error: "Brak danych" });
    if (!BREVO_API_KEY)  return res.status(500).json({ ok: false, error: "Brak BREVO_API_KEY" });

    const mail = new brevo.SendSmtpEmail();
    mail.sender = { name: MAIL_FROM.split("<")[0].trim(), email: (MAIL_FROM.match(/<(.+)>/)||[])[1] || MAIL_FROM };
    mail.to = [{ email: MAIL_TO }];
    mail.subject = `Rozliczenie godzin – ${name}`;
    mail.htmlContent = `<p>W załączniku rozliczenie godzin.</p><p>Pracownik: <b>${name}</b></p>`;
    mail.attachment = [
      {
        name: "Tabela_Godzinowa.pdf",
        content: pdfData,            // base64 bez prefixu
      },
    ];

    await apiInstance.sendTransacEmail(mail);
    console.log("📤 Brevo: wysłano do", MAIL_TO);
    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ Brevo error:", e?.response?.text || e.message);
    return res.status(500).json({ ok: false, error: "Błąd wysyłki" });
  }
});

app.listen(PORT, () => console.log(`🚀 Serwer działa na porcie ${PORT}`));
