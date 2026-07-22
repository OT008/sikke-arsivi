const grid = document.querySelector("#coinGrid");
const search = document.querySelector("#search");
const countryFilter = document.querySelector("#countryFilter");
const dialog = document.querySelector("#coinDialog");
const config = window.SIKKE_CONFIG;
const encodedBranchPath = String(config?.branch || "main").split("/").map(encodeURIComponent).join("/");
const rawBase = config?.adminUsername && config?.repository
  ? `https://raw.githubusercontent.com/${encodeURIComponent(config.adminUsername)}/${encodeURIComponent(config.repository)}/${encodedBranchPath}/`
  : "";
let coins = [];

const clean = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const known = value => value || "Bilinmiyor";
const rawFileUrl = path => {
  const value = String(path || "");
  if (!value || /^(?:https?:|data:|blob:)/i.test(value) || !rawBase) return value;
  return `${rawBase}${value.split("/").map(encodeURIComponent).join("/")}`;
};

function render(items) {
  if (!items.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-mark"><img src="icon.svg" alt="" aria-hidden="true"></div><h3>${coins.length ? "Eşleşen parça bulunamadı" : "Arşiv ilk parçasını bekliyor"}</h3><p>${coins.length ? "Arama veya filtreyi değiştirebilirsiniz." : "Yönetici panelinden ilk sikkenizi ekleyin."}</p></div>`;
    return;
  }
  grid.innerHTML = items.map(coin => `
    <article class="coin-card" tabindex="0" data-id="${clean(coin.id)}" aria-label="${clean(coin.title || "İsimsiz sikke")} ayrıntılarını aç">
      <div class="coin-photo">
        ${coin.frontImage ? `<img src="${clean(rawFileUrl(coin.frontImage))}" alt="${clean(coin.title || "Sikke")} ön yüzü" loading="lazy">` : `<div class="coin-placeholder"><img src="icon.svg" alt="" aria-hidden="true"></div>`}
        <span class="tag">${clean(coin.status || "Arşivde")}</span>
      </div>
      <div class="card-body"><h3>${clean(coin.title || "Tanımlanmayı bekliyor")}</h3><div class="meta"><span>${clean(known(coin.country))}</span><span>${clean(known(coin.year))}</span><span>${clean(known(coin.denomination))}</span></div></div>
    </article>`).join("");
}

function showDetail(coin) {
  if (!coin) return;
  const face = (src, label) => `
    <figure class="detail-face">
      <div class="detail-image">${src ? `<img src="${clean(rawFileUrl(src))}" alt="${clean(coin.title || "Sikke")} ${label.toLocaleLowerCase("tr")}">` : `<div class="coin-placeholder" aria-hidden="true"><img src="icon.svg" alt=""></div>`}</div>
      <figcaption>${label}${src ? "" : " fotoğrafı henüz eklenmedi"}</figcaption>
    </figure>`;
  document.querySelector("#coinDetail").innerHTML = `
    <article class="detail">
      <div class="detail-gallery">${face(coin.frontImage, "Ön yüz")}${face(coin.backImage, "Arka yüz")}</div>
      <div class="detail-info"><div class="eyebrow">${clean(coin.status || "Arşivde")}</div><h2>${clean(coin.title || "Tanımlanmayı bekliyor")}</h2>
      <div class="detail-list"><div><span>Ülke</span><strong>${clean(known(coin.country))}</strong></div><div><span>Yıl</span><strong>${clean(known(coin.year))}</strong></div><div><span>Değer</span><strong>${clean(known(coin.denomination))}</strong></div><div><span>Malzeme</span><strong>${clean(known(coin.material))}</strong></div></div>
      <p class="detail-note">${clean(coin.notes || "Bu parça hakkındaki bilgiler henüz araştırılıyor.")}</p></div>
    </article>`;
  dialog.showModal();
}

function applyFilters() {
  const q = search.value.trim().toLocaleLowerCase("tr");
  const country = countryFilter.value;
  render(coins.filter(c => {
    const matchesCountry = !country || c.country === country;
    const haystack = [c.title, c.country, c.year, c.denomination, c.material].join(" ").toLocaleLowerCase("tr");
    return matchesCountry && (!q || haystack.includes(q));
  }));
}

async function fetchCoins() {
  const sources = [
    rawBase ? `${rawBase}data/coins.json?v=${Date.now()}` : "",
    `data/coins.json?v=${Date.now()}`
  ].filter(Boolean);
  let lastError;
  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error("Kayıtlar yüklenemedi");
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Kayıtlar yüklenemedi");
}

fetchCoins().then(data => {
  coins = Array.isArray(data) ? data : [];
  const countries = [...new Set(coins.map(c => c.country).filter(Boolean))].sort((a,b) => a.localeCompare(b,"tr"));
  countryFilter.insertAdjacentHTML("beforeend", countries.map(c => `<option>${clean(c)}</option>`).join(""));
  document.querySelector("#totalCount").textContent = coins.length;
  document.querySelector("#countryCount").textContent = countries.length;
  const years = coins.map(c => Number.parseInt(c.year,10)).filter(Number.isFinite);
  document.querySelector("#oldestYear").textContent = years.length ? Math.min(...years) : "—";
  render(coins);
}).catch(() => render([]));

grid.addEventListener("click", e => { const card = e.target.closest(".coin-card"); if (card) showDetail(coins.find(c => c.id === card.dataset.id)); });
grid.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".coin-card")) { e.preventDefault(); showDetail(coins.find(c => c.id === e.target.dataset.id)); } });
search.addEventListener("input", applyFilters);
countryFilter.addEventListener("change", applyFilters);
dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
document.querySelector("#year").textContent = new Date().getFullYear();
