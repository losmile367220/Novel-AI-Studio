
let currentIdToken = "";
let currentUser = null;
let novels = [];
let currentNovel = null;
let characters = [];

const views = {
  login: document.getElementById("loginView"),
  novels: document.getElementById("novelsView"),
  novel: document.getElementById("novelView"),
  characters: document.getElementById("charactersView")
};

async function handleCredentialResponse(response) {
  const status = document.getElementById("loginStatus");

  if (!response || !response.credential) {
    status.textContent = "❌ Google 登入失敗，請再試一次。";
    return;
  }

  currentIdToken = response.credential;
  status.textContent = "正在驗證登入並讀取小說……";

  try {
    const result = await apiGet("bootstrap");
    currentUser = result.user || {};
    novels = result.novels || [];

    document.getElementById("welcomeText").textContent =
      `歡迎回來，${currentUser.name || currentUser.email || "創作者"}`;

    document.getElementById("logoutBtn").classList.remove("hidden");
    renderNovels();
    showView("novels");
  } catch (error) {
    status.textContent = `❌ ${error.message || "登入失敗"}`;
  }
}

async function apiGet(action, params = {}) {
  const url = new URL(APP_CONFIG.GAS_API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("idToken", currentIdToken);
  url.searchParams.set("_t", Date.now().toString());

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
    cache: "no-store"
  });

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Apps Script 回傳的不是 JSON，請確認部署已更新。");
  }

  if (!result.success) {
    throw new Error(result.error || "API 操作失敗");
  }

  return result.data;
}

async function apiPost(action, payload = {}) {
  const response = await fetch(APP_CONFIG.GAS_API_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      idToken: currentIdToken,
      ...payload
    })
  });

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Apps Script 回傳的不是 JSON，請確認部署已更新。");
  }

  if (!result.success) {
    throw new Error(result.error || "API 操作失敗");
  }

  return result.data;
}

function showView(name) {
  Object.values(views).forEach(view => view.classList.add("hidden"));
  views[name].classList.remove("hidden");

  const backBtn = document.getElementById("backBtn");
  backBtn.classList.toggle("hidden", name === "login" || name === "novels");

  const titles = {
    login: ["📚 Novel AI Studio", "小說世界，從一個角色開始。"],
    novels: ["📚 Novel AI Studio", "我的小說"],
    novel: [currentNovel ? `📖 ${currentNovel["書名"]}` : "📖 小說", "小說資料中心"],
    characters: ["👥 人物資料庫", currentNovel ? currentNovel["書名"] : ""]
  };

  document.getElementById("pageTitle").textContent = titles[name][0];
  document.getElementById("pageSubtitle").textContent = titles[name][1];
  window.scrollTo(0, 0);
}

function renderNovels() {
  const list = document.getElementById("novelList");

  if (!novels.length) {
    list.innerHTML = '<div class="empty">目前還沒有小說。</div>';
    return;
  }

  list.innerHTML = novels.map(novel => `
    <article class="novel-card" onclick="openNovel('${escapeAttr(novel["ID"])}')">
      <div class="card-title">📖 ${escapeHtml(novel["書名"] || "未命名小說")}</div>
      <div class="card-meta">
        ${escapeHtml(novel["男主角"] || "未設定男主")} ×
        ${escapeHtml(novel["女主角"] || "未設定女主")}
      </div>
      <div class="card-meta">
        ${escapeHtml(novel["類型"] || "未分類")} ｜ 
        ${escapeHtml(novel["狀態"] || "構思中")}
      </div>
      <div class="card-meta">${escapeHtml(novel["ID"] || "")}</div>
    </article>
  `).join("");
}

async function openNovel(novelId) {
  currentNovel = novels.find(item => item["ID"] === novelId);

  if (!currentNovel) {
    showToast("找不到小說");
    return;
  }

  document.getElementById("novelTitle").textContent =
    currentNovel["書名"] || "未命名小說";
  document.getElementById("novelLeads").textContent =
    `${currentNovel["男主角"] || "未設定男主"} × ${currentNovel["女主角"] || "未設定女主"}`;
  document.getElementById("novelStatus").textContent =
    currentNovel["狀態"] || "構思中";

  showView("novel");

  try {
    characters = await apiGet("getCharacters", {
      novelId: currentNovel["ID"]
    });
    document.getElementById("characterCount").textContent =
      `${characters.length} 位`;
  } catch (error) {
    document.getElementById("characterCount").textContent = "讀取失敗";
    showToast(error.message);
  }
}

