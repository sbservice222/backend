const express = require("express");
const router = express.Router();
const AdminData = require("../models/AdminData");

/* =========================================
   🔐 ADMIN TOKEN (CHANGE THIS)
========================================= */
const ADMIN_TOKEN = "SB@9876#PRIVATE!TOKEN";

/* =========================================
   🔐 AUTH MIDDLEWARE
========================================= */
const checkAuth = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token || token.trim() !== ADMIN_TOKEN) {
    return res.status(403).json({ message: "Unauthorized ❌" });
  }

  next();
};

/* =========================================
   GET DATA (PUBLIC - NO TOKEN)
========================================= */
router.get("/data", async (req, res) => {
  try {
    let data = await AdminData.findOne();

    if (!data) {
      data = await AdminData.create({
        headerText: "Special Offer!",
        categories: [],
        services: [],
        coupons: [],
        socials: [],
        logos: [],
        waSubscribers: [],
        blogs: [],
        closedDates: []
      });
    }

    res.json(data);
  } catch (err) {
    console.error("GET ERROR:", err);
    res.status(500).json({ error: "Failed to load data" });
  }
});

/* =========================================
   SAVE DATA (PROTECTED 🔒)
========================================= */
router.post("/data", checkAuth, async (req, res) => {
  try {
    let data = await AdminData.findOne();

    if (!data) {
      data = new AdminData(req.body);
    } else {
      Object.assign(data, req.body);
    }

    await data.save();

    res.json({
      success: true,
      message: "Saved to MongoDB ✅"
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ error: "Failed to save" });
  }
});

module.exports = router;