const express = require("express");
const router = express.Router();

// GLOBAL STORAGE
let siteData = {
  headerText: "Special Offer!",
  categories: [],
  services: [],
  coupons: [],
  socials: [],
  logos: [],
  waSubscribers: [],
  blogs: [],
  closedDates: []
};

// GET DATA
router.get("/data", (req, res) => {
  res.json(siteData);
});

// SAVE DATA
router.post("/data", (req, res) => {
  siteData = req.body;
  console.log("✅ Data updated:", siteData);
  res.json({ success: true });
});

module.exports = router;