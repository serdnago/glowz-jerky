// ============ CONFIG (owner-editable) ============
const EMAIL = "glowm6@proton.me";

const SIZES = {
  regular: { label: "Regular", oz: "4.5 oz", price: 25, credits: 1 },
  large:   { label: "Large",   oz: "13.5 oz", price: 70, credits: 3 },
};

const FLAVORS = [
  { name: "Kiawe Smoke",   desc: "Island wood smoke",     tag: "#1 Fave", health: true },
  { name: "Teriyaki",      desc: "The family original",   tag: "#2 Fave", health: true },
  { name: "Korean BBQ",    desc: "Garlic, ginger, sesame", tag: "#3 Fave", health: false },
  { name: "Original",      desc: "Classic & savory",       health: false },
  { name: "Hickory Smoke", desc: "Bold mainland smoke",    health: true },
  { name: "Char Siu",      desc: "Sweet & sticky",         health: false },
  { name: "Old Fashion",   desc: "Old-school peppery",     health: true },
  { name: "Mystery Bag",   desc: "Assorted surprise 🎁",   health: false },
];

const HEAT_LEVEL = { "": 0, "Black Pepper": 35, "Ghost Pepper": 75, "Carolina Reaper": 100 };

// Member mix-and-match promos, counted in 4.5 oz bag credits
const PROMOS = [
  { min: 7, label: "Buy 7+ bags: $25 off", calc: sub => 25 },
  { min: 3, label: "Buy 3+ bags: 5% off",  calc: sub => sub * 0.05 },
];
const FREE_DELIVERY_MIN = 4;
const FREE_SHIPPING_MIN = 8;

// Ready-to-sell stock. Add entries like:
// { flavor: "Teriyaki", size: "regular", mods: "", qty: 6 }
const INVENTORY = [];

// ============ HELPERS ============
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = n => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
const radio = name => $(`input[name="${name}"]:checked`)?.value ?? "";

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("is-on"), 2200);
}

