require("dotenv").config();

const path = require("node:path");
const bcrypt = require("bcrypt");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const Stripe = require("stripe");
const db = require("./db");

const requiredEnv = ["ADMIN_USER", "ADMIN_PASS", "SESSION_SECRET"];
for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error(`${name} must be set in .env`);
}

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const adminUser = process.env.ADMIN_USER;
const adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASS, 12);
const publicUrl = new URL(process.env.PUBLIC_URL || "http://localhost:3000").origin;
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const categories = new Set(["food", "clothes", "shoes", "pants"]);
const orderStatuses = new Set(["new", "confirmed", "shipped", "delivered", "cancelled"]);
const loginAttempts = new Map();

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "img-src": ["'self'", "https:", "data:"],
      "form-action": ["'self'", "https://checkout.stripe.com"],
      "frame-ancestors": ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "10kb" }));
app.use(session({
  name: "bmo.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production" && process.env.TRUST_PROXY === "1",
    maxAge: 8 * 60 * 60 * 1000
  }
}));
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

function requireAdmin(req, res, next) {
  if (req.session.authenticated) return next();
  if (req.path === "/bmo-panel/dashboard") return res.redirect("/bmo-panel");
  return res.status(401).json({ error: "Authentication required" });
}

function validText(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function validateProduct(input) {
  if (!input || !validText(input.name, 2, 100) || !categories.has(input.category)) return false;
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000 || Math.round(price * 100) !== price * 100) return false;
  return typeof input.image === "string" && /^\/img\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/i.test(input.image);
}

function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function throttleLogin(req, res, next) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const attempts = (loginAttempts.get(req.ip) || []).filter(time => now - time < windowMs);
  if (attempts.length >= 5) {
    loginAttempts.set(req.ip, attempts);
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }
  loginAttempts.set(req.ip, attempts);
  next();
}

app.get(["/login.html", "/admin.html"], (req, res) => res.sendStatus(404));
app.get("/bmo-panel", (req, res) => res.sendFile(path.join(publicDir, "bmo-panel", "index.html")));
app.get("/bmo-panel/dashboard", requireAdmin, (req, res) =>
  res.sendFile(path.join(publicDir, "bmo-panel", "dashboard.html"))
);
app.use("/bmo-panel", (req, res) => res.sendStatus(404));
app.use(express.static(publicDir));

