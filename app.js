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
let worldData = {};
let currentWorldSection = "overview";
let worldEditorReturn = "world";

const screens = {
  login: document.getElementById("loginView"),
  novels: document.getElementById("novelsView"),
  novel: document.getElementById("novelView"),
  characters: document.getElementById("charactersView"),
  detail: document.getElementById("characterDetailView"),
  section: document.getElementById("characterSectionView"),
  wizard: document.getElementById("characterWizardView"),
  world: document.getElementById("worldView"),
  worldDetail: document.getElementById("worldDetailView"),
  worldEditor: document.getElementById("worldEditorView")
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("連線逾時，請再試一次。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
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

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    },
    20000
  );

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Apps Script 回傳格式錯誤，請確認部署版本。");
  }

  if (!result.success) {
    throw new Error(result.error || "API 操作失敗");
  }

  return result.data;
}

async function apiPost(action, payload = {}) {
  const response = await fetchWithTimeout(
    APP_CONFIG.GAS_API_URL,
    {
      method: "POST",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        idToken: currentIdToken,
        ...payload
      })
    },
    25000
  );

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Apps Script 回傳格式錯誤，請確認部署版本。");
  }

  if (!result.success) {
    throw new Error(result.error || "API 操作失敗");
  }

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
    wizard:[document.getElementById("characterId").value ? "✏️ 編輯人物" : "＋ 新增人物",currentNovel?.["書名"] || ""],
    world:["🌍 世界觀",currentNovel?.["書名"] || ""],
    worldDetail:[worldSectionTitle(currentWorldSection),currentNovel?.["書名"] || ""],
    worldEditor:["✏️ " + worldSectionTitle(currentWorldSection),currentNovel?.["書名"] || ""]
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

  const fields = [
    "name","role","gender","age","height","identity",
    "appearance","personality","likes","dislikes",
    "abilities","weakness","past","secret",
    "relationships","notes"
  ];

  const data = Object.fromEntries(
    fields.map(id => [
      id,
      document.getElementById(id).value.trim()
    ])
  );

  data.status = "存活";

  button.disabled = true;
  button.textContent = "☁️ 儲存中……";
  showToast("正在儲存到雲端…");

  try {
    let saved;

    if (characterId) {
      saved = await apiPost("saveCharacter", {
        novelId: currentNovel["ID"],
        characterId,
        data
      });

      // 直接使用後端回傳的新資料更新本機，不再重新 GET characters.json
      const index = characters.findIndex(
        character => character.id === saved.id
      );

      if (index >= 0) {
        characters[index] = saved;
      } else {
        characters.push(saved);
      }

      currentCharacter = saved;
      showToast("✅ 人物已更新");

    } else {
      saved = await apiPost("createCharacter", {
        novelId: currentNovel["ID"],
        data
      });

      // 新人物直接加入本機陣列，不再重新讀整份 JSON
      characters.push(saved);
      currentCharacter = saved;
      showToast("✅ 人物已建立");
    }

    document.getElementById("characterCount").textContent =
      `${characters.length} 位`;

    openCharacterDetail(saved.id);

  } catch (error) {
    console.error(error);
    showToast(error.message || "儲存失敗，請再試一次。");
  } finally {
    button.disabled = false;
    renderWizardStep();
  }
}

async function deleteCurrentCharacter() {
  if (
    !currentCharacter ||
    !confirm(`確定刪除「${currentCharacter.name}」？`)
  ) {
    return;
  }

  const deletingId = currentCharacter.id;

  try {
    await apiPost("deleteCharacter", {
      novelId: currentNovel["ID"],
      characterId: deletingId
    });

    // 本機直接刪除，不再重新 GET 整份人物
    characters = characters.filter(
      character => character.id !== deletingId
    );

    document.getElementById("characterCount").textContent =
      `${characters.length} 位`;

    currentCharacter = null;
    renderCharacters();
    showScreen("characters");
    showToast("✅ 人物已刪除");

  } catch (error) {
    console.error(error);
    showToast(error.message || "刪除失敗。");
  }
}


