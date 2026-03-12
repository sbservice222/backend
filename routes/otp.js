router.get("/test", (req, res) => {
  res.json({ message: "OTP API working" });
});
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Otp = require("../models/Otp");

// SEND OTP
router.post("/send", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number required"
      });
    }

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to DB
    await Otp.create({
      phone,
      otp: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    // Send via AISensy
    await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName: "otp_verification",
        destination: phone,
        userName: "SB Services",
        templateParams: [otpCode]
      }
    );

    res.json({
      success: true,
      message: "OTP Sent Successfully"
    });

  } catch (error) {
    console.error("OTP ERROR:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "OTP Send Failed"
    });
  }
});

// VERIFY OTP
router.post("/verify", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const record = await Otp.findOne({
      phone,
      otp,
      expiresAt: { $gt: Date.now() }
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Invalid or Expired OTP"
      });
    }

    res.json({
      success: true,
      message: "OTP Verified Successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "OTP Verification Failed"
    });
  }
});

module.exports = router;
