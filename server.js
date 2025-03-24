// server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware z dużym limitem
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Folder publiczny
app.use(express.static(path.join(__dirname, "public")));

// Endpoint testowy
app.get("/test", (req, res) => {
  res.json({ message: "Serwer działa poprawnie!" });
});

// Endpoint do wysyłki PDF
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "pawel.ruchlicki@emerlog.eu",
      subject: `Rozliczenie godzin dla: ${name}`,
      text: "W załączniku przesyłamy PDF z harmonogramem.",
      attachments: [
        {
          filename: "harmonogram.pdf",
          content: Buffer.from(pdfData, "base64"),
          contentType: "application/pdf"
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Mail wysłany!");
    res.json({ message: "Mail wysłany OK" });
  } catch (error) {
    console.error("❌ Błąd wysyłki maila:", error);
    res.status(500).json({ error: "Błąd wysyłki maila" });
  }
});

// Uruchom serwer
app.listen(PORT, () => {
  console.log(`🚀 Serwer działa na porcie ${PORT}`);
});
