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
const coinForm = document.querySelector("#coinForm");
const saveButton = document.querySelector("#saveButton");
const frontImageInput = document.querySelector("#frontImage");
const backImageInput = document.querySelector("#backImage");
const refreshCoinsButton = document.querySelector("#refreshCoinsButton");
const beginDeleteButton = document.querySelector("#beginDeleteButton");
const confirmDeleteButton = document.querySelector("#confirmDeleteButton");
const cancelDeleteButton = document.querySelector("#cancelDeleteButton");
const managerHelp = document.querySelector("#managerHelp");
let adminCoins = [];
let editingCoinId = "";
let deleteSelectionMode = false;
let deleteOperationBusy = false;
const selectedCoinIds = new Set();
const previewObjectUrls = new Map();

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
    document.querySelector("#adminIdentity").textContent = `${user.login} olarak bağlısınız. Kayıt değişiklikleri doğrudan ${config.repository} deposuna yazılacak.`;
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

function clearPreviewObjectUrl(inputId) {
  const oldUrl = previewObjectUrls.get(inputId);
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  previewObjectUrls.delete(inputId);
}

function showPreview(previewId, imagePath, alt, emptyText) {
  const preview = document.querySelector(previewId);
  preview.innerHTML = imagePath ? `<img src="${clean(imagePath)}" alt="${clean(alt)}">` : clean(emptyText);
}

function resetImagePreviews(coin = null) {
  clearPreviewObjectUrl("#frontImage");
  clearPreviewObjectUrl("#backImage");
  showPreview("#frontPreview", coin?.frontImage, "Mevcut ön yüz fotoğrafı", "Ön yüz önizlemesi");
  showPreview("#backPreview", coin?.backImage, "Mevcut arka yüz fotoğrafı", "Arka yüz önizlemesi");
}

