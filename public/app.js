const page = document.body.dataset.page;
const money = value => `${Number(value).toFixed(Number(value) % 1 ? 2 : 0)} DH`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
};

document.addEventListener("click", event => {
  const button = event.target.closest(".button");
  if (!button) return;
  button.classList.remove("ripple");
  requestAnimationFrame(() => button.classList.add("ripple"));
});

function observeReveals(root = document) {
  const cards = root.querySelectorAll(".product-card:not([data-observed])");
  if (!("IntersectionObserver" in window)) {
    cards.forEach(card => card.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  cards.forEach(card => {
    card.dataset.observed = "true";
    observer.observe(card);
  });
}

function addImageFallback(image, wrapper, name) {
  image.addEventListener("error", () => {
    image.remove();
    wrapper.classList.add("image-fallback");
    const label = document.createElement("span");
    label.className = "image-fallback-name";
    label.textContent = name;
    wrapper.append(label);
  }, { once: true });
}

async function initShop() {
  const grid = document.querySelector("#product-grid");
  const error = document.querySelector("#shop-error");
  const header = document.querySelector(".site-header");
  const menu = document.querySelector("#site-menu");
  const menuToggle = document.querySelector("#menu-toggle");
  const shopToggle = document.querySelector("#shop-toggle");
  const shopDropdown = document.querySelector("#shop-dropdown");
  let activeCategory = "all";
  document.querySelector('.nav-link[data-nav="home"]').classList.add("is-current");

  function applyFilter(category, scrollToGrid = false) {
    activeCategory = category;
    document.querySelectorAll(".filter-chip").forEach(chip => {
      const active = chip.dataset.filter === category;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    grid.querySelectorAll(".product-card").forEach(card => {
      const matches = category === "all" || card.dataset.category === category;
      if (matches) {
        card.hidden = false;
        card.classList.remove("filter-out");
        requestAnimationFrame(() => card.classList.add("is-visible"));
      } else if (!card.hidden) {
        card.classList.add("filter-out");
        window.setTimeout(() => {
          if (activeCategory !== "all" && card.dataset.category !== activeCategory) card.hidden = true;
        }, 220);
      }
    });
    if (scrollToGrid) {
      shopDropdown.classList.remove("is-open");
      shopToggle.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open menu");
      document.querySelector("#products").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  grid.innerHTML = Array.from({ length: 4 }, () => `
    <div class="skeleton-card" aria-hidden="true"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
  `).join("");
  try {
    const products = await request("/api/products");
    grid.replaceChildren();
    products.forEach((product, index) => {
      const card = document.createElement("article");
      card.className = "product-card";
      card.dataset.category = product.category;
      card.style.setProperty("--stagger", index);
      const imageWrap = document.createElement("div");
      imageWrap.className = "product-image-wrap";
      const image = document.createElement("img");
      image.src = product.image;
      image.alt = product.name;
      image.width = 600;
      image.height = 600;
      image.loading = "lazy";
      addImageFallback(image, imageWrap, product.name);
      imageWrap.append(image);
      const content = document.createElement("div");
      content.className = "product-info";
      const category = document.createElement("p");
      category.className = "product-category";
      category.textContent = product.category;
      const name = document.createElement("h3");
      name.textContent = product.name;
      const bottom = document.createElement("div");
      bottom.className = "product-bottom";
      const price = document.createElement("span");
      price.className = "product-price";
      price.textContent = money(product.price);
      const order = document.createElement("a");
      order.className = "button order-button";
      order.href = `/checkout.html?product=${encodeURIComponent(product.id)}`;
      order.textContent = "Order";
      order.addEventListener("click", event => {
        event.preventDefault();
        if (order.dataset.added) return;
        order.dataset.added = "true";
        order.classList.add("is-added");
        order.textContent = "Added ✓";
        window.setTimeout(() => location.assign(order.href), 180);
      });
      bottom.append(price, order);
      content.append(category, name, bottom);
      card.append(imageWrap, content);
      card.addEventListener("pointermove", event => {
        if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const bounds = card.getBoundingClientRect();
        const rotateX = ((event.clientY - bounds.top) / bounds.height - .5) * -5;
        const rotateY = ((event.clientX - bounds.left) / bounds.width - .5) * 5;
        card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
      grid.append(card);
    });
    observeReveals(grid);
    document.querySelectorAll("[data-filter]").forEach(button => {
      button.addEventListener("click", () => applyFilter(button.dataset.filter, true));
    });
  } catch (cause) {
    grid.replaceChildren();
    error.textContent = cause.message;
    error.hidden = false;
  }

  menuToggle.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  shopToggle.addEventListener("click", () => {
    const open = shopDropdown.classList.toggle("is-open");
    shopToggle.setAttribute("aria-expanded", String(open));
  });
  menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    menu.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
  }));
  document.addEventListener("click", event => {
    if (!event.target.closest(".nav-shop")) {
      shopDropdown.classList.remove("is-open");
      shopToggle.setAttribute("aria-expanded", "false");
    }
  });
  const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  if ("IntersectionObserver" in window) {
    const sections = document.querySelectorAll("#products, #about, #contact");
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll(".nav-link[data-nav]").forEach(link => link.classList.toggle(
          "is-current", link.dataset.nav === entry.target.id
        ));
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    sections.forEach(section => navObserver.observe(section));
  }
}

async function initCheckout() {
  const params = new URLSearchParams(location.search);
  const form = document.querySelector("#checkout-form");
  const summary = document.querySelector("#checkout-summary");
  const error = document.querySelector("#checkout-error");
  const success = document.querySelector("#order-success");
  const successMessage = document.querySelector("#success-message");
  const productId = params.get("product");
  let product;
  const showSuccess = orderNumber => {
    form.hidden = true;
    summary.hidden = true;
    success.hidden = false;
    successMessage.textContent = `Your order number is #${orderNumber}.`;
  };

  if (params.has("session_id")) {
    form.hidden = true;
    summary.hidden = true;
    try {
      const result = await request(`/api/orders/verify?session_id=${encodeURIComponent(params.get("session_id"))}`);
      showSuccess(result.orderNumber);
    } catch (cause) {
      error.textContent = cause.message;
      error.hidden = false;
      form.hidden = true;
    }
    return;
  }

  try {
    if (!/^\d+$/.test(productId || "")) throw new Error("Choose a product from the shop first.");
    const products = await request("/api/products");
    product = products.find(item => item.id === Number(productId));
    if (!product) throw new Error("That product is no longer available.");
    summary.replaceChildren();
    const imageWrap = document.createElement("div");
    imageWrap.className = "summary-image-wrap";
    const image = document.createElement("img");
    image.src = product.image;
    image.alt = product.name;
    image.width = 600;
    image.height = 600;
    image.loading = "lazy";
    addImageFallback(image, imageWrap, product.name);
    imageWrap.append(image);
    const details = document.createElement("div");
    const name = document.createElement("h2");
    name.textContent = product.name;
    const category = document.createElement("p");
    category.textContent = product.category;
    const quantityLabel = document.createElement("label");
    quantityLabel.textContent = "Quantity";
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.name = "quantity";
    quantity.min = "1";
    quantity.max = "99";
    quantity.value = "1";
    quantity.required = true;
    quantity.setAttribute("aria-label", "Quantity");
    quantityLabel.append(quantity);
    details.append(name, category, quantityLabel);
    const total = document.createElement("strong");
    total.className = "summary-total";
    const updateTotal = () => { total.textContent = money(product.price * Number(quantity.value || 1)); };
    quantity.addEventListener("input", updateTotal);
    updateTotal();
    summary.append(imageWrap, details, total);
    if (params.has("cancelled")) {
      error.textContent = "Payment was cancelled. You can try again or choose cash on delivery.";
      error.hidden = false;
    }
  } catch (cause) {
    form.hidden = true;
    summary.textContent = cause.message;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.hidden = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Please wait…";
    const values = new FormData(form);
    try {
      const result = await request("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          quantity: Number(document.querySelector('[name="quantity"]').value),
          fullName: values.get("fullName"),
          phone: values.get("phone"),
          city: values.get("city"),
          address: values.get("address"),
          paymentMethod: values.get("paymentMethod")
        })
      });
      if (result.checkoutUrl) {
        location.assign(result.checkoutUrl);
        return;
      }
      showSuccess(result.orderNumber);
    } catch (cause) {
      error.textContent = cause.message;
      error.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Place order";
    }
  });
}

function animateCounter(element, target, suffix = "") {
  const start = performance.now();
  const duration = 750;
  const draw = now => {
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.round(target * (1 - Math.pow(1 - progress, 3)));
    element.textContent = `${current.toLocaleString()}${suffix}`;
    if (progress < 1) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

async function initAdmin() {
  const error = document.querySelector("#admin-error");
  const showError = cause => { error.textContent = cause.message; error.hidden = false; };
  const ordersBody = document.querySelector("#orders-body");
  const productsBody = document.querySelector("#admin-products-body");
  const orderSearch = document.querySelector("#order-search");
  const orderFilter = document.querySelector("#order-filter");
  const productForm = document.querySelector("#product-form");
  const productError = document.querySelector("#product-error");

  async function loadStats() {
    const stats = await request("/api/admin/stats");
    animateCounter(document.querySelector('[data-count="totalOrders"]'), stats.totalOrders);
    animateCounter(document.querySelector('[data-count="revenue"]'), Math.round(stats.revenue), " DH");
    animateCounter(document.querySelector('[data-count="newOrders"]'), stats.newOrders);
  }

  async function loadOrders() {
    const query = new URLSearchParams();
    if (orderSearch.value.trim()) query.set("search", orderSearch.value.trim());
    if (orderFilter.value) query.set("status", orderFilter.value);
    const orders = await request(`/api/admin/orders?${query}`);
    ordersBody.innerHTML = orders.length ? orders.map(order => `
      <tr>
        <td>#${order.id}</td><td>${escapeHtml(order.customer)}</td><td>${escapeHtml(order.phone)}</td>
        <td>${escapeHtml(order.city)}</td><td>${escapeHtml(order.product)}</td><td>${order.qty}</td>
        <td>${money(order.total)}</td><td>${escapeHtml(order.payment)}</td>
        <td><select data-order-status="${order.id}" aria-label="Order ${order.id} status">
          ${["new", "confirmed", "shipped", "delivered", "cancelled"].map(status => `<option${status === order.status ? " selected" : ""}>${status}</option>`).join("")}
        </select></td><td>${escapeHtml(order.date)}</td><td><button class="table-action" data-delete-order="${order.id}" type="button">Delete</button></td>
      </tr>
    `).join("") : '<tr><td colspan="11">No orders found.</td></tr>';
  }

  async function loadProducts() {
    const products = await request("/api/products");
    productsBody.innerHTML = products.map(product => `
      <tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.category)}</td><td>${money(product.price)}</td>
      <td>${escapeHtml(product.image)}</td><td><button class="table-action edit" data-edit-product="${product.id}" type="button">Edit</button>
      <button class="table-action" data-delete-product="${product.id}" type="button">Delete</button></td></tr>
    `).join("") || '<tr><td colspan="5">No products yet.</td></tr>';
  }

  async function refresh() {
    error.hidden = true;
    try { await Promise.all([loadStats(), loadOrders(), loadProducts()]); }
    catch (cause) { showError(cause); }
  }

  let searchTimer;
  orderSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadOrders().catch(showError), 250);
  });
  orderFilter.addEventListener("change", () => loadOrders().catch(showError));
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try { await request("/api/admin/logout", { method: "POST" }); location.assign("/bmo-panel"); }
    catch (cause) { showError(cause); }
  });
  document.querySelector("#new-product-button").addEventListener("click", () => {
    productForm.reset();
    productForm.elements.id.value = "";
    document.querySelector("#product-form-title").textContent = "Add product";
    productError.hidden = true;
    productForm.hidden = false;
    productForm.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.querySelector("#close-product-form").addEventListener("click", () => { productForm.hidden = true; });

  document.addEventListener("click", async event => {
    const deleteOrder = event.target.closest("[data-delete-order]");
    const editProduct = event.target.closest("[data-edit-product]");
    const deleteProduct = event.target.closest("[data-delete-product]");
    try {
      if (deleteOrder) {
        await request(`/api/admin/orders/${deleteOrder.dataset.deleteOrder}`, { method: "DELETE" });
        await Promise.all([loadStats(), loadOrders()]);
      }
      if (editProduct) {
        const products = await request("/api/products");
        const product = products.find(item => item.id === Number(editProduct.dataset.editProduct));
        if (!product) throw new Error("Product not found.");
        productForm.elements.id.value = product.id;
        productForm.elements.name.value = product.name;
        productForm.elements.category.value = product.category;
        productForm.elements.price.value = product.price;
        productForm.elements.image.value = product.image;
        document.querySelector("#product-form-title").textContent = "Edit product";
        productError.hidden = true;
        productForm.hidden = false;
        productForm.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (deleteProduct) {
        await request(`/api/admin/products/${deleteProduct.dataset.deleteProduct}`, { method: "DELETE" });
        await loadProducts();
      }
    } catch (cause) { showError(cause); }
  });

  document.addEventListener("change", async event => {
    const select = event.target.closest("[data-order-status]");
    if (!select) return;
    try {
      await request(`/api/admin/orders/${select.dataset.orderStatus}/status`, {
        method: "PATCH", body: JSON.stringify({ status: select.value })
      });
      await loadStats();
    } catch (cause) { showError(cause); }
  });

  productForm.addEventListener("submit", async event => {
    event.preventDefault();
    productError.hidden = true;
    const values = Object.fromEntries(new FormData(productForm));
    const id = values.id;
    delete values.id;
    values.price = Number(values.price);
    try {
      await request(id ? `/api/admin/products/${id}` : "/api/admin/products", {
        method: id ? "PUT" : "POST", body: JSON.stringify(values)
      });
      productForm.hidden = true;
      await loadProducts();
    } catch (cause) {
      productError.textContent = cause.message;
      productError.hidden = false;
    }
  });

  await refresh();
}

async function initLogin() {
  const form = document.querySelector("#login-form");
  const error = document.querySelector("#login-error");
  try {
    await request("/api/admin/session");
    location.assign("/bmo-panel/dashboard");
    return;
  } catch (cause) {
    if (cause.message !== "Authentication required") {
      error.textContent = cause.message;
      error.hidden = false;
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.hidden = true;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      await request("/api/admin/login", { method: "POST", body: JSON.stringify(values) });
      location.assign("/bmo-panel/dashboard");
    } catch (cause) {
      error.textContent = cause.message;
      error.hidden = false;
    } finally { button.disabled = false; }
  });
}

if (page === "shop") initShop();
if (page === "checkout") initCheckout();
if (page === "login") initLogin();
if (page === "admin") initAdmin();
