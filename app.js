let currentIdToken = "";
let currentUser = null;
let novels = [];
let currentNovel = null;
let characters = [];
let filteredRole = "";
let currentCharacter = null;
let currentSection = "basic";
let wizardStep = 1;
let wizardReturn = "characters";

const screens = {
  login: document.getElementById("loginView"),
  novels: document.getElementById("novelsView"),
  novel: document.getElementById("novelView"),
  characters: document.getElementById("charactersView"),
  detail: document.getElementById("characterDetailView"),
  section: document.getElementById("characterSectionView"),
  wizard: document.getElementById("characterWizardView")
};

const sectionGroups = {
  basic: { title: "📋 基本資料", icon: "📋", fields: [["姓名","name"],["角色定位","role"],["性別","gender"],["年齡","age"],["身高","height"],["身分","identity"]] },
  setting: { title: "✨ 人物設定", icon: "✨", fields: [["外貌","appearance"],["個性","personality"],["喜歡","likes"],["討厭","dislikes"]] },
  ability: { title: "⚔️ 能力與過去", icon: "⚔️", fields: [["能力","abilities"],["缺點／弱點","weakness"],["童年／過去","past"]] },
  relation: { title: "👥 人際關係", icon: "👥", fields: [["與其他人物關係","relationships"]] },
  secret: { title: "🔒 秘密", icon: "🔒", fields: [["秘密／隱藏身分","secret"]] },
  notes: { title: "📝 備註", icon: "📝", fields: [["備註","notes"]] }
};

async function handleCredentialResponse(response) {
  const status = document.getElementById("loginStatus");
  if (!response?.credential) { status.textContent = "❌ Google 登入失敗"; return; }
  currentIdToken = response.credential;
  status.textContent = "正在驗證登入並讀取小說……";
  try {
    const data = await apiGet("bootstrap");
    currentUser = data.user || {};
    novels = data.novels || [];
    document.getElementById("welcomeText").textContent = `歡迎回來，${currentUser.name || currentUser.email || "創作者"}`;
    document.getElementById("logoutBtn").classList.remove("hidden");
    renderNovels();
    showScreen("novels");
  } catch (error) { status.textContent = `❌ ${error.message}`; }
}

async function apiGet(action, params = {}) {
  const url = new URL(APP_CONFIG.GAS_API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("idToken", currentIdToken);
  url.searchParams.set("_t", Date.now());
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const response = await fetch(url.toString(), { cache:"no-store", redirect:"follow" });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error("Apps Script 回傳格式錯誤"); }
  if (!result.success) throw new Error(result.error || "API 操作失敗");
  return result.data;
}

async function apiPost(action, payload = {}) {
  const response = await fetch(APP_CONFIG.GAS_API_URL, {
    method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action, idToken:currentIdToken, ...payload})
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error("Apps Script 回傳格式錯誤"); }
  if (!result.success) throw new Error(result.error || "API 操作失敗");
  return result.data;
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  const titles = {
    login:["📚 Novel AI Studio","小說世界，從一個角色開始。"],
    novels:["📚 Novel AI Studio","我的小說"],
    novel:[currentNovel ? `📖 ${currentNovel["書名"]}` : "📖 小說","小說資料中心"],
    characters:["👥 人物",currentNovel?.["書名"] || ""],
    detail:[currentCharacter ? `${emojiForRole(currentCharacter.role)} ${currentCharacter.name}` : "👤 人物","角色資料"],
    section:[sectionGroups[currentSection]?.title || "人物資料",currentCharacter?.name || ""],
    wizard:[document.getElementById("characterId").value ? "✏️ 編輯人物" : "＋ 新增人物",currentNovel?.["書名"] || ""]
  };
  document.getElementById("pageTitle").textContent = titles[name][0];
  document.getElementById("pageSubtitle").textContent = titles[name][1];
  document.getElementById("backBtn").classList.toggle("hidden", name === "login" || name === "novels");
  window.scrollTo(0,0);
}

function renderNovels() {
  const list = document.getElementById("novelList");
  list.innerHTML = novels.length ? novels.map(novel => `
    <button class="novel-card" type="button" onclick="openNovel('${safeAttr(novel["ID"])}')">
      <div class="card-title">📖 ${escapeHtml(novel["書名"] || "未命名小說")}</div>
      <div class="card-meta">${escapeHtml(novel["男主角"] || "未設定男主")} × ${escapeHtml(novel["女主角"] || "未設定女主")}</div>
      <div class="card-meta">${escapeHtml(novel["類型"] || "未分類")} ｜ ${escapeHtml(novel["狀態"] || "構思中")}</div>
    </button>`).join("") : '<div class="empty">目前還沒有小說。</div>';
}

