
let currentIdToken = "";
let currentUser = null;
let novels = [];
let currentNovel = null;
let characters = [];
let filteredRole = "";
let currentCharacter = null;
let previousScreen = "characters";

const screens = {
  login: document.getElementById("loginView"),
  novels: document.getElementById("novelsView"),
  novel: document.getElementById("novelView"),
  characters: document.getElementById("charactersView"),
  detail: document.getElementById("characterDetailView"),
  editor: document.getElementById("characterEditorView")
};

async function handleCredentialResponse(response) {
  const status = document.getElementById("loginStatus");
  if (!response?.credential) {
    status.textContent = "❌ Google 登入失敗";
    return;
  }

  currentIdToken = response.credential;
  status.textContent = "正在驗證登入並讀取小說……";

  try {
    const data = await apiGet("bootstrap");
    currentUser = data.user || {};
    novels = data.novels || [];
    document.getElementById("welcomeText").textContent =
      `歡迎回來，${currentUser.name || currentUser.email || "創作者"}`;
    document.getElementById("logoutBtn").classList.remove("hidden");
    renderNovels();
    showScreen("novels");
  } catch (error) {
    status.textContent = `❌ ${error.message}`;
  }
}

async function apiGet(action, params = {}) {
  const url = new URL(APP_CONFIG.GAS_API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("idToken", currentIdToken);
  url.searchParams.set("_t", Date.now());

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {cache:"no-store", redirect:"follow"});
  const text = await response.text();

  let result;
  try { result = JSON.parse(text); }
  catch { throw new Error("Apps Script 回傳的不是 JSON，請確認部署已更新。"); }

  if (!result.success) throw new Error(result.error || "API 操作失敗");
  return result.data;
}

async function apiPost(action, payload = {}) {
  const response = await fetch(APP_CONFIG.GAS_API_URL, {
    method:"POST",
    redirect:"follow",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action, idToken:currentIdToken, ...payload})
  });

  const text = await response.text();
  let result;
  try { result = JSON.parse(text); }
  catch { throw new Error("Apps Script 回傳的不是 JSON，請確認部署已更新。"); }

  if (!result.success) throw new Error(result.error || "API 操作失敗");
  return result.data;
}

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");

  const map = {
    login:["📚 Novel AI Studio","小說世界，從一個角色開始。"],
    novels:["📚 Novel AI Studio","我的小說"],
    novel:[currentNovel ? `📖 ${currentNovel["書名"]}` : "📖 小說","小說資料中心"],
    characters:["👥 人物資料庫",currentNovel?.["書名"] || ""],
    detail:[currentCharacter ? `${emojiForRole(currentCharacter.role)} ${currentCharacter.name}` : "👤 人物","角色詳細資料"],
    editor:[document.getElementById("characterId").value ? "✏️ 編輯人物" : "＋ 新增人物",currentNovel?.["書名"] || ""]
  };

  document.getElementById("pageTitle").textContent = map[name][0];
  document.getElementById("pageSubtitle").textContent = map[name][1];
  document.getElementById("backBtn").classList.toggle("hidden", name === "login" || name === "novels");
  window.scrollTo(0,0);
}

function renderNovels() {
  const list = document.getElementById("novelList");
  if (!novels.length) {
    list.innerHTML = '<div class="empty">目前還沒有小說。</div>';
    return;
  }

  list.innerHTML = novels.map(novel => `
    <button class="novel-card" type="button" onclick="openNovel('${safeAttr(novel["ID"])}')">
      <div class="card-title">📖 ${escapeHtml(novel["書名"] || "未命名小說")}</div>
      <div class="card-meta">${escapeHtml(novel["男主角"] || "未設定男主")} × ${escapeHtml(novel["女主角"] || "未設定女主")}</div>
      <div class="card-meta">${escapeHtml(novel["類型"] || "未分類")} ｜ ${escapeHtml(novel["狀態"] || "構思中")}</div>
    </button>
  `).join("");
}

