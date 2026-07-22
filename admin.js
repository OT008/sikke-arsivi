const config = window.SIKKE_CONFIG;
let githubToken = "";
const apiBase = "https://api.github.com";
const loginPanel = document.querySelector("#loginPanel");
const editorPanel = document.querySelector("#editorPanel");
const loginNotice = document.querySelector("#loginNotice");
const saveNotice = document.querySelector("#saveNotice");
const imageNotice = document.querySelector("#imageNotice");
const managerNotice = document.querySelector("#managerNotice");
const adminCoinList = document.querySelector("#adminCoinList");
let adminCoins = [];

const clean = (value) => String(value ?? "").replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[character]));
const repoPath = path => `/repos/${encodeURIComponent(config.adminUsername)}/${encodeURIComponent(config.repository)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

function setNotice(el, message, type = "") {
  el.className = `notice ${type}`.trim();
  el.textContent = message;
}

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${githubToken}`, "X-GitHub-Api-Version": "2022-11-28", ...(options.headers || {}) }
  });
  if (!response.ok) {
    let message = `GitHub hatası (${response.status})`;
    try { message = (await response.json()).message || message; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

document.querySelector("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!config || !config.adminUsername || config.adminUsername === "GITHUB_KULLANICI_ADINIZ") {
    setNotice(loginNotice, "Önce config.js dosyasına GitHub kullanıcı adınızı yazmalısınız.", "error"); return;
  }
  githubToken = document.querySelector("#token").value.trim();
  setNotice(loginNotice, "GitHub hesabı doğrulanıyor…");
  try {
    const user = await api("/user");
    if (user.login.toLowerCase() !== config.adminUsername.toLowerCase()) throw new Error("Bu GitHub hesabının yönetici yetkisi yok.");
    await api(`/repos/${encodeURIComponent(config.adminUsername)}/${encodeURIComponent(config.repository)}`);
    document.querySelector("#token").value = "";
    document.querySelector("#adminIdentity").textContent = `${user.login} olarak bağlısınız. Yeni kayıt doğrudan ${config.repository} deposuna eklenecek.`;
    loginPanel.classList.add("hidden"); editorPanel.classList.remove("hidden");
    await loadAdminCoins();
  } catch (error) { githubToken = ""; setNotice(loginNotice, error.message, "error"); }
});

async function imageToWebP(file) {
  const bitmap = await createImageBitmap(file);
  const max = 2000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Fotoğraf dönüştürülemedi.")), "image/webp", .88));
  return blob;
}

function toBase64(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.onerror = reject; r.readAsDataURL(blob); });
}

async function putFile(path, content, message, sha) {
  return api(repoPath(path), {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, branch: config.branch, ...(sha ? { sha } : {}) })
  });
}

async function getJsonFile(path) {
  const file = await api(`${repoPath(path)}?ref=${encodeURIComponent(config.branch)}`);
  const binary = atob(file.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return { sha: file.sha, data: JSON.parse(new TextDecoder().decode(bytes)) };
}

function updateImageNotice() {
  const messages = ["#frontImage", "#backImage"].map(selector => document.querySelector(selector).dataset.imageMessage).filter(Boolean);
  if (!messages.length) {
    imageNotice.className = "notice hidden";
    imageNotice.textContent = "";
    return;
  }
  setNotice(imageNotice, messages.join(" "), "warning");
}

function bindPreview(inputId, previewId, faceName) {
  document.querySelector(inputId).addEventListener("change", async event => {
    const file = event.target.files[0]; const preview = document.querySelector(previewId);
    event.target.dataset.imageMessage = "";
    if (!file) { preview.textContent = "Fotoğraf seçilmedi"; updateImageNotice(); return; }
    const url = URL.createObjectURL(file); preview.innerHTML = `<img src="${url}" alt="Seçilen fotoğraf önizlemesi">`;
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      const isSquare = Math.abs(width - height) / Math.max(width, height) <= .02;
      if (!isSquare) event.target.dataset.imageMessage = `${faceName} görseli ${width} × ${height} px. Kırpılmayacak; en temiz görünüm için yüklemeden önce 1600 × 1600 px kare hazırlayın.`;
      else if (width < 1200) event.target.dataset.imageMessage = `${faceName} görseli ${width} × ${height} px. Kare oranı doğru, ancak daha net sonuç için 1600 × 1600 px önerilir.`;
    } catch {
      event.target.dataset.imageMessage = `${faceName} görselinin ölçüsü okunamadı. Dosyanın geçerli bir JPEG, PNG veya WebP olduğundan emin olun.`;
    }
    updateImageNotice();
  });
}
bindPreview("#frontImage", "#frontPreview", "Ön yüz");
bindPreview("#backImage", "#backPreview", "Arka yüz");

function renderAdminCoins() {
  if (!adminCoins.length) {
    adminCoinList.innerHTML = `<div class="manager-empty">Arşivde henüz kayıtlı para yok.</div>`;
    return;
  }
  adminCoinList.innerHTML = adminCoins.map(coin => `
    <article class="admin-coin-row" data-id="${clean(coin.id)}">
      <div class="admin-coin-thumb">${coin.frontImage ? `<img src="${clean(coin.frontImage)}" alt="">` : `<span>S</span>`}</div>
      <div class="admin-coin-copy">
        <strong>${clean(coin.title || "Tanımlanmayı bekliyor")}</strong>
        <span>${clean([coin.country, coin.year, coin.denomination].filter(Boolean).join(" · ") || "Bilgi eklenmemiş")}</span>
      </div>
      <button class="delete-button" type="button" data-delete-id="${clean(coin.id)}" aria-label="${clean(coin.title || "Bu kaydı")} sil">Sil</button>
    </article>`).join("");
}