// ============ NAV ============
const burger = $("#burger");
burger.addEventListener("click", () => {
  const open = $("#navLinks").classList.toggle("is-open");
  burger.setAttribute("aria-expanded", open);
});
$$("#navLinks a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("is-open")));
$("#year").textContent = new Date().getFullYear();

// ============ BUILDER ============
let current = { flavor: "Kiawe Smoke", qty: 1 };

function renderFlavors() {
  $("#flavorGrid").innerHTML = FLAVORS.map(f => `
    <button type="button" class="flavor ${f.name === current.flavor ? "is-on" : ""}" data-flavor="${f.name}">
      ${f.tag ? `<span class="flavor__tag">${f.tag}</span>` : ""}
      <b>${f.name}</b><small>${f.desc}</small>
    </button>`).join("");
}

function modsText(heat, health) {
  return [heat, health].filter(Boolean).join(" · ");
}

function updatePreview() {
  const size = SIZES[radio("size")];
  const heat = radio("heat");
  const flavor = FLAVORS.find(f => f.name === current.flavor);

  // Reduced sodium / sugar only for certain flavors
  const healthStep = $("#healthStep");
  healthStep.classList.toggle("is-disabled", !flavor.health);
  $$('input[name="health"]').forEach(i => { if (i.value) i.disabled = !flavor.health; });
  if (!flavor.health && radio("health")) $('input[name="health"][value=""]').checked = true;
  const health = radio("health");

  $("#pvFlavor").textContent = flavor.name;
  $("#pvMods").textContent = modsText(heat, health) || "Classic";
  $("#pvSize").textContent = size.oz;
  $("#bagPreview").classList.toggle("is-large", radio("size") === "large");
  $("#heatFill").style.width = HEAT_LEVEL[heat] + "%";
  $("#qtyVal").textContent = current.qty;
  $("#addPrice").textContent = money(size.price * current.qty);
}

function popBag() {
  const b = $("#bagPreview");
  b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
}

$("#flavorGrid").addEventListener("click", e => {
  const btn = e.target.closest("[data-flavor]");
  if (!btn) return;
  current.flavor = btn.dataset.flavor;
  renderFlavors(); updatePreview(); popBag();
});
$$('input[name="size"], input[name="heat"], input[name="health"]').forEach(i =>
  i.addEventListener("change", () => { updatePreview(); popBag(); }));
$("#qtyMinus").addEventListener("click", () => { current.qty = Math.max(1, current.qty - 1); updatePreview(); });
$("#qtyPlus").addEventListener("click", () => { current.qty = Math.min(50, current.qty + 1); updatePreview(); });

$("#addBtn").addEventListener("click", () => {
  addToCart({
    flavor: current.flavor, size: radio("size"),
    mods: modsText(radio("heat"), radio("health")),
    qty: current.qty, ready: false,
  });
  current.qty = 1; updatePreview();
});

$$("[data-quick]").forEach(b => b.addEventListener("click", () => {
  addToCart({ flavor: b.dataset.quick, size: "regular", mods: "", qty: 1, ready: false });
}));

// ============ CART ============
const cart = [];
const keyOf = i => [i.flavor, i.size, i.mods, i.ready].join("|");

function addToCart(item) {
  const existing = cart.find(c => keyOf(c) === keyOf(item));
  if (existing) existing.qty += item.qty; else cart.push({ ...item });
  renderCart();
  toast(`🤙 ${item.qty} × ${item.flavor} added`);
  const cb = $("#cartBtn");
  cb.classList.remove("bump"); void cb.offsetWidth; cb.classList.add("bump");
}

function calc() {
  const subtotal = cart.reduce((s, i) => s + SIZES[i.size].price * i.qty, 0);
  const credits = cart.reduce((s, i) => s + SIZES[i.size].credits * i.qty, 0);
  const bags = cart.reduce((s, i) => s + i.qty, 0);
  const largeSavings = cart.reduce((s, i) => s + (i.size === "large" ? 5 * i.qty : 0), 0);

  // Best single eligible promo (no stacking)
  const eligible = PROMOS.filter(p => credits >= p.min)
    .map(p => ({ ...p, amount: p.calc(subtotal) }))
    .sort((a, b) => b.amount - a.amount)[0];
  const member = $("#memberToggle").checked;
  const discount = member && eligible ? eligible.amount : 0;

  const ship = radio("ship");
  let shipLine = "Free", shipNote = "";
  if (ship === "pickup") {
    shipNote = "We'll text you a pickup spot on Oʻahu when it's ready.";
  } else if (ship === "delivery") {
    if (credits >= FREE_DELIVERY_MIN) shipNote = "🎉 You've unlocked free Oʻahu delivery!";
    else { shipLine = "TBD"; shipNote = `Add ${FREE_DELIVERY_MIN - credits} more bag${FREE_DELIVERY_MIN - credits > 1 ? "s" : ""} for free delivery. Smaller orders may still qualify if we're in your area.`; }
  } else {
    if (credits >= FREE_SHIPPING_MIN) shipNote = "🎉 You've unlocked free USA shipping!";
    else { shipLine = "Quoted"; shipNote = `Add ${FREE_SHIPPING_MIN - credits} more bag${FREE_SHIPPING_MIN - credits > 1 ? "s" : ""} for free USA shipping. Otherwise we'll quote shipping.`; }
  }

  const tip = Number(radio("tip"));
  const total = subtotal - discount + tip;
  return { subtotal, credits, bags, largeSavings, eligible, member, discount, ship, shipLine, shipNote, tip, total };
}

function renderCart() {
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
  const empty = cart.length === 0;
  $("#cartEmpty").hidden = !empty;
  $("#checkout").hidden = empty;

  $("#cartList").innerHTML = cart.map((i, idx) => {
    const s = SIZES[i.size];
    return `<li class="cart-item">
      <b>${i.flavor}</b>
      <span class="cart-item__price">${money(s.price * i.qty)}</span>
      <small>${s.label} ${s.oz}${i.mods ? " · " + i.mods : ""}${i.ready ? " · ✅ Ready now" : " · ⏱️ 1–2 wks"}</small>
      <span class="cart-item__ctrl">
        <button type="button" data-dec="${idx}" aria-label="Decrease">−</button>
        <span>${i.qty}</span>
        <button type="button" data-inc="${idx}" aria-label="Increase">+</button>
        <button type="button" class="rm" data-rm="${idx}">remove</button>
      </span>
    </li>`;
  }).join("");

  if (empty) return;
  const t = calc();
  $("#shipNote").textContent = t.shipNote;
  $("#addressField").hidden = t.ship === "pickup";
  $("#addressField").required = t.ship !== "pickup";

  let promoRow = "";
  if (t.discount) promoRow = `<div class="save"><span>${t.eligible.label}</span><span>−${money(t.discount)}</span></div>`;
  else if (!t.member && t.eligible) promoRow = `<span class="hint">👀 Members save ${money(t.eligible.amount)} on this order — join free!</span>`;
  else if (t.credits < 3) promoRow = `<span class="hint">Add ${3 - t.credits} more bag${3 - t.credits > 1 ? "s" : ""} to unlock 5% off (members)</span>`;
  else if (t.credits < 7) promoRow = `<span class="hint">${7 - t.credits} more bag${7 - t.credits > 1 ? "s" : ""} to unlock $25 off (members)</span>`;

  $("#totals").innerHTML = `
    <div><span>Subtotal (${t.credits} bag credit${t.credits > 1 ? "s" : ""})</span><span>${money(t.subtotal)}</span></div>
    ${t.largeSavings ? `<div class="save"><span>Large-bag savings included</span><span>${money(t.largeSavings)}</span></div>` : ""}
    ${promoRow}
    <div><span>${{ pickup: "Pickup", delivery: "Oʻahu delivery", shipping: "USA shipping" }[t.ship]}</span><span>${t.shipLine}</span></div>
    ${t.tip ? `<div><span>Tip — mahalo! 💛</span><span>${money(t.tip)}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>`;
}

$("#cartList").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.inc) cart[b.dataset.inc].qty++;
  if (b.dataset.dec) { const i = cart[b.dataset.dec]; i.qty > 1 ? i.qty-- : cart.splice(b.dataset.dec, 1); }
  if (b.dataset.rm) cart.splice(b.dataset.rm, 1);
  renderCart();
});
$("#checkout").addEventListener("change", renderCart);

function openDrawer(on) {
  $("#drawer").classList.toggle("is-on", on);
  $("#overlay").classList.toggle("is-on", on);
  $("#drawer").setAttribute("aria-hidden", !on);
}
$("#cartBtn").addEventListener("click", () => openDrawer(true));
$("#drawerClose").addEventListener("click", () => openDrawer(false));
$("#overlay").addEventListener("click", () => openDrawer(false));
$$("[data-close]").forEach(a => a.addEventListener("click", () => openDrawer(false)));
document.addEventListener("keydown", e => { if (e.key === "Escape") { openDrawer(false); closeModal(); } });

// ============ CHECKOUT ============
function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `GLZ-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

$("#checkout").addEventListener("submit", e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const t = calc();
  const num = orderNumber();
  const lines = cart.map(i => `${i.qty} × ${i.flavor} (${SIZES[i.size].label} ${SIZES[i.size].oz}${i.mods ? ", " + i.mods : ""})`);
  const shipLabel = { pickup: "Pickup", delivery: "Oʻahu delivery", shipping: "USA shipping" }[t.ship];

  const body = [
    `Order ${num}`, `Name: ${f.get("name")}`, `Contact: ${f.get("contact")}`,
    t.ship !== "pickup" ? `Address: ${f.get("address")}` : "",
    "", ...lines, "",
    `Subtotal: ${money(t.subtotal)}`,
    t.discount ? `Member discount: -${money(t.discount)}` : "",
    `${shipLabel}: ${t.shipLine}`,
    t.tip ? `Tip: ${money(t.tip)}` : "",
    `Total: ${money(t.total)}`,
    `Payment: ${f.get("pay")} on ${t.ship === "pickup" ? "pickup" : "delivery"}`,
  ].filter(l => l !== "").join("\n");

  $("#orderNum").textContent = num;
  $("#orderSummary").innerHTML = `
    <ul>${lines.map(l => `<li>${l}</li>`).join("")}</ul>
    <b>Total: ${money(t.total)}</b> · ${shipLabel} · ${f.get("pay")}
    <p class="note"><a href="mailto:${EMAIL}?subject=${encodeURIComponent("GLOWZ order " + num)}&body=${encodeURIComponent(body)}">📩 Email a copy of this order to GLOWZ</a></p>`;
  openDrawer(false);
  $("#modal").classList.add("is-on");
  $("#modal").setAttribute("aria-hidden", "false");

  cart.length = 0; e.target.reset(); renderCart();
});
function closeModal() { $("#modal").classList.remove("is-on"); $("#modal").setAttribute("aria-hidden", "true"); }
$("#modalClose").addEventListener("click", closeModal);

// ============ AVAILABLE NOW ============
function renderStock() {
  if (!INVENTORY.length) {
    $("#stockGrid").innerHTML = `<div class="stock-empty">
      <b>Fresh out! 🔥</b>
      <p>The last ready-made batch got snapped up. Order made-to-order and it'll be yours in 1–2 weeks.</p>
      <a href="#shop" class="btn btn--lava btn--sm">Order made-to-order</a></div>`;
    return;
  }
  $("#stockGrid").innerHTML = INVENTORY.map((s, idx) => {
    const size = SIZES[s.size];
    const out = s.qty <= 0;
    return `<article class="stock">
      <span class="stock__status ${out ? "stock__status--out" : ""}">${out ? "Sold out" : "✅ Ready now"}</span>
      <h3>${s.flavor}</h3>
      <p>${size.label} ${size.oz}${s.mods ? " · " + s.mods : ""} · ${money(size.price)}<br>${out ? "Order made-to-order instead" : `${s.qty} left`}</p>
      <button class="btn btn--sm btn--lava" data-stock="${idx}" ${out ? "disabled" : ""}>Add to bag</button>
    </article>`;
  }).join("");
}
$("#stockGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-stock]");
  if (!b) return;
  const s = INVENTORY[b.dataset.stock];
  const inCart = cart.filter(c => c.ready && c.flavor === s.flavor && c.size === s.size && c.mods === s.mods).reduce((n, c) => n + c.qty, 0);
  if (inCart >= s.qty) return toast("That's all we've got ready right now!");
  addToCart({ flavor: s.flavor, size: s.size, mods: s.mods, qty: 1, ready: true });
});