async function openNovel(novelId) {
  currentNovel = novels.find(item => item["ID"] === novelId);
  if (!currentNovel) return showToast("找不到小說");

  document.getElementById("novelTitle").textContent = currentNovel["書名"] || "未命名小說";
  document.getElementById("novelLeads").textContent =
    `${currentNovel["男主角"] || "未設定男主"} × ${currentNovel["女主角"] || "未設定女主"}`;
  document.getElementById("novelStatus").textContent = currentNovel["狀態"] || "構思中";
  showScreen("novel");

  try {
    characters = await apiGet("getCharacters",{novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
  } catch (error) {
    document.getElementById("characterCount").textContent = "讀取失敗";
    showToast(error.message);
  }
}

async function openCharacters() {
  showScreen("characters");
  document.getElementById("characterList").innerHTML = '<div class="empty">正在讀取人物……</div>';
  try {
    characters = await apiGet("getCharacters",{novelId:currentNovel["ID"]});
    renderCharacters();
  } catch (error) {
    document.getElementById("characterList").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderCharacters() {
  const query = document.getElementById("characterSearch").value.trim().toLowerCase();
  const result = characters.filter(character => {
    const roleMatch = !filteredRole || character.role === filteredRole;
    const haystack = `${character.name || ""} ${character.role || ""} ${character.identity || ""}`.toLowerCase();
    return roleMatch && haystack.includes(query);
  });

  const list = document.getElementById("characterList");
  if (!result.length) {
    list.innerHTML = '<div class="empty">找不到符合條件的人物。</div>';
    return;
  }

  list.innerHTML = result.map(character => `
    <button class="character-card" type="button" onclick="openCharacterDetail('${safeAttr(character.id)}')">
      <div class="character-avatar">${emojiForRole(character.role)}</div>
      <div class="copy">
        <div class="card-title">${escapeHtml(character.name || "未命名人物")}</div>
        <div class="card-meta">${escapeHtml(character.role || "未設定定位")} ｜ ${escapeHtml(character.identity || "未設定身分")}</div>
      </div>
      <div class="character-arrow">›</div>
    </button>
  `).join("");
}

function openCharacterDetail(characterId) {
  currentCharacter = characters.find(item => item.id === characterId);
  if (!currentCharacter) return showToast("找不到人物");

  document.getElementById("detailEmoji").textContent = emojiForRole(currentCharacter.role);
  document.getElementById("detailName").textContent = currentCharacter.name || "未命名人物";
  document.getElementById("detailMeta").textContent =
    [currentCharacter.gender,currentCharacter.age,currentCharacter.height].filter(Boolean).join(" ｜ ");
  document.getElementById("detailRole").textContent = currentCharacter.role || "未設定";

  const sections = [
    ["身分","identity"],["外貌","appearance"],["個性","personality"],["喜歡","likes"],
    ["討厭","dislikes"],["能力","abilities"],["缺點／弱點","weakness"],["童年／過去","past"],
    ["秘密／隱藏身分","secret"],["與其他人物關係","relationships"],["備註","notes"]
  ];

  document.getElementById("detailSections").innerHTML = sections
    .filter(([,key]) => currentCharacter[key])
    .map(([title,key]) => `<section class="detail-card"><h3>${title}</h3><p>${escapeHtml(currentCharacter[key])}</p></section>`)
    .join("") || '<div class="empty">這位角色還沒有詳細設定。</div>';

  showScreen("detail");
}

function openCharacterEditor(characterId = "") {
  previousScreen = characterId ? "detail" : "characters";
  const character = characters.find(item => item.id === characterId) || {};
  currentCharacter = characterId ? character : null;

  const fields = ["name","role","gender","age","height","identity","appearance","personality","likes","dislikes","abilities","weakness","past","secret","relationships","notes"];
  document.getElementById("characterId").value = character.id || "";
  fields.forEach(id => document.getElementById(id).value = character[id] || "");

  if (!characterId) {
    document.getElementById("role").value = "男主";
    document.getElementById("gender").value = "男";
  }
  showScreen("editor");
}

function editCurrentCharacter() {
  if (currentCharacter) openCharacterEditor(currentCharacter.id);
}

function cancelEditor() {
  showScreen(previousScreen);
}

document.getElementById("characterForm").addEventListener("submit", async event => {
  event.preventDefault();
  const characterId = document.getElementById("characterId").value.trim();
  const button = document.getElementById("saveCharacterBtn");
  button.disabled = true;
  button.textContent = "儲存中……";

  const ids = ["name","role","gender","age","height","identity","appearance","personality","likes","dislikes","abilities","weakness","past","secret","relationships","notes"];
  const data = Object.fromEntries(ids.map(id => [id, document.getElementById(id).value.trim()]));
  data.status = "存活";

  try {
    if (characterId) {
      currentCharacter = await apiPost("saveCharacter",{novelId:currentNovel["ID"],characterId,data});
      showToast("人物已更新");
    } else {
      currentCharacter = await apiPost("createCharacter",{novelId:currentNovel["ID"],data});
      showToast("人物已建立");
    }

    characters = await apiGet("getCharacters",{novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
    openCharacterDetail(currentCharacter.id);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "💾 儲存人物";
  }
});

async function deleteCurrentCharacter() {
  if (!currentCharacter) return;
  if (!confirm(`確定刪除「${currentCharacter.name}」？`)) return;

  try {
    await apiPost("deleteCharacter",{novelId:currentNovel["ID"],characterId:currentCharacter.id});
    characters = await apiGet("getCharacters",{novelId:currentNovel["ID"]});
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
    currentCharacter = null;
    showToast("人物已刪除");
    renderCharacters();
    showScreen("characters");
  } catch (error) {
    showToast(error.message);
  }
}

document.getElementById("characterSearch").addEventListener("input",renderCharacters);
document.getElementById("roleFilters").addEventListener("click",event => {
  const button = event.target.closest("[data-role]");
  if (!button) return;
  filteredRole = button.dataset.role;
  document.querySelectorAll(".filter-chip").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  renderCharacters();
});

document.getElementById("backBtn").addEventListener("click",() => {
  if (!screens.editor.classList.contains("hidden")) return cancelEditor();
  if (!screens.detail.classList.contains("hidden")) return showScreen("characters");
  if (!screens.characters.classList.contains("hidden")) return showScreen("novel");
  if (!screens.novel.classList.contains("hidden")) return showScreen("novels");
});

document.getElementById("logoutBtn").addEventListener("click",() => {
  currentIdToken = ""; currentUser = null; novels = []; characters = [];
  google.accounts.id.disableAutoSelect();
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("loginStatus").textContent = "已登出，請重新登入 Google";
  showScreen("login");
});

function emojiForRole(role) {
  if (role === "男主") return "👑";
  if (role === "女主") return "🌸";
  if (role === "反派") return "🖤";
  return "👤";
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message; toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"),2400);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g,char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function safeAttr(value) {
  return String(value ?? "").replace(/['"\\]/g,"");
}