const WORLD_SECTIONS = {
  overview:{icon:"🌍",title:"世界概要",preview:["worldName","era"],help:"先定義故事所在的世界、時代與整體基調。",fields:[["世界／王朝名稱","worldName","input","例如：大晉王朝"],["年代／時代","era","input","例如：架空古代"],["世界概要","summary","textarea","這個世界最核心的設定"]]},
  nation:{icon:"🏯",title:"國家／朝代",preview:["nation"],help:"記錄國家、朝代、疆域與統治核心。",fields:[["國家／朝代","nation","textarea","主要國家、朝代與疆域"],["皇室／統治者","ruler","textarea","皇帝、皇族、權力核心"]]},
  history:{icon:"📜",title:"歷史",preview:["history"],help:"重要歷史事件、戰爭、政權更替與傳說。",fields:[["歷史","history","textarea","重要年代與歷史事件"]]},
  politics:{icon:"⚖️",title:"政治制度",preview:["politics"],help:"朝廷、官制、爵位、權力分配與法律。",fields:[["政治制度","politics","textarea","官制、爵位、權力架構"],["法律／禁忌","laws","textarea","法律、刑罰、社會禁忌"]]},
  culture:{icon:"🏮",title:"文化風俗",preview:["culture"],help:"衣食住行、禮儀、婚俗、節慶與社會習慣。",fields:[["文化風俗","culture","textarea","禮儀、婚俗、生活方式"],["節慶","festivals","textarea","重要節日與活動"]]},
  economy:{icon:"💰",title:"貨幣經濟",preview:["currency"],help:"貨幣、物價、商業、產業與財富制度。",fields:[["貨幣","currency","textarea","例如：銅錢、銀兩、金票"],["經濟／商業","economy","textarea","商業、產業、稅制"]]},
  calendar:{icon:"🗓️",title:"時間曆法",preview:["calendar"],help:"紀年方式、月份、時辰與時間規則。",fields:[["時間／曆法","calendar","textarea","紀年、月份、時辰等"]]},
  power:{icon:"⚔️",title:"武學／修煉",preview:["powerSystem"],help:"能力來源、等級、限制與戰力規則。",fields:[["武學／修煉體系","powerSystem","textarea","境界、能力、武學"],["能力限制","powerRules","textarea","代價、限制、禁止事項"]]},
  medical:{icon:"🌿",title:"醫療",preview:["medical"],help:"醫術、藥材、毒術、治療方式與醫療限制。",fields:[["醫療體系","medical","textarea","醫術、藥材、毒術、治療"]]},
  religion:{icon:"🕯️",title:"宗教信仰",preview:["religion"],help:"神祇、宗教、祭祀、信仰與民間傳說。",fields:[["宗教／信仰","religion","textarea","神祇、祭祀、信仰"]]},
  other:{icon:"📝",title:"其他設定",preview:["other"],help:"任何還沒有適合分類的位置都可以放在這裡。",fields:[["其他設定","other","textarea","補充設定"]]}
};
function worldSectionTitle(k){return WORLD_SECTIONS[k]?.title||"世界觀"}
async function openWorld(){
  showScreen("world");
  const list=document.getElementById("worldSectionList");
  list.innerHTML='<div class="empty">正在讀取世界觀……</div>';
  try{worldData=await apiGet("getWorld",{novelId:currentNovel["ID"]})||{};renderWorld()}
  catch(e){console.error(e);list.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
}
function renderWorld(){
  worldName.textContent=worldData.worldName||worldData.nation||"尚未設定世界名稱";
  worldEra.textContent=worldData.era||"建立這本小說的世界規則";
  const fields=Object.values(WORLD_SECTIONS).flatMap(s=>s.fields.map(f=>f[1]));
  const filled=fields.filter(k=>String(worldData[k]||"").trim()).length;
  const pct=fields.length?Math.round(filled/fields.length*100):0;
  worldCompletion.textContent=`${pct}%`;worldStatus.textContent=filled?`${pct}%`:"尚未設定";renderWorldSections()
}
function renderWorldSections(){
  const q=worldSearch.value.trim().toLowerCase();
  const entries=Object.entries(WORLD_SECTIONS).filter(([,s])=>[s.title,...s.fields.map(f=>worldData[f[1]]||"")].join(" ").toLowerCase().includes(q));
  worldSectionList.innerHTML=entries.length?entries.map(([k,s])=>{
    const p=s.preview.map(f=>worldData[f]).find(v=>String(v||"").trim())||"尚未設定";
    return `<button class="settings-row" type="button" onclick="openWorldDetail('${k}')"><span class="settings-icon">${s.icon}</span><span class="settings-copy"><span class="settings-title">${s.title}</span><span class="settings-preview">${escapeHtml(p)}</span></span><span class="settings-arrow">›</span></button>`
  }).join(""):'<div class="empty">找不到符合條件的世界觀設定。</div>'
}
function openWorldDetail(k){
  currentWorldSection=k;const s=WORLD_SECTIONS[k];if(!s)return;
  worldDetailContent.innerHTML=s.fields.map(([label,key])=>`<article class="detail-card"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(worldData[key]||"尚未設定")}</p></article>`).join("");
  showScreen("worldDetail")
}
function editCurrentWorldSection(){openWorldEditor(currentWorldSection)}
function openWorldEditor(k="overview"){
  currentWorldSection=k;worldEditorReturn=!screens.worldDetail.classList.contains("hidden")?"worldDetail":"world";
  const s=WORLD_SECTIONS[k];if(!s)return;
  worldEditorFields.innerHTML=`<section class="panel world-editor-panel"><h2>${s.icon} ${s.title}</h2><p class="muted">${s.help}</p>${s.fields.map(([label,key,type,ph])=>{
    const v=escapeHtml(worldData[key]||"");
    return type==="textarea"?`<label>${escapeHtml(label)}</label><textarea id="world_${key}" placeholder="${escapeHtml(ph||"")}">${v}</textarea>`:`<label>${escapeHtml(label)}</label><input id="world_${key}" value="${v}" placeholder="${escapeHtml(ph||"")}">`
  }).join("")}</section>`;
  showScreen("worldEditor")
}
function cancelWorldEditor(){worldEditorReturn==="worldDetail"?openWorldDetail(currentWorldSection):showScreen("world")}
worldForm.addEventListener("submit",async e=>{
  e.preventDefault();const s=WORLD_SECTIONS[currentWorldSection];if(!s)return;
  const patch={};s.fields.forEach(([,k])=>patch[k]=document.getElementById(`world_${k}`).value.trim());
  saveWorldBtn.disabled=true;saveWorldBtn.textContent="☁️ 儲存中……";
  try{const saved=await apiPost("saveWorld",{novelId:currentNovel["ID"],data:patch});worldData=saved||{...worldData,...patch};renderWorld();showToast("✅ 世界觀已儲存");openWorldDetail(currentWorldSection)}
  catch(err){console.error(err);showToast(err.message||"世界觀儲存失敗。")}
  finally{saveWorldBtn.disabled=false;saveWorldBtn.textContent="💾 儲存世界觀"}
});
worldSearch.addEventListener("input",renderWorldSections);

document.getElementById("characterSearch").addEventListener("input", renderCharacters);
document.getElementById("roleFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-role]"); if (!button) return;
  filteredRole = button.dataset.role;
  document.querySelectorAll(".filter-chip").forEach(x => x.classList.remove("active"));
  button.classList.add("active"); renderCharacters();
});

document.getElementById("backBtn").addEventListener("click", () => {
  if (!screens.worldEditor.classList.contains("hidden")) return cancelWorldEditor();
  if (!screens.worldDetail.classList.contains("hidden")) return showScreen("world");
  if (!screens.world.classList.contains("hidden")) return showScreen("novel");
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


/* =========================================================
 * v1.1.1 Speed Fix
 * 手機按鈕事件使用正式 listener，不依賴 inline onclick
 * =======================================================*/
(function bindWizardButtonsForMobile() {
  const nextButton = document.getElementById("wizardNextBtn");
  const prevButton = document.getElementById("wizardPrevBtn");

  if (nextButton) {
    nextButton.removeAttribute("onclick");
    nextButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      if (!nextButton.disabled) {
        wizardNext();
      }
    }, { passive: false });
  }

  if (prevButton) {
    prevButton.removeAttribute("onclick");
    prevButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      wizardPrevious();
    }, { passive: false });
  }
})();
