const express = require("express");
const router = express.Router();
const axios = require("axios");

/* ================================
   SEND OTP
================================ */
router.post("/send", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number required",
      });
    }

    const response = await axios.post(
      "https://backend.aisensy.com/campaign/t1/api/v2",
      {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName: "otp_verification",
        destination: phone,
        userName: "SB Services User",
        templateParams: ["123456"], // static OTP for test
      }
    );

    res.json({
      success: true,
      message: "OTP Sent Successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("OTP Error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "OTP Send Failed",
    });
  }
});

module.exports = router;