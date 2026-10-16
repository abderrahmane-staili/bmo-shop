const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const file = process.env.DB_PATH || path.join(__dirname, "data", "shop.sqlite");
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    image TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
    unit_price REAL NOT NULL,
    total REAL NOT NULL,
    payment TEXT NOT NULL CHECK (payment IN ('Cash on delivery', 'Card')),
    status TEXT NOT NULL DEFAULT 'new',
    stripe_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const initialProducts = [
  ["Olive Oil", "food", 85, "/img/olive-oil.jpg"],
  ["Moroccan Dates", "food", 45, "/img/moroccan-dates.jpg"],
  ["Everyday Tee", "clothes", 120, "/img/everyday-tee.jpg"],
  ["Soft Knit Sweater", "clothes", 260, "/img/knit-sweater.jpg"],
  ["Classic Sneakers", "shoes", 320, "/img/classic-sneakers.jpg"],
  ["Everyday Slides", "shoes", 140, "/img/everyday-slides.jpg"],
  ["Relaxed Chinos", "pants", 230, "/img/relaxed-chinos.jpg"],
  ["Utility Trousers", "pants", 280, "/img/utility-trousers.jpg"]
];

const seed = db.transaction(() => {
  if (db.prepare("SELECT COUNT(*) AS count FROM products").get().count === 0) {
    const insert = db.prepare("INSERT INTO products (name, category, price, image) VALUES (?, ?, ?, ?)");
    initialProducts.forEach(product => insert.run(...product));
  }
  const updateImage = db.prepare(
    "UPDATE products SET image = ? WHERE id = ? AND image LIKE 'https://loremflickr.com/%'"
  );
  initialProducts.forEach((product, index) => {
    updateImage.run(product[3], index + 1);
  });
});
seed();

module.exports = db;
