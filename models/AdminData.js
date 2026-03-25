const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  headerText: String,
  categories: Array,
  services: Array,
  coupons: Array,
  socials: Array,
  logos: Array,
  waSubscribers: Array,
  blogs: Array,
  closedDates: Array
});

module.exports = mongoose.model("AdminData", AdminSchema);