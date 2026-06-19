/* E'MAY SIGNATURE — SITE LOGIC */

// ── FRAME & SIZE OPTIONS ──
const FRAME_OPTIONS = [
  { id: "black",   name: "Matte Black",   hex: "#1c1c1c", priceAdd: 0    },
  { id: "walnut",  name: "Walnut Wood",   hex: "#5b3a23", priceAdd: 1500 },
  { id: "white",   name: "Soft White",    hex: "#f5f3ee", priceAdd: 0    },
  { id: "gold",    name: "Brushed Gold",  hex: "#b08d4f", priceAdd: 2500 },
  { id: "natural", name: "Natural Oak",   hex: "#c9a876", priceAdd: 1500 },
];

const SIZE_OPTIONS = [
  { id: "a4",     name: "A4 (21×29.7cm)",  priceAdd: 0    },
  { id: "a3",     name: "A3 (29.7×42cm)",  priceAdd: 4000 },
  { id: "square", name: "Square (30×30cm)", priceAdd: 2000 },
  { id: "large",  name: "Large (50×70cm)",  priceAdd: 9000 },
];

// ── PRODUCT DATA (loaded from /products/*.md) ──
const PRODUCTS = { bags: [], art: [] };

function parseFrontMatter(raw) {
  const match = raw.match(/^---\s*([\s\S]*?)\s*---/);
  if (!match) return {};
  const obj = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) continue;
    let [, key, val] = m;
    val = val.trim();
    if (val === "true")  { obj[key] = true;  continue; }
    if (val === "false") { obj[key] = false; continue; }
    if (/^-?\d+$/.test(val)) { obj[key] = Number(val); continue; }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1,-1);
    obj[key] = val;
  }
  return obj;
}

async function loadProduct(category, slug) {
  try {
    const res = await fetch(`/products/${category}/${slug}.md`);
    if (!res.ok) return null;
    const data = parseFrontMatter(await res.text());
    const isArt = category === "art";
    return {
      id: `${isArt ? "art" : "bag"}-${slug}`,
      slug, category: data.category || "",
      name: data.name || slug,
      price: data.price || 0,
      badge: data.badge || null,
      imgPath: data.image || "",
      img: data.name || slug,
      desc: data.description || "",
      configurable: isArt,
    };
  } catch { return null; }
}

async function loadAllProducts() {
  try {
    const manifest = await (await fetch("/products/manifest.json")).json();
    const bags = await Promise.all((manifest.bags||[]).map(s => loadProduct("bags", s)));
    const art  = await Promise.all((manifest.art ||[]).map(s => loadProduct("art",  s)));
    PRODUCTS.bags = bags.filter(Boolean);
    PRODUCTS.art  = art.filter(Boolean);
  } catch(e) { console.error("Could not load products", e); }
  return PRODUCTS;
}

const PRODUCTS_READY = loadAllProducts();

function findProduct(id) {
  return [...PRODUCTS.bags, ...PRODUCTS.art].find(p => p.id === id);
}

function formatNaira(n) { return "\u20a6" + n.toLocaleString("en-NG"); }

function productImg(p, style="") {
  if (p.imgPath && !p.imgPath.includes("placeholder")) {
    return `<img src="${p.imgPath}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;${style}">`;
  }
  const cls = p.id.startsWith("art") ? "ph-art" : "ph-bag";
  return `<div class="ph-box ${cls}" data-label="${p.img}" style="width:100%;height:100%;${style}"></div>`;
}