async function openCharacters() {
  if (!currentNovel) return;

  showView("characters");
  const list = document.getElementById("characterList");
  list.innerHTML = '<div class="empty">正在讀取人物……</div>';

  try {
    characters = await apiGet("getCharacters", {
      novelId: currentNovel["ID"]
    });
    renderCharacters();
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderCharacters() {
  const list = document.getElementById("characterList");

  if (!characters.length) {
    list.innerHTML = '<div class="empty">還沒有角色，點右上角「＋新增人物」。</div>';
    return;
  }

  list.innerHTML = characters.map(character => `
    <article class="character-card">
      <div class="card-title">${characterEmoji(character.role)} ${escapeHtml(character.name || "未命名人物")}</div>
      <div class="card-meta">${escapeHtml(character.role || "未設定定位")} ｜ ${escapeHtml(character.identity || "未設定身分")}</div>
      <div class="card-meta">${escapeHtml(character.gender || "")} ${escapeHtml(character.age || "")} ${escapeHtml(character.height || "")}</div>
      <div class="card-actions">
        <button class="gray" type="button" onclick="openCharacterForm('${escapeAttr(character.id)}')">編輯</button>
        <button class="danger" type="button" onclick="removeCharacter('${escapeAttr(character.id)}')">刪除</button>
      </div>
    </article>
  `).join("");
}

function openCharacterForm(characterId = "") {
  const character = characters.find(item => item.id === characterId) || {};

  document.getElementById("modalTitle").textContent =
    characterId ? "編輯人物" : "新增人物";

  const fields = [
    "id","name","role","gender","age","height","identity","appearance",
    "personality","likes","dislikes","abilities","weakness","past",
    "secret","relationships","notes"
  ];

  fields.forEach(field => {
    const element = document.getElementById(field === "id" ? "characterId" : field);
    if (element) element.value = character[field] || "";
  });

  if (!characterId) {
    document.getElementById("role").value = "男主";
    document.getElementById("gender").value = "男";
  }

  document.getElementById("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("characterForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentNovel) return;

  const characterId = document.getElementById("characterId").value.trim();
  const saveBtn = document.getElementById("saveCharacterBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "儲存中……";

  const data = {
    name: valueOf("name"),
    role: valueOf("role"),
    gender: valueOf("gender"),
    age: valueOf("age"),
    height: valueOf("height"),
    identity: valueOf("identity"),
    appearance: valueOf("appearance"),
    personality: valueOf("personality"),
    likes: valueOf("likes"),
    dislikes: valueOf("dislikes"),
    abilities: valueOf("abilities"),
    weakness: valueOf("weakness"),
    past: valueOf("past"),
    secret: valueOf("secret"),
    relationships: valueOf("relationships"),
    notes: valueOf("notes"),
    status: "存活"
  };

  try {
    if (characterId) {
      await apiPost("saveCharacter", {
        novelId: currentNovel["ID"],
        characterId,
        data
      });
      showToast("人物已更新");
    } else {
      await apiPost("createCharacter", {
        novelId: currentNovel["ID"],
        data
      });
      showToast("人物已建立");
    }

    closeModal();
    await openCharacters();
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
  } catch (error) {
    showToast(error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 儲存人物";
  }
});

async function removeCharacter(characterId) {
  const character = characters.find(item => item.id === characterId);
  const name = character ? character.name : characterId;

  if (!confirm(`確定刪除「${name}」？`)) return;

  try {
    await apiPost("deleteCharacter", {
      novelId: currentNovel["ID"],
      characterId
    });
    showToast("人物已刪除");
    await openCharacters();
    document.getElementById("characterCount").textContent = `${characters.length} 位`;
  } catch (error) {
    showToast(error.message);
  }
}

document.getElementById("backBtn").addEventListener("click", () => {
  if (!views.characters.classList.contains("hidden")) {
    showView("novel");
  } else if (!views.novel.classList.contains("hidden")) {
    showView("novels");
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  currentIdToken = "";
  currentUser = null;
  currentNovel = null;
  novels = [];
  characters = [];
  google.accounts.id.disableAutoSelect();
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("loginStatus").textContent = "已登出，請重新登入 Google";
  showView("login");
});

function valueOf(id) {
  return document.getElementById(id).value.trim();
}

function characterEmoji(role) {
  if (role === "男主") return "👑";
  if (role === "女主") return "🌸";
  if (role === "反派") return "🖤";
  return "👤";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);
}

function escapeAttr(value) {
  return String(value ?? "").replace(/['"\\]/g, "");
}