// ============ REWARDS ============
function renderCalc() {
  const c = Number($("#credits").value);
  const earned = Math.floor(c / 30);
  const next = (earned + 1) * 30;
  const into = c % 30;
  $("#creditsVal").textContent = c;
  $("#progFill").style.width = (into / 30 * 100) + "%";
  $(".progress__ticks").innerHTML = `<span>${earned * 30}</span><span>${next}</span>`;
  $("#calcOut").innerHTML = earned
    ? `You've earned <b>${earned} × $25 = ${money(earned * 25)}</b> in rewards. Just <b>${next - c}</b> more bag${next - c > 1 ? "s" : ""} to your next $25.`
    : `<b>${next - c}</b> more bag${next - c > 1 ? "s" : ""} until your first <b>$25</b> reward.`;
}
$("#credits").addEventListener("input", renderCalc);

const YEAR = new Date().getFullYear();
function renderBoard(which) {
  $$(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.board === which));
  const blurb = which === "annual" ? `${YEAR} race is on` : "Legends live here";
  $("#board").innerHTML = [1, 2, 3, 4, 5].map(n =>
    `<li><b>${n}</b> ${n === 1 ? `👑 ${blurb} — claim it!` : "Your nickname here 👀"}</li>`).join("");
}
$$(".tab").forEach(t => t.addEventListener("click", () => renderBoard(t.dataset.board)));
$('.tab[data-board="annual"]').textContent = `${YEAR} Annual`;

