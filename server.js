// server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Endpoint testowy
app.get("/test", (req, res) => {
  res.json({ message: "Serwer działa poprawnie!" });
});

// Endpoint: wysyłanie DOCX
app.post("/send-docx", async (req, res) => {
  try {
    const { name, docxData } = req.body;
    if (!name || !docxData) return res.status(400).json({ error: "Brak danych" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "pawel.ruchlicki@emerlog.eu",
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

    await transporter.sendMail(mailOptions);
    console.log("📤 Word wysłany!");
    res.json({ message: "DOCX wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki DOCX:", err);
    res.status(500).json({ error: "Błąd wysyłki DOCX" });
  }
});

// Endpoint: wysyłanie PDF
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;
    if (!name || !pdfData) return res.status(400).json({ error: "Brak danych" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "pawel.ruchlicki@emerlog.eu",
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

    await transporter.sendMail(mailOptions);
    console.log("📤 PDF wysłany!");
    res.json({ message: "PDF wysłany OK" });
  } catch (err) {
    console.error("❌ Błąd wysyłki PDF:", err);
    res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 Serwer działa na porcie ${PORT}`);
});
