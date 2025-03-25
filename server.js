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

// Endpoint do przyjmowania DOCX i wysyłania mailem
app.post("/send-docx", async (req, res) => {
  try {
    const { name, docxData } = req.body;

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    });

    let mailOptions = {
      from: process.env.EMAIL_USER,
      to: "pawel.ruchlicki@emerlog.eu",
      subject: `Rozliczenie godzin (DOCX) - ${name}`,
      text: "W załączniku przesyłamy plik Word z harmonogramem.",
      attachments: [
        {
          filename: "harmonogram.docx",
          content: Buffer.from(docxData, "base64"),
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log("Word wysłany!");
    return res.json({ message: "DOCX wysłany OK" });
  } catch (error) {
    console.error("Błąd wysyłki DOCX", error);
    return res.status(500).json({ error: "Błąd wysyłki DOCX" });
  }
});

// NOWY Endpoint do przyjmowania PDF i wysyłania mailem
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body; 
    // Klient musi wysłać body: { name, pdfData: "base64..." }

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    });

    let mailOptions = {
      from: process.env.EMAIL_USER,
      to: "pawel.ruchlicki@emerlog.eu",
      subject: `Rozliczenie godzin (PDF) - ${name}`,
      text: "W załączniku przesyłamy plik PDF z harmonogramem.",
      attachments: [
        {
          filename: "harmonogram.pdf",
          content: Buffer.from(pdfData, "base64"),
          contentType: "application/pdf"
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log("PDF wysłany!");
    return res.json({ message: "PDF wysłany OK" });
  } catch (error) {
    console.error("Błąd wysyłki PDF", error);
    return res.status(500).json({ error: "Błąd wysyłki PDF" });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