app.get("/api/products", (req, res) => {
  res.json(db.prepare("SELECT id, name, category, price, image FROM products ORDER BY id").all());
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const body = req.body || {};
    const productId = Number(body.productId);
    const quantity = Number(body.quantity);
    const paymentMethod = body.paymentMethod;
    if (
      !validId(body.productId) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 99 ||
      !validText(body.fullName, 2, 100) ||
      typeof body.phone !== "string" || !/^[+0-9() -]{7,20}$/.test(body.phone.trim()) ||
      !validText(body.city, 2, 80) ||
      !validText(body.address, 5, 250) ||
      !["Cash on delivery", "Card"].includes(paymentMethod)
    ) return res.status(400).json({ error: "Check your details and try again." });

    const product = db.prepare("SELECT id, name, price FROM products WHERE id = ?").get(productId);
    if (!product) return res.status(404).json({ error: "Product not found." });
    if (paymentMethod === "Card" && (!stripe || /replace_me|your_key/i.test(process.env.STRIPE_SECRET_KEY))) {
      return res.status(503).json({ error: "Card payments are not configured. Please choose cash on delivery." });
    }

    const total = Math.round(product.price * quantity * 100) / 100;
    const result = db.prepare(`
      INSERT INTO orders (customer, phone, city, address, product_id, product, quantity, unit_price, total, payment, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(
      body.fullName.trim(), body.phone.trim(), body.city.trim(), body.address.trim(),
      product.id, product.name, quantity, product.price, total, paymentMethod
    );
    const orderNumber = Number(result.lastInsertRowid);

    if (paymentMethod === "Card") {
      try {
        const checkout = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [{
            price_data: {
              currency: "mad",
              product_data: { name: product.name },
              unit_amount: Math.round(product.price * 100)
            },
            quantity
          }],
          metadata: { orderId: String(orderNumber) },
          success_url: `${publicUrl}/checkout.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${publicUrl}/checkout.html?product=${product.id}&cancelled=1`
        });
        db.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").run(checkout.id, orderNumber);
        return res.json({ checkoutUrl: checkout.url, orderNumber });
      } catch (error) {
        db.prepare("DELETE FROM orders WHERE id = ?").run(orderNumber);
        throw error;
      }
    }
    return res.status(201).json({ orderNumber });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/verify", async (req, res, next) => {
  try {
    const sessionId = req.query.session_id;
    if (!stripe || typeof sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      return res.status(400).json({ error: "Invalid checkout session." });
    }
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    const orderNumber = Number(checkout.metadata?.orderId);
    const order = validId(orderNumber)
      ? db.prepare("SELECT id, stripe_session_id FROM orders WHERE id = ?").get(orderNumber)
      : null;
    if (!order || order.stripe_session_id !== sessionId || checkout.payment_status !== "paid") {
      return res.status(409).json({ error: "Payment has not been confirmed." });
    }
    res.json({ orderNumber });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/login", throttleLogin, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const valid = validText(username, 1, 100) &&
      typeof password === "string" &&
      username === adminUser &&
      await bcrypt.compare(password, adminPasswordHash);
    if (!valid) {
      const failures = loginAttempts.get(req.ip) || [];
      failures.push(Date.now());
      loginAttempts.set(req.ip, failures);
      return res.status(401).json({ error: "Incorrect username or password." });
    }
    loginAttempts.delete(req.ip);
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.authenticated = true;
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/logout", requireAdmin, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie("bmo.sid", { httpOnly: true, sameSite: "strict" });
    res.json({ ok: true });
  });
});

app.get("/api/admin/session", requireAdmin, (req, res) => res.json({ ok: true }));

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const stats = db.prepare(`
    SELECT COUNT(*) AS totalOrders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS revenue,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS newOrders
    FROM orders
  `).get();
  res.json({ ...stats, newOrders: stats.newOrders || 0 });
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const status = orderStatuses.has(req.query.status) ? req.query.status : "";
  const terms = [];
  const values = [];
  if (status) {
    terms.push("status = ?");
    values.push(status);
  }
  if (search) {
    terms.push("(customer LIKE ? OR phone LIKE ? OR city LIKE ? OR product LIKE ?)");
    values.push(...Array(4).fill(`%${search}%`));
  }
  const where = terms.length ? `WHERE ${terms.join(" AND ")}` : "";
  res.json(db.prepare(`
    SELECT id, customer, phone, city, product, quantity AS qty, total, payment, status, created_at AS date
    FROM orders ${where} ORDER BY id DESC LIMIT 500
  `).all(...values));
});

app.patch("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!validId(req.params.id) || !orderStatuses.has(status)) {
    return res.status(400).json({ error: "Invalid order or status." });
  }
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Order not found." });
  res.json({ ok: true });
});

app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid order." });
  const result = db.prepare("DELETE FROM orders WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Order not found." });
  res.json({ ok: true });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  if (!validateProduct(req.body)) return res.status(400).json({ error: "Check the product details and image URL." });
  const { name, category, price, image } = req.body;
  const result = db.prepare("INSERT INTO products (name, category, price, image) VALUES (?, ?, ?, ?)")
    .run(name.trim(), category, Number(price), image);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  if (!validId(req.params.id) || !validateProduct(req.body)) {
    return res.status(400).json({ error: "Check the product details and image URL." });
  }
  const { name, category, price, image } = req.body;
  const result = db.prepare("UPDATE products SET name = ?, category = ?, price = ?, image = ? WHERE id = ?")
    .run(name.trim(), category, Number(price), image, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Product not found." });
  res.json({ ok: true });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid product." });
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Product not found." });
  res.json({ ok: true });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`BMO shop listening on port ${port}; admin: ${publicUrl}/bmo-panel`);
});
