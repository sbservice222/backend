// backend/routes/payment.js
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const router = express.Router();

// PhonePe Configuration
const PHONEPE_HOST_URL = "https://api.phonepe.com/apis/hermes";
const PHONEPE_APP_ID = "your_phonepe_app_id"; // Get from PhonePe dashboard
const PHONEPE_MERCHANT_ID = "your_merchant_id"; // Get from PhonePe dashboard
const PHONEPE_SALT_KEY = "your_salt_key"; // Get from PhonePe dashboard
const PHONEPE_SALT_INDEX = 1;

// Paytm Configuration
const PAYTM_MERCHANT_KEY = "your_paytm_merchant_key"; // Get from Paytm dashboard
const PAYTM_MERCHANT_ID = "your_paytm_merchant_id";
const PAYTM_WEBSITE = "your_paytm_website"; // e.g., "SBSERVICES"

// Google Pay (handled via Razorpay or direct)
const RAZORPAY_KEY_ID = "your_razorpay_key_id";
const RAZORPAY_KEY_SECRET = "your_razorpay_key_secret";

// ===== PHONEPE PAYMENT =====
router.post("/phonepe/initiate", async (req, res) => {
  try {
    const { amount, bookingId, customerId, customerPhone } = req.body;

    if (!amount || !bookingId || !customerId) {
      return res.json({ success: false, message: "Missing required fields" });
    }

    const merchantTransactionId = `TXN_${bookingId}_${Date.now()}`;
    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: customerId,
      amount: amount * 100, // Convert to paise
      redirectUrl: `${process.env.FRONTEND_URL || "https://bookcleanfix.com"}/payment-callback?gateway=phonepe&txnId=${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payment/phonepe/callback`,
      mobileNumber: customerPhone,
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    // Create X-VERIFY header
    const payloadString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadString).toString("base64");
    const xVerify =
      crypto
        .createHash("sha256")
        .update(payloadBase64 + "/pg/v1/pay" + PHONEPE_SALT_KEY)
        .digest("hex") + "###" + PHONEPE_SALT_INDEX;

    // Call PhonePe API
    const response = await axios.post(
      `${PHONEPE_HOST_URL}/pg/v1/pay`,
      {
        request: payloadBase64
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify
        }
      }
    );

    if (response.data.success) {
      return res.json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectUrl,
        transactionId: merchantTransactionId
      });
    } else {
      return res.json({ success: false, message: "PhonePe initiation failed" });
    }
  } catch (error) {
    console.error("PhonePe error:", error);
    res.json({ success: false, message: error.message });
  }
});

