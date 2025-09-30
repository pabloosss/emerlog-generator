const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const mailDB = path.join(__dirname, "mailDB.json");

// ===== Gmail API OAuth2 =====
const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,      // adres Gmail, z którego wysyłasz
  EMAIL_TO,        // docelowy adres odbiorcy
} = process.env;

const oAuth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob" // nie używamy redirectu w runtime
);
oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// ===== Helpers =====
function logSentMail(name) {
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  const i = data.findIndex((e) => e.name === name);
  if (i !== -1) data[i].sent = true;
  else data.push({ name, sent: true });
  fs.writeFileSync(mailDB, JSON.stringify(data, null, 2));
}

function base64Url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMime({ from, to, subject, text, attachments = [] }) {
  const boundary = "mime_boundary_" + Date.now();
  let parts = [];

  // text part
  parts.push(
    [
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      text || "",
      ``,
    ].join("\r\n")
  );

  // attachments
  for (const a of attachments) {
    const contentType =
      a.contentType ||
      (a.filename && a.filename.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/octet-stream");
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${contentType}; name="${a.filename}"`,
        `Content-Disposition: attachment; filename="${a.filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        a.base64, // już base64 z frontu
        ``,
      ].join("\r\n")
    );
  }

  // end boundary
  parts.push(`--${boundary}--`);

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
  ].join("\r\n");

  return headers + parts.join("\r\n");
}

async function sendViaGmail({ subject, text, attachments }) {
  const raw = buildMime({
    from: GMAIL_USER,
    to: EMAIL_TO,
    subject,
    text,
    attachments,
  });
  const rawB64Url = base64Url(raw);

  const resp = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: rawB64Url },
  });
  return resp.data;
}

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Health =====
app.get("/test", (_req, res) => {
  res.json({
    message: "Serwer działa",
    gmailConfigured: !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN && GMAIL_USER && EMAIL_TO),
  });
});

// ===== Wysyłka PDF =====
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    await sendViaGmail({
      subject: `Rozliczenie godzin (PDF) - ${name}`,
      text: "W załączniku PDF z harmonogramem.",
      attachments: [{ filename: "harmonogram.pdf", base64: pdfData, contentType: "application/pdf" }],
    });

    logSentMail(name);
    res.json({ message: "PDF wysłany OK" });
  } catch (err) {
    console.error("❌ Gmail API PDF error:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

// ===== Wysyłka DOCX =====
app.post("/send-docx", async (req, res) => {
  try {
    const { name, docxData } = req.body;
    if (!name || !docxData) return res.status(400).json({ error: "Brak danych" });

    await sendViaGmail({
      subject: `Rozliczenie godzin (DOCX) - ${name}`,
      text: "W załączniku DOCX z harmonogramem.",
      attachments: [
        {
          filename: "harmonogram.docx",
          base64: docxData,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ],
    });

    logSentMail(name);
    res.json({ message: "DOCX wysłany OK" });
  } catch (err) {
    console.error("❌ Gmail API DOCX error:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: "Błąd wysyłki DOCX" });
  }
});

// ===== Admin =====
app.get("/admin-data", (_req, res) => {
  if (fs.existsSync(mailDB)) return res.json(JSON.parse(fs.readFileSync(mailDB, "utf8")));
  return res.json([]);
});
app.post("/add-user", (req, res) => {
  const { name, manual } = req.body;
  if (!name) return res.status(400).send("Brak imienia");
  let data = [];
  if (fs.existsSync(mailDB)) data = JSON.parse(fs.readFileSync(mailDB, "utf8"));
  if (!data.find((e) => e.name === name)) {
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
  fs.writeFileSync(mailDB, JSON.stringify(data.filter((e) => e.name !== id), null, 2));
  res.sendStatus(200);
});
app.post("/remove-all-users", (_req, res) => {
  fs.writeFileSync(mailDB, JSON.stringify([], null, 2));
  res.sendStatus(200);
});

// ===== Start =====
app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
