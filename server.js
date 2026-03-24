require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
const checksum_lib = require("paytmchecksum");
const mongoose = require("mongoose");
const adminRoutes = require("./routes/admin");

/* =====================================================
   CREATE EXPRESS APP
===================================================== */
const app = express();

/* =====================================================
   MIDDLEWARES
===================================================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/admin", adminRoutes);

/* =====================================================
   DATABASE CONNECTION (MongoDB Atlas)
===================================================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

/* =====================================================
   ROUTES IMPORT
===================================================== */
const authRoutes = require("./routes/auth");
const otpRoutes = require("./routes/otp");

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

/* =====================================================
   HEALTH CHECK ROUTE
===================================================== */
app.get("/", (req, res) => {
  res.json({ message: "🚀 SB Services Backend Running" });
});

/* =====================================================
   PHONEPE PAYMENT INITIATE
===================================================== */
app.post("/api/payment/phonepe/initiate", async (req, res) => {
  try {
    const { amount, customerId, customerPhone } = req.body;

    const merchantTransactionId = `SB${Date.now()}`;

    const payload = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: customerId,
      amount: amount * 100,
      redirectUrl: `${req.headers.origin}/payment/success?txn=${merchantTransactionId}`,
      redirectMode: "POST",
      mobileNumber: customerPhone,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const base64Body = Buffer.from(JSON.stringify(payload)).toString("base64");

    const checksum =
      crypto
        .createHash("sha256")
        .update(base64Body + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY)
        .digest("hex") +
      "###" +
      process.env.PHONEPE_SALT_INDEX;

    const phonepeRes = await axios.post(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
      { request: base64Body },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
          "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
        },
      }
    );

    res.json({
      success: true,
      redirectUrl:
        phonepeRes.data?.data?.instrumentResponse?.redirectInfo?.url,
      transactionId: merchantTransactionId,
    });
  } catch (error) {
    console.error("PhonePe Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "PhonePe Payment Failed",
    });
  }
});

/* =====================================================
   PHONEPE STATUS CHECK
===================================================== */
app.get("/api/payment/phonepe/status/:txnId", async (req, res) => {
  try {
    const { txnId } = req.params;

    const base64Body = Buffer.from(
      JSON.stringify({
        merchantId: process.env.PHONEPE_MERCHANT_ID,
        merchantTransactionId: txnId,
      })
    ).toString("base64");

    const checksum =
      crypto
        .createHash("sha256")
        .update(
          base64Body +
            "/pg/v1/status/" +
            txnId +
            process.env.PHONEPE_SALT_KEY
        )
        .digest("hex") +
      "###" +
      process.env.PHONEPE_SALT_INDEX;

    const response = await axios.get(
      `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${txnId}`,
      {
        headers: {
          "X-VERIFY": checksum,
          "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
        },
      }
    );

    res.json({ success: true, status: response.data });
  } catch (error) {
    console.error("PhonePe Status Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Status Check Failed",
    });
  }
});

/* =====================================================
   PAYTM PAYMENT INITIATE
===================================================== */
app.post("/api/payment/paytm/initiate", (req, res) => {
  const { amount, customerEmail, customerPhone } = req.body;

  const orderId = `SB${Date.now()}`;

  const paytmParams = {
    MID: process.env.PAYTM_MID,
    ORDERID: orderId,
    CUST_ID: customerEmail,
    EMAIL: customerEmail,
    MOBILE_NO: customerPhone,
    TXN_AMOUNT: amount.toString(),
    CHANNEL_ID: "WEB",
    WEBSITE: process.env.PAYTM_WEBSITE,
    INDUSTRY_TYPE_ID: "Retail48",
    CALLBACK_URL: `${req.headers.origin}/payment/success?txn=${orderId}`,
  };

  checksum_lib.genchecksum(
    paytmParams,
    process.env.PAYTM_MKEY,
    (err, checksum) => {
      if (err) {
        return res.status(500).json({ success: false, message: err });
      }

      paytmParams.CHECKSUMHASH = checksum;

      res.json({
        success: true,
        paytmParams,
      });
    }
  );
});

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

/* =====================================================
   START SERVER
===================================================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