// PhonePe Callback
router.post("/phonepe/callback", async (req, res) => {
  try {
    const { transactionId } = req.body;

    // Verify transaction with PhonePe
    const xVerify =
      crypto
        .createHash("sha256")
        .update(`/pg/v1/status/${PHONEPE_MERCHANT_ID}/${transactionId}` + PHONEPE_SALT_KEY)
        .digest("hex") + "###" + PHONEPE_SALT_INDEX;

    const response = await axios.get(
      `${PHONEPE_HOST_URL}/pg/v1/status/${PHONEPE_MERCHANT_ID}/${transactionId}`,
      {
        headers: {
          "X-VERIFY": xVerify,
          "X-MERCHANT-ID": PHONEPE_MERCHANT_ID
        }
      }
    );

    if (response.data.success && response.data.code === "PAYMENT_SUCCESS") {
      // Update booking status in database
      const bookingId = transactionId.split("_")[1];
      updateBookingPayment(bookingId, "paid_phonepe", transactionId);

      return res.json({ success: true, message: "Payment verified" });
    } else {
      return res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("PhonePe callback error:", error);
    res.json({ success: false, message: error.message });
  }
});

// ===== PAYTM PAYMENT =====
router.post("/paytm/initiate", async (req, res) => {
  try {
    const { amount, bookingId, customerId, customerEmail, customerPhone } = req.body;

    const merchantTransactionId = `TXN_${bookingId}_${Date.now()}`;

    // Paytm parameters
    const paytmParams = {
      body: {
        requestType: "Payment",
        mid: PAYTM_MERCHANT_ID,
        websiteName: PAYTM_WEBSITE,
        orderId: merchantTransactionId,
        callbackUrl: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payment/paytm/callback`,
        txnAmount: {
          value: amount.toString(),
          currency: "INR"
        },
        userInfo: {
          custId: customerId,
          email: customerEmail,
          mobile: customerPhone
        }
      }
    };

    // Generate checksum
    const checksum = generatePaytmChecksum(paytmParams.body);
    paytmParams.head = {
      signature: checksum
    };

    // Call Paytm API to get payment URL
    const paytmResponse = await axios.post(
      "https://securegw.paytm.in/theia/api/v1/initiateTransaction",
      paytmParams,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    if (paytmResponse.data.body.resultInfo.resultStatus === "S") {
      const token = paytmResponse.data.body.txnToken;
      return res.json({
        success: true,
        token: token,
        mid: PAYTM_MERCHANT_ID,
        transactionId: merchantTransactionId,
        amount: amount
      });
    } else {
      return res.json({ success: false, message: "Paytm initiation failed" });
    }
  } catch (error) {
    console.error("Paytm error:", error);
    res.json({ success: false, message: error.message });
  }
});

// Paytm Callback
router.post("/paytm/callback", async (req, res) => {
  try {
    const paytmParams = req.body;
    const isValidChecksum = verifyPaytmChecksum(paytmParams);

    if (isValidChecksum && paytmParams.STATUS === "TXN_SUCCESS") {
      // Update booking status
      const bookingId = paytmParams.ORDERID.split("_")[1];
      updateBookingPayment(bookingId, "paid_paytm", paytmParams.TXNID);

      return res.json({ success: true, message: "Payment verified" });
    } else {
      return res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Paytm callback error:", error);
    res.json({ success: false, message: error.message });
  }
});

// ===== GOOGLE PAY (Via Razorpay) =====
router.post("/gpay/initiate", async (req, res) => {
  try {
    const { amount, bookingId, customerId, customerEmail, customerPhone } = req.body;

    const options = {
      amount: amount * 100, // Razorpay uses paise
      currency: "INR",
      receipt: `receipt_${bookingId}`,
      payment_capture: 1,
      notes: {
        bookingId: bookingId,
        customerId: customerId
      }
    };

    // Call Razorpay API
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      options,
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET
        }
      }
    );

    return res.json({
      success: true,
      orderId: response.data.id,
      amount: amount,
      currency: "INR",
      key: RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Razorpay error:", error);
    res.json({ success: false, message: error.message });
  }
});

// Razorpay Payment Verification
router.post("/gpay/verify", async (req, res) => {
  try {
    const { orderId, paymentId, signature, bookingId } = req.body;

    // Verify signature
    const shasum = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
    shasum.update(`${orderId}|${paymentId}`);
    const digest = shasum.digest("hex");

    if (digest === signature) {
      // Update booking
      updateBookingPayment(bookingId, "paid_gpay", paymentId);

      return res.json({
        success: true,
        message: "Payment verified successfully"
      });
    } else {
      return res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Razorpay verification error:", error);
    res.json({ success: false, message: error.message });
  }
});

// Helper function to update booking payment status
function updateBookingPayment(bookingId, paymentStatus, transactionId) {
  try {
    // If using database, update here
    // For now, we'll update localStorage via frontend
    console.log(`Booking ${bookingId} payment updated: ${paymentStatus}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating booking:", error);
    return { success: false };
  }
}

// Paytm Checksum Generation
function generatePaytmChecksum(params) {
  const paytmChecksum = require("paytmchecksum");
  return paytmChecksum.generateSignature(JSON.stringify(params), PAYTM_MERCHANT_KEY);
}

// Paytm Checksum Verification
function verifyPaytmChecksum(params) {
  const paytmChecksum = require("paytmchecksum");
  const checksum = params.CHECKSUMHASH;
  delete params.CHECKSUMHASH;
  return paytmChecksum.verifySignature(params, PAYTM_MERCHANT_KEY, checksum);
}

module.exports = router;