async function openNovel(novelId) {
  currentNovel = novels.find(n => n["ID"] === novelId);
  if (!currentNovel) return showToast("找不到小說");
  document.getElementById("novelTitle").textContent = currentNovel["書名"] || "未命名小說";
  document.getElementById("novelLeads").textContent = `${currentNovel["男主角"] || "未設定男主"} × ${currentNovel["女主角"] || "未設定女主"}`;
  document.getElementById("novelStatus").textContent = currentNovel["狀態"] || "構思中";
  showScreen("novel");
  try {
    characters = await apiGet("getCharacters", {novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
  } catch (e) { document.getElementById("characterCount").textContent = "讀取失敗"; }
}

async function openCharacters() {
  showScreen("characters");
  document.getElementById("characterList").innerHTML = '<div class="empty">正在讀取人物……</div>';
  try {
    characters = await apiGet("getCharacters", {novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
    renderCharacters();
  } catch (e) { document.getElementById("characterList").innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
}

function renderCharacters() {
  const query = document.getElementById("characterSearch").value.trim().toLowerCase();
  const result = characters.filter(c => {
    const roleMatch = !filteredRole || c.role === filteredRole;
    const haystack = `${c.name || ""} ${c.role || ""} ${c.identity || ""}`.toLowerCase();
    return roleMatch && haystack.includes(query);
  });
  document.getElementById("characterList").innerHTML = result.length ? result.map(c => `
    <button class="character-card" type="button" onclick="openCharacterDetail('${safeAttr(c.id)}')">
      <div class="character-avatar">${emojiForRole(c.role)}</div>
      <div class="copy"><div class="card-title">${escapeHtml(c.name || "未命名人物")}</div><div class="card-meta">${escapeHtml(c.role || "未設定")} · ${escapeHtml(shortIdentity(c.identity))}</div></div>
      <div class="character-arrow">›</div>
    </button>`).join("") : '<div class="empty">找不到符合條件的人物。</div>';
}

function openCharacterDetail(characterId) {
  currentCharacter = characters.find(c => c.id === characterId);
  if (!currentCharacter) return showToast("找不到人物");
  document.getElementById("detailEmoji").textContent = emojiForRole(currentCharacter.role);
  document.getElementById("detailName").textContent = currentCharacter.name || "未命名人物";
  document.getElementById("detailIdentity").textContent = shortIdentity(currentCharacter.identity);
  document.getElementById("detailRole").textContent = currentCharacter.role || "未設定";
  document.getElementById("detailBasics").textContent = [currentCharacter.gender,currentCharacter.age,currentCharacter.height].filter(Boolean).join(" · ");

  const menu = ["basic","setting","ability","relation","secret","notes"];
  document.getElementById("detailMenu").innerHTML = menu.map(key => {
    const group = sectionGroups[key];
    const preview = group.fields.map(([,field]) => currentCharacter[field]).find(Boolean) || "尚未設定";
    return `<button class="settings-row" type="button" onclick="openCharacterSection('${key}')"><span class="settings-icon">${group.icon}</span><span><span class="settings-title">${group.title.replace(/^..\s/,"")}</span><span class="settings-preview">${escapeHtml(preview)}</span></span><span class="settings-arrow">›</span></button>`;
  }).join("");
  showScreen("detail");
}

function openCharacterSection(key) {
  currentSection = key;
  const group = sectionGroups[key];
  document.getElementById("sectionCards").innerHTML = group.fields.map(([label,field]) => `
    <article class="detail-card"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(currentCharacter[field] || "尚未設定")}</p></article>`).join("");
  showScreen("section");
}

function startNewCharacter() { openCharacterWizard(""); }
function editCharacterFromDetail() { if (currentCharacter) openCharacterWizard(currentCharacter.id, 1, "detail"); }
function editCurrentSection() {
  const stepMap = {basic:1,setting:2,ability:3,relation:4,secret:4,notes:4};
  if (currentCharacter) openCharacterWizard(currentCharacter.id, stepMap[currentSection] || 1, "section");
}

function openCharacterWizard(characterId = "", startStep = 1, returnTo = "characters") {
  const c = characters.find(x => x.id === characterId) || {};
  currentCharacter = characterId ? c : null;
  wizardReturn = returnTo;
  document.getElementById("characterId").value = c.id || "";
  const fields = ["name","role","gender","age","height","identity","appearance","personality","likes","dislikes","abilities","weakness","past","secret","relationships","notes"];
  fields.forEach(id => document.getElementById(id).value = c[id] || "");
  if (!characterId) { document.getElementById("role").value = "男主"; document.getElementById("gender").value = "男"; }
  wizardStep = startStep;
  renderWizardStep();
  showScreen("wizard");
}

function renderWizardStep() {
  document.querySelectorAll(".wizard-step").forEach(section => section.classList.toggle("hidden", Number(section.dataset.step) !== wizardStep));
  document.getElementById("wizardStepLabel").textContent = `步驟 ${wizardStep} / 4`;
  document.getElementById("wizardProgressBar").style.width = `${wizardStep * 25}%`;
  document.getElementById("wizardPrevBtn").textContent = wizardStep === 1 ? "取消" : "上一步";
  document.getElementById("wizardNextBtn").textContent = wizardStep === 4 ? "💾 儲存人物" : "下一步";
}

function wizardPrevious() {
  if (wizardStep > 1) { wizardStep--; renderWizardStep(); return; }
  if (wizardReturn === "section" && currentCharacter) return openCharacterSection(currentSection);
  if (wizardReturn === "detail" && currentCharacter) return openCharacterDetail(currentCharacter.id);
  showScreen("characters");
}

async function wizardNext() {
  if (wizardStep === 1 && !document.getElementById("name").value.trim()) { showToast("請先輸入人物姓名"); document.getElementById("name").focus(); return; }
  if (wizardStep < 4) { wizardStep++; renderWizardStep(); return; }
  await saveWizardCharacter();
}

async function saveWizardCharacter() {
  const characterId = document.getElementById("characterId").value.trim();
  const button = document.getElementById("wizardNextBtn");
  const fields = ["name","role","gender","age","height","identity","appearance","personality","likes","dislikes","abilities","weakness","past","secret","relationships","notes"];
  const data = Object.fromEntries(fields.map(id => [id, document.getElementById(id).value.trim()]));
  data.status = "存活";
  button.disabled = true; button.textContent = "儲存中……";
  try {
    const saved = characterId ? await apiPost("saveCharacter", {novelId:currentNovel["ID"], characterId, data}) : await apiPost("createCharacter", {novelId:currentNovel["ID"], data});
    characters = await apiGet("getCharacters", {novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
    currentCharacter = characters.find(c => c.id === saved.id) || saved;
    showToast(characterId ? "人物已更新" : "人物已建立");
    openCharacterDetail(currentCharacter.id);
  } catch (e) { showToast(e.message); }
  finally { button.disabled = false; renderWizardStep(); }
}

async function deleteCurrentCharacter() {
  if (!currentCharacter || !confirm(`確定刪除「${currentCharacter.name}」？`)) return;
  try {
    await apiPost("deleteCharacter", {novelId:currentNovel["ID"], characterId:currentCharacter.id});
    characters = await apiGet("getCharacters", {novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
    currentCharacter = null; renderCharacters(); showScreen("characters"); showToast("人物已刪除");
  } catch (e) { showToast(e.message); }
}

document.getElementById("characterSearch").addEventListener("input", renderCharacters);
document.getElementById("roleFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-role]"); if (!button) return;
  filteredRole = button.dataset.role;
  document.querySelectorAll(".filter-chip").forEach(x => x.classList.remove("active"));
  button.classList.add("active"); renderCharacters();
});

document.getElementById("backBtn").addEventListener("click", () => {
  if (!screens.wizard.classList.contains("hidden")) return wizardPrevious();
  if (!screens.section.classList.contains("hidden")) return openCharacterDetail(currentCharacter.id);
  if (!screens.detail.classList.contains("hidden")) return showScreen("characters");
  if (!screens.characters.classList.contains("hidden")) return showScreen("novel");
  if (!screens.novel.classList.contains("hidden")) return showScreen("novels");
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  currentIdToken = ""; currentUser = null; novels = []; characters = []; currentNovel = null; currentCharacter = null;
  google.accounts.id.disableAutoSelect();
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("loginStatus").textContent = "已登出，請重新登入 Google";
  showScreen("login");
});

function shortIdentity(value) { return String(value || "未設定身分").split(/[、，,]/)[0]; }
function emojiForRole(role) { return role === "男主" ? "👑" : role === "女主" ? "🌸" : role === "反派" ? "🖤" : "👤"; }
function showToast(message) { const t=document.getElementById("toast");t.textContent=message;t.classList.remove("hidden");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.add("hidden"),2400); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function safeAttr(value) { return String(value ?? "").replace(/['"\\]/g,""); }