function currentEditingCoin() {
  return adminCoins.find(coin => coin.id === editingCoinId);
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
    clearPreviewObjectUrl(inputId);
    if (!file) {
      const coin = currentEditingCoin();
      const existingPath = inputId === "#frontImage" ? coin?.frontImage : coin?.backImage;
      showPreview(previewId, existingPath, `Mevcut ${faceName.toLocaleLowerCase("tr")} fotoğrafı`, "Fotoğraf seçilmedi");
      updateImageNotice();
      return;
    }
    const url = URL.createObjectURL(file);
    previewObjectUrls.set(inputId, url);
    preview.innerHTML = `<img src="${url}" alt="Seçilen ${clean(faceName.toLocaleLowerCase("tr"))} fotoğrafı önizlemesi">`;
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

function setEditMode(enabled, coin = null) {
  editingCoinId = enabled && coin ? coin.id : "";
  coinForm.reset();
  frontImageInput.required = !enabled;
  backImageInput.required = !enabled;
  frontImageInput.dataset.imageMessage = "";
  backImageInput.dataset.imageMessage = "";
  imageNotice.className = "notice hidden";
  saveNotice.className = "notice hidden";

  document.querySelector("#editorEyebrow").textContent = enabled ? "Arşiv kaydını düzenleme" : "Koleksiyona yeni kayıt";
  document.querySelector("#editorTitle").textContent = enabled ? "Para bilgilerini düzenle" : "Yeni para ekle";
  document.querySelector("#frontImageLabel").textContent = enabled ? "Ön yüz fotoğrafını değiştir" : "Ön yüz fotoğrafı *";
  document.querySelector("#backImageLabel").textContent = enabled ? "Arka yüz fotoğrafını değiştir" : "Arka yüz fotoğrafı *";
  document.querySelector("#imageGuideText").innerHTML = enabled
    ? "Mevcut fotoğraflar aşağıda gösteriliyor. Yalnızca değiştirmek istediğiniz yüz için yeni bir dosya seçin. Yeni fotoğraf kaydedildikten sonra eski dosya depodan otomatik silinir."
    : "Ön ve arka yüzü yüklemeden önce <b>1600 × 1600 px</b> kare kırpın. Parayı tam ortaya alın, çevresinde yaklaşık %8–10 boşluk bırakın ve iki yüzde de aynı ölçeği kullanın. Site görseli kırpmaz; yalnızca gerekirse küçültüp WebP biçimine dönüştürür.";
  saveButton.textContent = enabled ? "Değişiklikleri kaydet ve yayınla" : "GitHub'a yükle ve yayınla";
  document.querySelector("#cancelEditButton").classList.toggle("hidden", !enabled);

  if (enabled && coin) {
    document.querySelector("#title").value = coin.title || "";
    document.querySelector("#country").value = coin.country || "";
    document.querySelector("#coinYear").value = coin.year || "";
    document.querySelector("#denomination").value = coin.denomination || "";
    document.querySelector("#material").value = coin.material || "";
    document.querySelector("#status").value = coin.status || "Tanımlanmayı bekliyor";
    document.querySelector("#notes").value = coin.notes || "";
  }

  resetImagePreviews(enabled ? coin : null);
  renderAdminCoins();
}

function startEditingCoin(coin) {
  if (!coin) return;
  setEditMode(true, coin);
  document.querySelector("#editorTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelector("#cancelEditButton").addEventListener("click", () => setEditMode(false));

function renderAdminCoins() {
  if (!adminCoins.length) {
    adminCoinList.innerHTML = `<div class="manager-empty">Arşivde henüz kayıtlı para yok.</div>`;
    return;
  }
  adminCoinList.innerHTML = adminCoins.map(coin => `
    <article class="admin-coin-row${coin.id === editingCoinId ? " is-editing" : ""}${selectedCoinIds.has(coin.id) ? " is-selected" : ""}" data-id="${clean(coin.id)}"${deleteSelectionMode ? ` aria-selected="${selectedCoinIds.has(coin.id)}"` : ""}>
      <div class="admin-coin-thumb"><img src="${coin.frontImage ? clean(coin.frontImage) : "icon.svg"}" alt=""></div>
      <div class="admin-coin-copy">
        <strong>${clean(coin.title || "Tanımlanmayı bekliyor")}</strong>
        <span>${clean([coin.country, coin.year, coin.denomination].filter(Boolean).join(" · ") || "Bilgi eklenmemiş")}</span>
      </div>
      <div class="admin-row-actions">
        ${deleteSelectionMode
          ? `<label class="coin-select"><input type="checkbox" data-select-id="${clean(coin.id)}" aria-label="${clean(coin.title || "Bu kaydı")} silmek için seç"${selectedCoinIds.has(coin.id) ? " checked" : ""}${deleteOperationBusy ? " disabled" : ""}><span>${selectedCoinIds.has(coin.id) ? "Seçildi" : "Seç"}</span></label>`
          : `<button class="edit-button" type="button" data-edit-id="${clean(coin.id)}" aria-label="${clean(coin.title || "Bu kaydı")} düzenle">Düzenle</button>`}
      </div>
    </article>`).join("");
}

async function loadAdminCoins() {
  setNotice(managerNotice, "Arşiv kayıtları yükleniyor…");
  adminCoinList.innerHTML = "";
  try {
    const current = await getJsonFile("data/coins.json");
    adminCoins = Array.isArray(current.data) ? current.data : [];
    if (editingCoinId && !currentEditingCoin()) setEditMode(false);
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

function updateDeleteControls() {
  beginDeleteButton.classList.toggle("hidden", deleteSelectionMode);
  confirmDeleteButton.classList.toggle("hidden", !deleteSelectionMode);
  cancelDeleteButton.classList.toggle("hidden", !deleteSelectionMode);
  refreshCoinsButton.disabled = deleteSelectionMode;
  confirmDeleteButton.disabled = deleteOperationBusy || selectedCoinIds.size === 0;
  cancelDeleteButton.disabled = deleteOperationBusy;
  confirmDeleteButton.textContent = selectedCoinIds.size ? `Silmeyi onayla (${selectedCoinIds.size})` : "Silmeyi onayla";
  managerHelp.textContent = deleteSelectionMode
    ? "Silmek istediğiniz paraları listeden seçin. Seçiminiz bittiğinde Silmeyi onayla'ya basın veya işlemden çıkmak için Vazgeç'i kullanın."
    : "Bilgileri veya fotoğrafları değiştirmek için Düzenle'yi kullanın. Değiştirilen eski fotoğraf depodan otomatik kaldırılır.";
}

function setDeleteSelectionMode(enabled, keepNotice = false) {
  if (enabled && editingCoinId) setEditMode(false);
  deleteSelectionMode = enabled;
  if (!enabled) deleteOperationBusy = false;
  selectedCoinIds.clear();
  updateDeleteControls();
  renderAdminCoins();
  if (!keepNotice) managerNotice.className = "notice hidden";
}

async function deleteSelectedCoins() {
  if (!selectedCoinIds.size) return;
  const idsToDelete = new Set(selectedCoinIds);
  deleteOperationBusy = true;
  updateDeleteControls();
  renderAdminCoins();
  setNotice(managerNotice, `${idsToDelete.size} kayıt siliniyor…`);
  try {
    const current = await getJsonFile("data/coins.json");
    const currentCoins = Array.isArray(current.data) ? current.data : [];
    const coinsToDelete = currentCoins.filter(coin => idsToDelete.has(coin.id));
    if (!coinsToDelete.length) throw new Error("Seçilen kayıtlar arşivde bulunamadı; listeyi yenileyip tekrar deneyin");
    const updatedCoins = currentCoins.filter(coin => !idsToDelete.has(coin.id));

    const encoded = await toBase64(new Blob([JSON.stringify(updatedCoins, null, 2) + "\n"], { type: "application/json" }));
    await putFile("data/coins.json", encoded, `Arşivden ${coinsToDelete.length} sikke sil`, current.sha);

    const imageErrors = [];
    const imagePaths = [...new Set(coinsToDelete.flatMap(coin => [coin.frontImage, coin.backImage]).filter(isManagedImage))];
    for (const path of imagePaths) {
      try { await deleteRepoFile(path, `Toplu silinen sikke görselini kaldır`); }
      catch (error) { imageErrors.push(error.message); }
    }

    adminCoins = updatedCoins;
    deleteOperationBusy = false;
    setDeleteSelectionMode(false, true);
    if (imageErrors.length) setNotice(managerNotice, `${coinsToDelete.length} kayıt silindi; ancak görsel dosyalarından biri depoda kalmış olabilir.`, "warning");
    else setNotice(managerNotice, `${coinsToDelete.length} kayıt ve bunlara ait ön/arka yüz görselleri başarıyla silindi.`, "success");
  } catch (error) {
    deleteOperationBusy = false;
    updateDeleteControls();
    renderAdminCoins();
    setNotice(managerNotice, `Toplu silme işlemi tamamlanamadı: ${error.message}`, "error");
  }
}

adminCoinList.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    startEditingCoin(adminCoins.find(coin => coin.id === editButton.dataset.editId));
  }
});

adminCoinList.addEventListener("change", event => {
  const checkbox = event.target.closest("[data-select-id]");
  if (!checkbox || !deleteSelectionMode || deleteOperationBusy) return;
  if (checkbox.checked) selectedCoinIds.add(checkbox.dataset.selectId);
  else selectedCoinIds.delete(checkbox.dataset.selectId);
  updateDeleteControls();
  renderAdminCoins();
});

beginDeleteButton.addEventListener("click", () => setDeleteSelectionMode(true));
cancelDeleteButton.addEventListener("click", () => setDeleteSelectionMode(false));
confirmDeleteButton.addEventListener("click", deleteSelectedCoins);
refreshCoinsButton.addEventListener("click", loadAdminCoins);

coinForm.addEventListener("submit", async event => {
  event.preventDefault();
  const frontFile = frontImageInput.files[0];
  const backFile = backImageInput.files[0];
  const isEditing = Boolean(editingCoinId);
  if (!isEditing && (!frontFile || !backFile)) {
    setNotice(saveNotice, "Lütfen paranın hem ön hem arka yüz fotoğrafını seçin.", "error");
    return;
  }

  saveButton.disabled = true;
  setNotice(saveNotice, isEditing ? "Değişiklikler hazırlanıyor ve GitHub'a kaydediliyor…" : "Fotoğraflar hazırlanıyor ve GitHub'a yükleniyor…");
  try {
    const current = await getJsonFile("data/coins.json");
    const currentCoins = Array.isArray(current.data) ? current.data : [];
    const storedCoin = isEditing ? currentCoins.find(coin => coin.id === editingCoinId) : null;
    if (isEditing && !storedCoin) throw new Error("Düzenlenen kayıt arşivde bulunamadı; listeyi yenileyip tekrar deneyin");

    const id = storedCoin?.id || `${new Date().toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,8)}`;
    const revision = crypto.randomUUID().slice(0,8);
    let frontPath = storedCoin?.frontImage || "";
    let backPath = storedCoin?.backImage || "";

    if (frontFile) {
      frontPath = isEditing ? `images/coins/${id}-on-${revision}.webp` : `images/coins/${id}-on.webp`;
      await putFile(frontPath, await toBase64(await imageToWebP(frontFile)), `${isEditing ? "Sikke ön yüzünü güncelle" : "Yeni sikke fotoğrafı"}: ${id}`);
    }
    if (backFile) {
      backPath = isEditing ? `images/coins/${id}-arka-${revision}.webp` : `images/coins/${id}-arka.webp`;
      await putFile(backPath, await toBase64(await imageToWebP(backFile)), `${isEditing ? "Sikke arka yüzünü güncelle" : "Sikke arka yüzü"}: ${id}`);
    }

    const coin = {
      ...(storedCoin || {}), id, title: document.querySelector("#title").value.trim() || "Tanımlanmayı bekliyor",
      country: document.querySelector("#country").value.trim(), year: document.querySelector("#coinYear").value.trim(),
      denomination: document.querySelector("#denomination").value.trim(), material: document.querySelector("#material").value.trim(),
      status: document.querySelector("#status").value, notes: document.querySelector("#notes").value.trim(),
      frontImage: frontPath, backImage: backPath,
      ...(isEditing ? { updatedAt: new Date().toISOString() } : { addedAt: new Date().toISOString() })
    };
    const data = isEditing ? currentCoins.map(item => item.id === coin.id ? coin : item) : [coin, ...currentCoins];
    const encoded = await toBase64(new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" }));
    await putFile("data/coins.json", encoded, `${isEditing ? "Sikke bilgilerini güncelle" : "Arşive yeni sikke ekle"}: ${coin.title}`, current.sha);

    const oldImageErrors = [];
    if (isEditing) {
      const replacedOldPaths = [
        frontFile && storedCoin.frontImage !== frontPath ? storedCoin.frontImage : "",
        backFile && storedCoin.backImage !== backPath ? storedCoin.backImage : ""
      ].filter(isManagedImage);
      for (const path of [...new Set(replacedOldPaths)]) {
        try { await deleteRepoFile(path, `Değiştirilen eski sikke görselini kaldır: ${id}`); }
        catch (error) { oldImageErrors.push(error.message); }
      }
    }

    adminCoins = data;
    setEditMode(false);
    if (oldImageErrors.length) setNotice(saveNotice, "Bilgiler ve yeni fotoğraf kaydedildi; ancak eski fotoğraf dosyalarından biri depoda kalmış olabilir.", "warning");
    else setNotice(saveNotice, isEditing ? "Para bilgileri ve fotoğrafları başarıyla güncellendi. Galeri birkaç dakika içinde yenilenecek." : "Sikke başarıyla yüklendi. GitHub Pages birkaç dakika içinde galeriyi güncelleyecek.", "success");
  } catch (error) {
    setNotice(saveNotice, `${error.message}. İşlem tamamlanmadıysa mevcut kayıt ve eski fotoğraflar korunur; yeni yüklenen ancak kullanılmayan bir dosya depoda kalmış olabilir.`, "error");
  }
  finally { saveButton.disabled = false; }
});

document.querySelector("#logoutButton").addEventListener("click", () => { githubToken = ""; setDeleteSelectionMode(false); setEditMode(false); editorPanel.classList.add("hidden"); loginPanel.classList.remove("hidden"); setNotice(loginNotice, "Güvenli şekilde çıkış yapıldı.", "success"); });
window.addEventListener("pagehide", () => { githubToken = ""; });
