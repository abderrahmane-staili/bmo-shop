<div align="center">

# </BMO> Shop

**A lightweight, full-stack online shop: storefront, checkout, and a hidden admin dashboard.**

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## ✨ Features

- 🛍️ **Storefront**: product grid with category filters, scroll animations, and a responsive navbar
- 🧾 **Checkout**: cash on delivery or card payment through hosted Stripe Checkout
- 🔐 **Hidden admin panel**: not linked anywhere on the public site, protected by sessions and bcrypt
- 📊 **Dashboard**: stats, orders table, status updates, and full product management (add / edit / delete)
- 🎨 **Modern UI**: animated gradient hero, 3D card tilt, skeleton loaders, `prefers-reduced-motion` support
- 🐳 **Docker-ready**: one command to run everything

## 🧰 Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Backend   | Node.js, Express                             |
| Database  | SQLite (`better-sqlite3`)                    |
| Auth      | `express-session`, `bcrypt`, rate limiting   |
| Payments  | Stripe Checkout (hosted page)                |
| Security  | `helmet`, parameterized SQL, input validation |
| Frontend  | Vanilla HTML, CSS, JavaScript                |
| DevOps    | Docker, Docker Compose                       |

## 📁 Project Structure

```
bmo-landing/
├── server.js
├── db.js
├── Dockerfile
├── docker-compose.yml
├── .env
├── package.json
└── public/
    ├── index.html
    ├── checkout.html
    ├── style.css
    ├── app.js
    └── img/
```

## 🚀 Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/<your-username>/bmo-shop.git
cd bmo-shop
```

**2. Configure environment variables**

Create a `.env` file:

```env
ADMIN_USER=your_admin_username
ADMIN_PASS=your_strong_password
SESSION_SECRET=a-long-random-string
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
PUBLIC_URL=http://localhost:3000
```

**3. Run with Docker**

```bash
docker compose up --build
```

**Or run locally**

```bash
npm install
npm start
```

Open **http://localhost:3000** 🎉

## 🔑 Admin Panel

The admin area is intentionally hidden from the public site. The login path is printed in the server startup log. Credentials come from `.env`.

> ⚠️ Always change the default credentials and `SESSION_SECRET` before deploying.

## 💳 Payments

Card payments use **Stripe Checkout**. Card numbers never touch this server or its database, and payouts are configured in your Stripe dashboard. Without Stripe keys, cash on delivery still works.

## 🔒 Security

- Passwords hashed with bcrypt
- HTTP-only session cookies
- Login rate limiting
- Helmet security headers
- Parameterized SQL queries only
- Output escaping against XSS

## 🗺️ Roadmap

- [ ] Persistent session store
- [ ] Email notifications for new orders
- [ ] Multi-language support (AR / FR / EN)
- [ ] Product image upload from the admin panel

## 📄 License

Released under the [MIT License](LICENSE).
