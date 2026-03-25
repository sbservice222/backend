const express = require("express");
const router = express.Router();
const AdminData = require("../models/AdminData");

/* =========================================
   GET DATA
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
   SAVE DATA
========================================= */
router.post("/save", async (req, res) => {
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