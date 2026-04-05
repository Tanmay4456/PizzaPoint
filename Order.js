const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    name: String,
    phone: String,
    address: String
  },
  items: [
    {
      name: String,
      price: Number
    }
  ],
  total: Number,
  paymentType: String,
  status: {
    type: String,
    default: "Preparing"
  },
  date: Date
});

module.exports = mongoose.model("Order", orderSchema);