// ============ REVIEWS ============
let rating = 0;
$("#reviewFlavor").innerHTML = `<option value="">Which flavor?</option>` +
  FLAVORS.map(f => `<option>${f.name}</option>`).join("");
$$("#starInput button").forEach(b => {
  b.addEventListener("click", () => {
    rating = Number(b.dataset.v);
    $$("#starInput button").forEach(s => s.classList.toggle("is-on", Number(s.dataset.v) <= rating));
  });
});
$("#reviewForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!rating) { $("#reviewMsg").textContent = "Tap the stars to pick a rating 🌟"; return; }
  $("#reviewMsg").textContent = "Mahalo! Your review will appear once it's approved. 🤙";
  e.target.reset(); rating = 0;
  $$("#starInput button").forEach(s => s.classList.remove("is-on"));
});

// ============ CONTACT ============
$("#contactForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = `${f.get("message")}\n\n— ${f.get("name")} (${f.get("email")})`;
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Question from " + f.get("name"))}&body=${encodeURIComponent(body)}`;
  toast("Opening your email app… 📩");
});

// ============ SCROLL REVEAL ============
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
}), { threshold: 0.15 });
$$(".podium__card, .step, .deal, .story__photo, .gens li, .reward-card, .review-form, .contact__form, .h2")
  .forEach(el => { el.classList.add("reveal"); io.observe(el); });

// ============ INIT ============
renderFlavors(); updatePreview(); renderCart(); renderStock(); renderCalc(); renderBoard("annual");
