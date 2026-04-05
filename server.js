require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Razorpay = require("razorpay");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

/* ================== DATABASE ================== */
mongoose.connect("process.env.MONGO_URI")
.then(() => console.log("MongoDB Atlas Connected ✅"))
.catch(err => console.log("MongoDB Error ❌", err));

/* ================== MODEL ================== */
const Order = require("./models/Order");

/* ================== RAZORPAY ================== */
const razorpay = new Razorpay({
  key_id: "process.env.RAZORPAY_KEY",
  key_secret: "process.env.RAZORPAY_SECRET"
});

/* ================== TEMP STORAGE ================== */
let users = [];
let carts = {};

/* ================== AUTH ================== */
// SIGNUP
app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;

  const userExists = users.find(u => u.email === email);
  if (userExists) {
    return res.json({ msg: "User already exists" });
  }

  const user = { name, email, password };
  users.push(user);

  res.json({ msg: "Signup success" });
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email && u.password === password);

  if (user) res.json(user);
  else res.json({ msg: "Invalid credentials" });
});

/* ================== CART ================== */
// ADD TO CART
app.post("/add-to-cart", (req, res) => {
  const { email, product } = req.body;

  if (!carts[email]) carts[email] = [];
  carts[email].push(product);

  res.json({ msg: "Added to cart" });
});

// GET CART
app.get("/cart/:email", (req, res) => {
  res.json(carts[req.params.email] || []);
});

/* ================== PAYMENT ================== */
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR"
    });

    res.json(order);
  } catch (err) {
    console.log("RAZORPAY ERROR ❌", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

/* ================== PLACE ORDER ================== */
app.post("/place-order", async (req, res) => {
  try {
    const { name, phone, address, items, total, paymentType, email } = req.body;

    // ✅ VALIDATION
    if (!name || !phone || !address || !items || !total) {
      return res.status(400).json({ message: "All fields required" });
    }

    // ✅ SAVE ORDER
    const newOrder = await Order.create({
      user: {
        name,
        phone,
        address,
        email
      },
      items,
      total,
      paymentType: paymentType || "COD",
      status: "Preparing 🍳",
      date: new Date()
    });

    // ✅ AUTO STATUS UPDATE
    setTimeout(async () => {
      await Order.findByIdAndUpdate(newOrder._id, { status: "Out for delivery 🚴" });
    }, 10000);

    setTimeout(async () => {
      await Order.findByIdAndUpdate(newOrder._id, { status: "Delivered ✅" });
    }, 20000);

    // ================= EMAIL =================
    const orderText = `
🍕 NEW ORDER

Customer: ${name}
Phone: ${phone}
Address: ${address}

Payment: ${paymentType}

Items:
${items.map(i => `${i.name} - ₹${i.price}`).join("\n")}

Total: ₹${total}
`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "process.env.EMAIL_USER",
        pass: "process.env.EMAIL_PASS"
      }
    });

    try {
      await transporter.sendMail({
        from: "process.env.EMAIL_USER",
        to: "process.env.EMAIL_USER",
        subject: "New Pizza Order 🍕",
        text: orderText
      });

      console.log("EMAIL SENT ✅");
    } catch (emailErr) {
      console.log("EMAIL ERROR ❌", emailErr);
    }

    // ✅ SINGLE RESPONSE (IMPORTANT)
    res.json({
      success: true,
      orderId: newOrder._id
    });

  } catch (err) {
    console.log("ORDER ERROR ❌", err);
    res.status(500).json({ success: false });
  }
});

/* ================== GET ORDER ================== */


app.get("/get-order/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // 🔥 FIX 1: Check undefined string
    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Invalid Order ID" });
    }

    // 🔥 FIX 2: Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ObjectId format" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);

  } catch (err) {
    console.log("GET ORDER ERROR ❌", err);
    res.status(500).json({ message: "Error fetching order" });
  }
});
/* ================== MY ORDERS ================== */
app.get("/my-orders/:email", async (req, res) => {
  try {
    const orders = await Order.find({ "user.email": req.params.email });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Error fetching orders" });
  }
});

/* ================== SERVER ================== */
app.listen(5000, () => console.log("Server running on port 5000 🚀"));
app.use(cors({
  origin: "*"
}));