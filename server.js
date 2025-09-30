// server.js
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const fss = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const { z } = require("zod");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
const ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const mailDB = path.join(__dirname, "mailDB.json");

// --- helpers
const sanitizeName = (s) =>
  String(s).replace(/[\r\n]/g, "").replace(/[^\p{L}\p{N}\s.\-']/gu, "").trim().slice(0, 80);

async function readDB() {
  try { return JSON.parse(await fs.readFile(mailDB, "utf8")); } catch { return []; }
}
async function writeDB(data) {
  await fs.writeFile(mailDB, JSON.stringify(data, null, 2));
}
async function logSentMail(name, type) {
  const data = await readDB();
  const idx = data.findIndex((e) => e.name === name);
  const now = new Date().toISOString();
  if (idx !== -1) { data[idx].sent = true; data[idx].sentAt = now; data[idx].lastType = type; }
  else { data.push({ name, sent: true, sentAt: now, lastType: type }); }
  await writeDB(data);
}
const decodeBase64 = (b64) => { try { return Buffer.from(b64, "base64"); } catch { return null; } };
const isPdf = (buf) => buf && buf.slice(0, 4).toString() === "%PDF";
const isDocx = (buf) => buf && buf.slice(0, 2).toString() === "PK";

// --- security
app.use(helmet());
app.use(cors({ origin: ORIGIN === "*" ? true : ORIGIN, methods: ["GET", "POST"] }));
app.use(express.json({ limit: "30mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(rateLimit({ windowMs: 60_000, max: 60 }));

function requireApiKey(req, res, next) {
  if (!API_KEY) return res.status(500).json({ error: "Brak API_KEY" });
  const key = req.header("X-API-Key");
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// --- mailer (konto: testemerlog2@gmail.com + App Password)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  logger: true,
  debug: true,
});
transporter.verify()
  .then(() => console.log("SMTP OK"))
  .catch((e) => console.error("SMTP FAIL:", e.message));

// --- health + test
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/test", (_req, res) => res.json({ message: "Serwer działa poprawnie!" }));

// --- schemas
const SendPdfSchema = z.object({ name: z.string().min(1), pdfData: z.string().min(20) });
const SendDocxSchema = z.object({ name: z.string().min(1), docxData: z.string().min(20) });
const AddUserSchema = z.object({ name: z.string().min(1), manual: z.boolean().optional() });
const RemoveUserSchema = z.object({ id: z.string().min(1) });

// --- endpoints
app.post("/send-pdf", requireApiKey, async (req, res) => {
  try {
    const { name, pdfData } = SendPdfSchema.parse(req.body);
    const cleanName = sanitizeName(name);
    const buf = decodeBase64(pdfData);
    if (!buf || buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: "PDF niepoprawny lub zbyt duży" });
    if (!isPdf(buf)) return res.status(400).json({ error: "Nie wygląda na PDF" });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "ewa.dusinska@emerlog.eu",
      subject: `Rozliczenie godzin (PDF) - ${cleanName}`,
      text: "W załączniku plik PDF z harmonogramem.",
      attachments: [{ filename: `harmonogram_${cleanName}.pdf`, content: buf, contentType: "application/pdf" }],
    });

    await logSentMail(cleanName, "pdf");
    res.json({ ok: true });
  } catch (err) {
    console.error("send-pdf:", { code: err.code, response: err.response, message: err.message });
    res.status(400).json({ error: "Mail fail", code: err.code || "ERR" });
  }
});

app.post("/send-docx", requireApiKey, async (req, res) => {
  try {
    const { name, docxData } = SendDocxSchema.parse(req.body);
    const cleanName = sanitizeName(name);
    const buf = decodeBase64(docxData);
    if (!buf || buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: "DOCX niepoprawny lub zbyt duży" });
    if (!isDocx(buf)) return res.status(400).json({ error: "Nie wygląda na DOCX" });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "ewa.dusinska@emerlog.eu",
      subject: `Rozliczenie godzin (DOCX) - ${cleanName}`,
      text: "W załączniku plik Word z harmonogramem.",
      attachments: [{
        filename: `harmonogram_${cleanName}.docx`,
        content: buf,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }],
    });

    await logSentMail(cleanName, "docx");
    res.json({ ok: true });
  } catch (err) {
    console.error("send-docx:", { code: err.code, response: err.response, message: err.message });
    res.status(400).json({ error: "Mail fail", code: err.code || "ERR" });
  }
});

app.get("/admin-data", requireApiKey, async (_req, res) => res.json(await readDB()));

app.post("/add-user", requireApiKey, async (req, res) => {
  try {
    const { name, manual } = AddUserSchema.parse(req.body);
    const cleanName = sanitizeName(name);
    const data = await readDB();
    if (!data.find((e) => e.name === cleanName)) {
      data.push({ name: cleanName, sent: manual ? true : false, manuallyAdded: !!manual });
      await writeDB(data);
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Błąd walidacji" });
  }
});

app.post("/remove-user", requireApiKey, async (req, res) => {
  try {
    const { id } = RemoveUserSchema.parse(req.body);
    const cleanId = sanitizeName(id);
    const data = await readDB();
    await writeDB(data.filter((e) => e.name !== cleanId));
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Błąd walidacji" });
  }
});

app.post("/remove-all-users", requireApiKey, async (_req, res) => {
  await writeDB([]);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`🚀 Serwer na porcie ${PORT}`));