// ── CART ──
const Cart = {
  items: [],
  load() { try { this.items = JSON.parse(window.__EMAY_CART__ || "[]"); } catch { this.items = []; } },
  save() { window.__EMAY_CART__ = JSON.stringify(this.items); this.renderCount(); },
  add(productId, options={}, qty=1) {
    const p = findProduct(productId);
    if (!p) return;
    const lineId = productId + "::" + JSON.stringify(options);
    const existing = this.items.find(i => i.lineId === lineId);
    if (existing) { existing.qty += qty; }
    else {
      let price = p.price;
      if (options.frame) price += (FRAME_OPTIONS.find(f=>f.id===options.frame)?.priceAdd||0);
      if (options.size)  price += (SIZE_OPTIONS.find(s=>s.id===options.size)?.priceAdd||0);
      this.items.push({ lineId, productId, name: p.name, imgPath: p.imgPath, img: p.img, price, qty, options });
    }
    this.save();
    showToast(p.name + " added to bag");
    openCart();
  },
  remove(lineId) { this.items = this.items.filter(i=>i.lineId!==lineId); this.save(); renderCartDrawer(); },
  updateQty(lineId, qty) { const i=this.items.find(i=>i.lineId===lineId); if(i) i.qty=Math.max(1,qty); this.save(); renderCartDrawer(); },
  subtotal() { return this.items.reduce((s,i)=>s+(i.price*i.qty),0); },
  count()    { return this.items.reduce((s,i)=>s+i.qty,0); },
  renderCount() {
    document.querySelectorAll(".cart-count").forEach(el => {
      const c = this.count(); el.textContent = c; el.style.display = c>0?"flex":"none";
    });
  }
};
Cart.load();

// ── CART DRAWER ──
function openCart()  { document.getElementById("cartOverlay")?.classList.add("open"); document.getElementById("cartDrawer")?.classList.add("open"); renderCartDrawer(); }
function closeCart() { document.getElementById("cartOverlay")?.classList.remove("open"); document.getElementById("cartDrawer")?.classList.remove("open"); }

function renderCartDrawer() {
  const itemsEl = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");
  if (!itemsEl) return;
  if (!Cart.items.length) {
    itemsEl.innerHTML = `<div class="cart-empty">Your bag is empty.<br>Browse the collection to get started.</div>`;
    if (footerEl) footerEl.style.display = "none";
    return;
  }
  if (footerEl) footerEl.style.display = "block";
  itemsEl.innerHTML = Cart.items.map(item => {
    const opts = Object.entries(item.options||{}).map(([k,v]) => {
      if (k==="frame") return FRAME_OPTIONS.find(f=>f.id===v)?.name||v;
      if (k==="size")  return SIZE_OPTIONS.find(s=>s.id===v)?.name||v;
      return v;
    }).filter(Boolean).join(" · ");
    const thumbHtml = (item.imgPath && !item.imgPath.includes("placeholder"))
      ? `<img src="${item.imgPath}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;">`
      : `<div class="ph-box ${item.productId.startsWith("art")?"ph-art":"ph-bag"}" data-label="${item.img}" style="width:100%;height:100%;"></div>`;
    return `<div class="cart-line">
      <div class="cart-line-thumb">${thumbHtml}</div>
      <div style="flex:1;">
        <div class="cart-line-name">${item.name}</div>
        ${opts?`<div class="cart-line-meta">${opts}</div>`:""}
        <div class="cart-line-bottom">
          <div class="qty-stepper" style="height:34px;">
            <button onclick="Cart.updateQty('${item.lineId}',${item.qty-1})" style="height:32px;width:32px;">&minus;</button>
            <span>${item.qty}</span>
            <button onclick="Cart.updateQty('${item.lineId}',${item.qty+1})" style="height:32px;width:32px;">+</button>
          </div>
          <div style="font-weight:500;">${formatNaira(item.price*item.qty)}</div>
        </div>
        <div class="cart-line-remove" onclick="Cart.remove('${item.lineId}')">Remove</div>
      </div>
    </div>`;
  }).join("");
  const sub = document.getElementById("cartSubtotal");
  if (sub) sub.textContent = formatNaira(Cart.subtotal());
}

// ── TOAST ──
function showToast(msg) {
  let t = document.getElementById("siteToast");
  if (!t) { t = document.createElement("div"); t.id = "siteToast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 2400);
}

// ── ACCORDION ──
function toggleAccordion(el) { el.parentElement.classList.toggle("open"); }

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  Cart.renderCount();
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.querySelector(".mobile-menu-btn")?.addEventListener("click", () => {
    document.querySelector(".main-nav")?.classList.toggle("open");
  });
});
