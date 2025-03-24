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
app.use(bodyParser.json({ limit: "10mb" })); // obsługa JSON z limitem 10mb
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" })); // obsługa urlencoded (fallback/form)

app.use(express.static(path.join(__dirname, "public"))); // folder publiczny

// Test endpoint
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
    console.log("Mail wysłany!");
    return res.json({ message: "Mail wysłany OK" });
  } catch (error) {
    console.error("Błąd wysyłki maila", error);
    return res.status(500).json({ error: "Błąd wysyłki maila" });
  }
});

// Start serwera
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
