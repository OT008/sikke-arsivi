const config = window.SIKKE_CONFIG;
let githubToken = "";
const apiBase = "https://api.github.com";
const loginPanel = document.querySelector("#loginPanel");
const editorPanel = document.querySelector("#editorPanel");
const loginNotice = document.querySelector("#loginNotice");
const saveNotice = document.querySelector("#saveNotice");

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
  } catch (error) { githubToken = ""; setNotice(loginNotice, error.message, "error"); }
});

async function imageToWebP(file) {
  const bitmap = await createImageBitmap(file);
  const max = 2400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Fotoğraf dönüştürülemedi.")), "image/webp", .88));
  return blob;
}

function toBase64(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.onerror = reject; r.readAsDataURL(blob); });
}

async function putFile(path, content, message, sha) {
  return api(`/repos/${encodeURIComponent(config.adminUsername)}/${encodeURIComponent(config.repository)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, branch: config.branch, ...(sha ? { sha } : {}) })
  });
}

async function getJsonFile(path) {
  const file = await api(`/repos/${encodeURIComponent(config.adminUsername)}/${encodeURIComponent(config.repository)}/contents/${path}?ref=${encodeURIComponent(config.branch)}`);
  const binary = atob(file.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return { sha: file.sha, data: JSON.parse(new TextDecoder().decode(bytes)) };
}

function bindPreview(inputId, previewId) {
  document.querySelector(inputId).addEventListener("change", event => {
    const file = event.target.files[0]; const preview = document.querySelector(previewId);
    if (!file) { preview.textContent = "Fotoğraf seçilmedi"; return; }
    const url = URL.createObjectURL(file); preview.innerHTML = `<img src="${url}" alt="Seçilen fotoğraf önizlemesi">`;
  });
}
bindPreview("#frontImage", "#frontPreview"); bindPreview("#backImage", "#backPreview");

document.querySelector("#coinForm").addEventListener("submit", async event => {
  event.preventDefault();
  const saveButton = document.querySelector("#saveButton");
  const frontFile = document.querySelector("#frontImage").files[0];
  const backFile = document.querySelector("#backImage").files[0];
  if (!frontFile) return;
  saveButton.disabled = true; setNotice(saveNotice, "Fotoğraflar hazırlanıyor ve GitHub'a yükleniyor…");
  try {
    const id = `${new Date().toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,8)}`;
    const frontPath = `images/coins/${id}-on.webp`;
    await putFile(frontPath, await toBase64(await imageToWebP(frontFile)), `Yeni sikke fotoğrafı: ${id}`);
    let backPath = "";
    if (backFile) { backPath = `images/coins/${id}-arka.webp`; await putFile(backPath, await toBase64(await imageToWebP(backFile)), `Sikke arka yüzü: ${id}`); }
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
    event.target.reset(); document.querySelector("#frontPreview").textContent = "Ön yüz önizlemesi"; document.querySelector("#backPreview").textContent = "Arka yüz önizlemesi";
    setNotice(saveNotice, "Sikke başarıyla yüklendi. GitHub Pages birkaç dakika içinde galeriyi güncelleyecek.", "success");
  } catch (error) { setNotice(saveNotice, `${error.message}. Yükleme yarıda kaldıysa GitHub'daki images/coins klasörünü kontrol edin.`, "error"); }
  finally { saveButton.disabled = false; }
});

document.querySelector("#logoutButton").addEventListener("click", () => { githubToken = ""; editorPanel.classList.add("hidden"); loginPanel.classList.remove("hidden"); setNotice(loginNotice, "Güvenli şekilde çıkış yapıldı.", "success"); });
window.addEventListener("pagehide", () => { githubToken = ""; });
