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
app.use(bodyParser.json({ limit: "10mb" })); // Ustawiamy limit na duże PDFy

// Serwuj pliki statyczne (HTML, CSS, JS) z folderu "public"
app.use(express.static(path.join(__dirname, "public")));

// Prosty endpoint testowy - sprawdzenie, czy serwer działa
app.get("/test", (req, res) => {
  res.json({ message: "Serwer działa poprawnie!" });
});

// Endpoint do przyjmowania PDF i wysyłki mailem
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, pdfData } = req.body;

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
    });

    let mailOptions = {
      from: process.env.EMAIL_USER,
      to: "pawel.ruchlicki@emerlog.eu", // stały adres docelowy
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
    console.log("Mail wysłany!");
    return res.json({ message: "Mail wysłany OK" });
  } catch (error) {
    console.error("Błąd wysyłki maila", error);
    return res.status(500).json({ error: "Błąd wysyłki maila" });
  }
});

// Uruchom serwer
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
