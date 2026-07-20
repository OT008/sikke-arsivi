const grid = document.querySelector("#coinGrid");
const search = document.querySelector("#search");
const countryFilter = document.querySelector("#countryFilter");
const dialog = document.querySelector("#coinDialog");
let coins = [];

const clean = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const known = value => value || "Bilinmiyor";

function render(items) {
  if (!items.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-mark">S</div><h3>${coins.length ? "Eşleşen parça bulunamadı" : "Arşiv ilk parçasını bekliyor"}</h3><p>${coins.length ? "Arama veya filtreyi değiştirebilirsiniz." : "Yönetici panelinden ilk sikkenizi ekleyin."}</p></div>`;
    return;
  }
  grid.innerHTML = items.map(coin => `
    <article class="coin-card" tabindex="0" data-id="${clean(coin.id)}" aria-label="${clean(coin.title || "İsimsiz sikke")} ayrıntılarını aç">
      <div class="coin-photo">
        ${coin.frontImage ? `<img src="${clean(coin.frontImage)}" alt="${clean(coin.title || "Sikke")} ön yüzü" loading="lazy">` : `<div class="coin-placeholder">S</div>`}
        <span class="tag">${clean(coin.status || "Arşivde")}</span>
      </div>
      <div class="card-body"><h3>${clean(coin.title || "Tanımlanmayı bekliyor")}</h3><div class="meta"><span>${clean(known(coin.country))}</span><span>${clean(known(coin.year))}</span><span>${clean(known(coin.denomination))}</span></div></div>
    </article>`).join("");
}

function showDetail(coin) {
  document.querySelector("#coinDetail").innerHTML = `
    <div class="detail"><div class="detail-image">${coin.frontImage ? `<img src="${clean(coin.frontImage)}" alt="${clean(coin.title)}">` : `<div class="coin-placeholder">S</div>`}</div>
    <div class="detail-info"><div class="eyebrow">${clean(coin.status || "Arşivde")}</div><h2>${clean(coin.title || "Tanımlanmayı bekliyor")}</h2>
      <div class="detail-list"><div><span>Ülke</span><strong>${clean(known(coin.country))}</strong></div><div><span>Yıl</span><strong>${clean(known(coin.year))}</strong></div><div><span>Değer</span><strong>${clean(known(coin.denomination))}</strong></div><div><span>Malzeme</span><strong>${clean(known(coin.material))}</strong></div></div>
      ${coin.backImage ? `<p><a href="${clean(coin.backImage)}" target="_blank" rel="noopener">Arka yüz fotoğrafını aç →</a></p>` : ""}
      <p class="detail-note">${clean(coin.notes || "Bu parça hakkındaki bilgiler henüz araştırılıyor.")}</p></div></div>`;
  dialog.showModal();
}

function applyFilters() {
  const q = search.value.trim().toLocaleLowerCase("tr");
  const country = countryFilter.value;
  render(coins.filter(c => (!country || c.country === country) && !q || (!country || c.country === country) && [c.title,c.country,c.year,c.denomination,c.material].join(" ").toLocaleLowerCase("tr").includes(q)));
}

fetch(`data/coins.json?v=${Date.now()}`).then(r => {
  if (!r.ok) throw new Error("Kayıtlar yüklenemedi");
  return r.json();
}).then(data => {
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