async function loadAdminCoins() {
  setNotice(managerNotice, "Arşiv kayıtları yükleniyor…");
  adminCoinList.innerHTML = "";
  try {
    const current = await getJsonFile("data/coins.json");
    adminCoins = Array.isArray(current.data) ? current.data : [];
    renderAdminCoins();
    managerNotice.className = "notice hidden";
  } catch (error) {
    setNotice(managerNotice, `Kayıt listesi yüklenemedi: ${error.message}`, "error");
  }
}

const isManagedImage = path => typeof path === "string" && /^images\/coins\/[a-zA-Z0-9._/-]+$/.test(path) && !path.includes("..");

async function deleteRepoFile(path, message) {
  const file = await api(`${repoPath(path)}?ref=${encodeURIComponent(config.branch)}`);
  return api(repoPath(path), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: file.sha, branch: config.branch })
  });
}

async function deleteCoin(coin, button) {
  if (!coin || !window.confirm(`“${coin.title || "Bu kayıt"}” arşivden ve görselleriyle birlikte kalıcı olarak silinsin mi?`)) return;
  button.disabled = true;
  setNotice(managerNotice, "Kayıt siliniyor…");
  try {
    const current = await getJsonFile("data/coins.json");
    const currentCoins = Array.isArray(current.data) ? current.data : [];
    const updatedCoins = currentCoins.filter(item => item.id !== coin.id);
    if (updatedCoins.length === currentCoins.length) throw new Error("Kayıt arşivde bulunamadı; listeyi yenileyip tekrar deneyin");

    const encoded = await toBase64(new Blob([JSON.stringify(updatedCoins, null, 2) + "\n"], { type: "application/json" }));
    await putFile("data/coins.json", encoded, `Arşivden sikke sil: ${coin.title || coin.id}`, current.sha);

    const imageErrors = [];
    const imagePaths = [...new Set([coin.frontImage, coin.backImage].filter(isManagedImage))];
    for (const path of imagePaths) {
      try { await deleteRepoFile(path, `Silinen sikkenin görselini kaldır: ${coin.id}`); }
      catch (error) { imageErrors.push(error.message); }
    }

    adminCoins = updatedCoins;
    renderAdminCoins();
    if (imageErrors.length) setNotice(managerNotice, "Kayıt silindi; ancak görsel dosyalarından biri depoda kalmış olabilir.", "warning");
    else setNotice(managerNotice, "Kayıt ve ön/arka yüz görselleri başarıyla silindi.", "success");
  } catch (error) {
    setNotice(managerNotice, `Silme işlemi tamamlanamadı: ${error.message}`, "error");
    button.disabled = false;
  }
}

adminCoinList.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  deleteCoin(adminCoins.find(coin => coin.id === button.dataset.deleteId), button);
});

document.querySelector("#refreshCoinsButton").addEventListener("click", loadAdminCoins);

document.querySelector("#coinForm").addEventListener("submit", async event => {
  event.preventDefault();
  const saveButton = document.querySelector("#saveButton");
  const frontFile = document.querySelector("#frontImage").files[0];
  const backFile = document.querySelector("#backImage").files[0];
  if (!frontFile || !backFile) {
    setNotice(saveNotice, "Lütfen paranın hem ön hem arka yüz fotoğrafını seçin.", "error");
    return;
  }
  saveButton.disabled = true; setNotice(saveNotice, "Fotoğraflar hazırlanıyor ve GitHub'a yükleniyor…");
  try {
    const id = `${new Date().toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,8)}`;
    const frontPath = `images/coins/${id}-on.webp`;
    await putFile(frontPath, await toBase64(await imageToWebP(frontFile)), `Yeni sikke fotoğrafı: ${id}`);
    const backPath = `images/coins/${id}-arka.webp`;
    await putFile(backPath, await toBase64(await imageToWebP(backFile)), `Sikke arka yüzü: ${id}`);
    const current = await getJsonFile("data/coins.json");
    const coin = {
      id, title: document.querySelector("#title").value.trim() || "Tanımlanmayı bekliyor",
      country: document.querySelector("#country").value.trim(), year: document.querySelector("#coinYear").value.trim(),
      denomination: document.querySelector("#denomination").value.trim(), material: document.querySelector("#material").value.trim(),
      status: document.querySelector("#status").value, notes: document.querySelector("#notes").value.trim(),
      frontImage: frontPath, backImage: backPath, addedAt: new Date().toISOString()
    };
    const data = Array.isArray(current.data) ? [coin, ...current.data] : [coin];
    const encoded = await toBase64(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }));
    await putFile("data/coins.json", encoded, `Arşive yeni sikke ekle: ${coin.title}`, current.sha);
    adminCoins = data;
    renderAdminCoins();
    event.target.reset(); document.querySelector("#frontPreview").textContent = "Ön yüz önizlemesi"; document.querySelector("#backPreview").textContent = "Arka yüz önizlemesi";
    imageNotice.className = "notice hidden";
    setNotice(saveNotice, "Sikke başarıyla yüklendi. GitHub Pages birkaç dakika içinde galeriyi güncelleyecek.", "success");
  } catch (error) { setNotice(saveNotice, `${error.message}. Yükleme yarıda kaldıysa GitHub'daki images/coins klasörünü kontrol edin.`, "error"); }
  finally { saveButton.disabled = false; }
});

document.querySelector("#logoutButton").addEventListener("click", () => { githubToken = ""; editorPanel.classList.add("hidden"); loginPanel.classList.remove("hidden"); setNotice(loginNotice, "Güvenli şekilde çıkış yapıldı.", "success"); });
window.addEventListener("pagehide", () => { githubToken = ""; });
