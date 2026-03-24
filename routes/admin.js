const express = require("express");
const router = express.Router();

// TEMP MEMORY STORAGE (later MongoDB)
let adminData = {
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

/* =========================================
   GET ADMIN DATA
========================================= */
console.log("✅ Admin routes loaded");

router.get("/data", (req, res) => {
  res.json(adminData);
});

/* =========================================
   SAVE ADMIN DATA
========================================= */
router.post("/save", (req, res) => {
  try {
    adminData = { ...adminData, ...req.body };

    res.json({
      success: true,
      message: "Data saved successfully"
    });
  } catch (err) {
    console.error("Admin Save Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save data"
    });
  }
});

module.exports = router;