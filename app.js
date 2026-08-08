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
let factions = [];
let filteredFactionType = "";
let currentFaction = null;
let currentFactionSection = "basic";
let factionEditorReturn = "factions";
let relations = [];
let relationReturn = "detail";
let workspaceChapter = null;
let workspaceSaveTimer = null;
let workspaceDirty = false;
let workspaceAITask = "continue";
let aiSelectedTask = "continue";
let chapters = [];
let currentChapter = null;
let chapterSaveTimer = null;
let chapterDirty = false;
let timelineEvents = [];
let editingTimelineEventId = "";
let timelineReturn = "novel";
let characterLinks = [];
let editingCharacterLinkId = "";

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
  worldEditor: document.getElementById("worldEditorView"),
  factions: document.getElementById("factionsView"),
  factionDetail: document.getElementById("factionDetailView"),
  factionSection: document.getElementById("factionSectionView"),
  factionEditor: document.getElementById("factionEditorView"),
  relationEditor: document.getElementById("relationEditorView"),
  characterLinkEditor: document.getElementById("characterLinkEditorView"),
  relationshipGraph: document.getElementById("relationshipGraphView"),
  timeline: document.getElementById("timelineView"),
  timelineEditor: document.getElementById("timelineEditorView"),
  chapters: document.getElementById("chaptersView"),
  chapterEditor: document.getElementById("chapterEditorView"),
  aiWriter: document.getElementById("aiWriterView"),
  creativeWorkspace: document.getElementById("creativeWorkspaceView")
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
    worldEditor:["✏️ " + worldSectionTitle(currentWorldSection),currentNovel?.["書名"] || ""],
    factions:["🏯 勢力資料庫",currentNovel?.["書名"] || ""],
    factionDetail:[currentFaction ? `${factionEmoji(currentFaction.type)} ${currentFaction.name}` : "🏯 勢力",currentNovel?.["書名"] || ""],
    factionSection:[factionSectionGroups[currentFactionSection]?.title || "勢力資料",currentFaction?.name || ""],
    factionEditor:[document.getElementById("factionId")?.value ? "✏️ 編輯勢力" : "＋ 新增勢力",currentNovel?.["書名"] || ""],
    relationEditor:["🔗 關聯系統",currentNovel?.["書名"] || ""],
    characterLinkEditor:["👥 人物關係",currentNovel?.["書名"] || ""],
    relationshipGraph:["🕸️ 關係圖譜",currentNovel?.["書名"] || ""],
    timeline:["📜 劇情時間線",currentNovel?.["書名"] || ""],
    timelineEditor:["✍️ 編輯事件",currentNovel?.["書名"] || ""],
    chapters:["📖 章節管理",currentNovel?.["書名"] || ""],
    chapterEditor:["✍️ 章節編輯器",currentNovel?.["書名"] || ""],
    aiWriter:["🤖 AI 寫作助手",currentNovel?.["書名"] || ""],
    creativeWorkspace:["📝 創作工作台",currentNovel?.["書名"] || ""]
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
  try { factions = await apiGet("getFactions", {novelId:currentNovel["ID"]}); document.getElementById("factionCount").textContent = `${factions.length} 個`; } catch(e) { document.getElementById("factionCount").textContent = "讀取失敗"; }
  try { relations = await apiGet("getRelations", {novelId:currentNovel["ID"]}) || []; } catch(e) { console.warn("關聯資料讀取失敗", e); relations = []; }
  try { characterLinks = await apiGet("getCharacterRelations", {novelId:currentNovel["ID"]}) || []; } catch(e) { console.warn("人物關係讀取失敗", e); characterLinks = []; }
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
  renderCharacterRelations();
  renderCharacterLinks();
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


/* v1.3 勢力資料庫 */
const factionSectionGroups={
 basic:{title:"📋 基本資料",icon:"📋",fields:[["名稱","name"],["類型","type"],["領袖／負責人","leader"],["所在地","location"],["立場","stance"]]},
 power:{title:"🏯 勢力與資源",icon:"🏯",fields:[["勢力範圍","scope"],["核心成員","members"],["資源／能力","resources"]]},
 relation:{title:"🤝 關係網",icon:"🤝",fields:[["盟友","allies"],["敵對勢力","enemies"]]},
 goal:{title:"🎯 目的與行動",icon:"🎯",fields:[["主要目的","goal"],["目前行動／計畫","plans"]]},
 secret:{title:"🔒 秘密",icon:"🔒",fields:[["秘密／隱藏設定","secret"]]},
 notes:{title:"📝 備註",icon:"📝",fields:[["備註","notes"]]}
};
function factionEmoji(type){return ({"皇室／朝廷":"👑","王府":"🏯","商會":"💰","江湖門派":"⚔️","情報／殺手組織":"🌑","家族／世家":"🏛️","軍隊":"🛡️"})[type]||"🏯"}
async function openFactions(){showScreen("factions");factionList.innerHTML='<div class="empty">正在讀取勢力……</div>';try{factions=await apiGet("getFactions",{novelId:currentNovel["ID"]})||[];factionCount.textContent=`${factions.length} 個`;renderFactions()}catch(e){factionList.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}}
function renderFactions(){const q=factionSearch.value.trim().toLowerCase();const rows=factions.filter(f=>(!filteredFactionType||f.type===filteredFactionType)&&`${f.name||""} ${f.type||""} ${f.leader||""} ${f.stance||""} ${f.location||""}`.toLowerCase().includes(q));factionList.innerHTML=rows.length?rows.map(f=>`<button class="character-card" type="button" onclick="openFactionDetail('${safeAttr(f.id)}')"><div class="character-avatar">${factionEmoji(f.type)}</div><div class="copy"><div class="card-title">${escapeHtml(f.name||"未命名勢力")}</div><div class="card-meta">${escapeHtml(f.type||"未分類")} · ${escapeHtml(f.leader||f.stance||"尚未設定")}</div></div><div class="character-arrow">›</div></button>`).join(""):'<div class="empty">找不到符合條件的勢力。</div>'}
function openFactionDetail(id){currentFaction=factions.find(f=>f.id===id);if(!currentFaction)return showToast("找不到勢力");factionDetailEmoji.textContent=factionEmoji(currentFaction.type);factionDetailName.textContent=currentFaction.name||"未命名勢力";factionDetailSummary.textContent=currentFaction.leader?`領袖：${currentFaction.leader}`:(currentFaction.location||"尚未設定領袖");factionDetailType.textContent=currentFaction.type||"未分類";factionDetailStance.textContent=currentFaction.stance||"";factionDetailMenu.innerHTML=Object.entries(factionSectionGroups).map(([k,g])=>{const p=g.fields.map(([,x])=>currentFaction[x]).find(Boolean)||"尚未設定";return `<button class="settings-row" type="button" onclick="openFactionSection('${k}')"><span class="settings-icon">${g.icon}</span><span class="settings-copy"><span class="settings-title">${g.title.replace(/^..\\s/,"")}</span><span class="settings-preview">${escapeHtml(p)}</span></span><span class="settings-arrow">›</span></button>`}).join("");renderFactionRelations();showScreen("factionDetail")}
function openFactionSection(k){currentFactionSection=k;const g=factionSectionGroups[k];factionSectionCards.innerHTML=g.fields.map(([l,x])=>`<article class="detail-card"><h3>${escapeHtml(l)}</h3><p>${escapeHtml(currentFaction[x]||"尚未設定")}</p></article>`).join("");showScreen("factionSection")}
function startNewFaction(){currentFaction=null;openFactionEditor("basic","factions")}
function editFactionFromDetail(){openFactionEditor("basic","factionDetail")}
function editCurrentFactionSection(){openFactionEditor(currentFactionSection,"factionSection")}
function openFactionEditor(section="basic",ret="factions"){currentFactionSection=section;factionEditorReturn=ret;factionId.value=currentFaction?.id||"";const groups=currentFaction?{[section]:factionSectionGroups[section]}:factionSectionGroups;factionEditorFields.innerHTML=Object.entries(groups).map(([k,g])=>`<section class="panel faction-editor-panel"><h3>${g.title}</h3>${g.fields.map(([label,key])=>{if(key==="type")return `<label>${label}</label><select id="f_${key}">${["皇室／朝廷","王府","商會","江湖門派","情報／殺手組織","家族／世家","軍隊","其他"].map(v=>`<option ${currentFaction?.[key]===v?"selected":""}>${v}</option>`).join("")}</select>`;const val=escapeHtml(currentFaction?.[key]||"");return ["name","leader","location","stance"].includes(key)?`<label>${label}</label><input id="f_${key}" value="${val}">`:`<label>${label}</label><textarea id="f_${key}">${val}</textarea>`}).join("")}</section>`).join("");showScreen("factionEditor")}
function cancelFactionEditor(){if(factionEditorReturn==="factionDetail"&&currentFaction)return openFactionDetail(currentFaction.id);if(factionEditorReturn==="factionSection"&&currentFaction)return openFactionSection(currentFactionSection);showScreen("factions")}
async function saveFactionEditor(){const btn=saveFactionBtn;const isEdit=!!factionId.value;const data=isEdit?{...currentFaction}:{};const groups=isEdit?{[currentFactionSection]:factionSectionGroups[currentFactionSection]}:factionSectionGroups;Object.values(groups).forEach(g=>g.fields.forEach(([,k])=>{const el=document.getElementById(`f_${k}`);if(el)data[k]=el.value.trim()}));if(!isEdit&&!data.name)return showToast("請先輸入勢力名稱");btn.disabled=true;btn.textContent="☁️ 儲存中……";try{let saved;if(isEdit){saved=await apiPost("saveFaction",{novelId:currentNovel["ID"],factionId:factionId.value,data});const i=factions.findIndex(f=>f.id===saved.id);if(i>=0)factions[i]=saved}else{saved=await apiPost("createFaction",{novelId:currentNovel["ID"],data});factions.push(saved)}currentFaction=saved;factionCount.textContent=`${factions.length} 個`;renderFactions();showToast("✅ 勢力已儲存");openFactionDetail(saved.id)}catch(e){console.error(e);showToast(e.message||"勢力儲存失敗") }finally{btn.disabled=false;btn.textContent="💾 儲存勢力"}}
async function deleteCurrentFaction(){if(!currentFaction||!confirm(`確定刪除「${currentFaction.name}」？`))return;const id=currentFaction.id;try{await apiPost("deleteFaction",{novelId:currentNovel["ID"],factionId:id});factions=factions.filter(f=>f.id!==id);currentFaction=null;factionCount.textContent=`${factions.length} 個`;renderFactions();showScreen("factions");showToast("✅ 勢力已刪除")}catch(e){showToast(e.message||"刪除失敗")}}
factionSearch.addEventListener("input",renderFactions);document.querySelectorAll("#factionFilters .filter-chip").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#factionFilters .filter-chip").forEach(x=>x.classList.remove("active"));b.classList.add("active");filteredFactionType=b.dataset.factionType||"";renderFactions()}));

document.getElementById("characterSearch").addEventListener("input", renderCharacters);
document.getElementById("roleFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-role]"); if (!button) return;
  filteredRole = button.dataset.role;
  document.querySelectorAll(".filter-chip").forEach(x => x.classList.remove("active"));
  button.classList.add("active"); renderCharacters();
});


/* =========================================================
 * v2.1 Chapter Tools
 * 刪除 / 複製 / 上下章 / 匯出
 * =======================================================*/
function sortedChapters(){
  return [...chapters].sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
}

function workspaceCurrentIndex(){
  if(!workspaceChapter) return -1;
  return sortedChapters().findIndex(ch=>ch.id===workspaceChapter.id);
}

async function workspacePreviousChapter(){
  if(workspaceDirty) await saveWorkspaceChapter(false);
  const list=sortedChapters();
  const i=workspaceCurrentIndex();
  if(i<=0) return showToast("已經是第一章");
  await selectWorkspaceChapter(list[i-1].id);
}

async function workspaceNextChapter(){
  if(workspaceDirty) await saveWorkspaceChapter(false);
  const list=sortedChapters();
  const i=workspaceCurrentIndex();
  if(i<0 || i>=list.length-1) return showToast("已經是最後一章");
  await selectWorkspaceChapter(list[i+1].id);
}

async function duplicateWorkspaceChapter(){
  if(!workspaceChapter) return showToast("請先選擇章節");
  if(workspaceDirty) await saveWorkspaceChapter(false);

  const list=sortedChapters();
  const maxNumber=list.length?Math.max(...list.map(ch=>Number(ch.number)||0)):0;
  const source=workspaceChapter;

  const data={
    number:maxNumber+1,
    title:`${source.title||"未命名章節"}（複製）`,
    status:"草稿",
    content:source.content||"",
    notes:source.notes||"",
    characterIds:[...(source.characterIds||[])],
    eventIds:[...(source.eventIds||[])]
  };

  try{
    const saved=await apiPost("saveChapter",{
      novelId:currentNovel["ID"],
      chapterId:"",
      data
    });
    chapters.push(saved);
    chapters.sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
    workspaceChapter={...saved};
    fillWorkspaceEditor(workspaceChapter);
    renderWorkspaceChapterList();
    showToast("✅ 已複製成新章節");
  }catch(e){
    console.error(e);
    showToast(e.message||"複製章節失敗");
  }
}

async function deleteWorkspaceChapter(){
  if(!workspaceChapter) return showToast("請先選擇章節");
  const title=workspaceChapter.title||`第 ${workspaceChapter.number||"?"} 章`;

  if(!confirm(`確定刪除「${title}」？\n\n這會從 Google Drive 的 chapters.json 中刪除，無法從網站復原。`)) return;

  try{
    await apiPost("deleteChapter",{
      novelId:currentNovel["ID"],
      chapterId:workspaceChapter.id
    });

    const deletedId=workspaceChapter.id;
    chapters=chapters.filter(ch=>ch.id!==deletedId);
    workspaceChapter=null;
    workspaceDirty=false;
    setWorkspaceEditorVisible(false);
    renderWorkspaceChapterList();
    showToast("✅ 章節已刪除");
  }catch(e){
    console.error(e);
    showToast(e.message||"刪除章節失敗");
  }
}

function downloadTextFile(filename,text){
  const blob=new Blob(["\ufeff"+text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function safeFilename(name){
  return String(name||"小說")
    .replace(/[\\/:*?"<>|]/g,"_")
    .replace(/\s+/g," ")
    .trim();
}

function exportCurrentChapterTxt(){
  if(!workspaceChapter) return showToast("請先選擇章節");

  const number=Number(document.getElementById("workspaceChapterNumber").value)||workspaceChapter.number||1;
  const title=document.getElementById("workspaceChapterTitle").value.trim()||workspaceChapter.title||`第 ${number} 章`;
  const content=document.getElementById("workspaceContent").value||"";
  const notes=document.getElementById("workspaceNotes").value.trim();

  const text=`第 ${number} 章 ${title}

${content}${notes?`

------------------------------
【章節備註】
${notes}`:""}
`;

  downloadTextFile(
    `${safeFilename(currentNovel?.["書名"]||"小說")}_第${number}章_${safeFilename(title)}.txt`,
    text
  );
  showToast("✅ 單章 TXT 已匯出");
}

function exportNovelTxt(){
  const list=sortedChapters();
  if(!list.length) return showToast("目前沒有章節可以匯出");

  const bookTitle=currentNovel?.["書名"]||"未命名小說";
  const body=list.map(ch=>`第 ${Number(ch.number)||"?"} 章 ${ch.title||""}

${ch.content||""}
`).join("\n\n========================================\n\n");

  const text=`${bookTitle}

========================================

${body}`;

  downloadTextFile(`${safeFilename(bookTitle)}_全文.txt`,text);
  showToast(`✅ 已匯出 ${list.length} 章`);
}

/* =========================================================
 * v2.0 Creative Workspace
 * 三欄整合：章節 / 正文 / 人物事件設定AI
 * =======================================================*/
async function openCreativeWorkspace(){
  showScreen("creativeWorkspace");
  workspaceChapter=null;
  setWorkspaceEditorVisible(false);
  try{
    const results=await Promise.allSettled([
      apiGet("getChapters",{novelId:currentNovel["ID"]}),
      loadTimelineFromCloud({allowMigration:false})
    ]);
    if(results[0].status==="fulfilled") chapters=results[0].value||[];
    chapters.sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
  }catch(e){ console.warn(e); }
  renderWorkspaceChapterList();
  renderWorkspaceReference();
  toggleWorkspaceMobilePanel("editor");
}

function renderWorkspaceChapterList(){
  const q=(document.getElementById("workspaceChapterSearch")?.value||"").trim().toLowerCase();
  const rows=chapters.filter(ch=>!q||[ch.title,ch.content,ch.status].join(" ").toLowerCase().includes(q));
  document.getElementById("workspaceChapterCount").textContent=`${chapters.length} 章`;
  const box=document.getElementById("workspaceChapterList");
  box.innerHTML=rows.length?rows.map(ch=>`
    <button type="button" class="workspace-chapter-item ${workspaceChapter?.id===ch.id?"active":""}" onclick="selectWorkspaceChapter('${safeAttr(ch.id)}')">
      <span>第 ${Number(ch.number)||"?"} 章</span>
      <b>${escapeHtml(ch.title||"未命名章節")}</b>
      <small>${escapeHtml(ch.status||"草稿")} · ${chapterCharCount(ch.content).toLocaleString()} 字</small>
    </button>`).join(""):'<div class="workspace-mini-empty">沒有章節</div>';
}

async function workspaceCreateChapter(){
  if(workspaceDirty) await saveWorkspaceChapter(false);
  const next=chapters.length?Math.max(...chapters.map(c=>Number(c.number)||0))+1:1;
  workspaceChapter={id:"",number:next,title:"",status:"草稿",content:"",notes:"",characterIds:[],eventIds:[]};
  fillWorkspaceEditor(workspaceChapter);
  setWorkspaceEditorVisible(true);
  toggleWorkspaceMobilePanel("editor");
}

async function selectWorkspaceChapter(id){
  if(workspaceDirty) await saveWorkspaceChapter(false);
  const ch=chapters.find(x=>x.id===id);
  if(!ch)return;
  workspaceChapter={...ch};
  fillWorkspaceEditor(workspaceChapter);
  setWorkspaceEditorVisible(true);
  renderWorkspaceChapterList();
  if(window.innerWidth<900) toggleWorkspaceMobilePanel("editor");
}

function setWorkspaceEditorVisible(show){
  document.getElementById("workspaceEmpty").classList.toggle("hidden",show);
  document.getElementById("workspaceEditorBody").classList.toggle("hidden",!show);
}

function fillWorkspaceEditor(ch){
  workspaceDirty=false;
  document.getElementById("workspaceChapterNumber").value=ch.number||1;
  document.getElementById("workspaceChapterTitle").value=ch.title||"";
  document.getElementById("workspaceChapterStatus").value=ch.status||"草稿";
  document.getElementById("workspaceContent").value=ch.content||"";
  document.getElementById("workspaceNotes").value=ch.notes||"";
  const cs=new Set(ch.characterIds||[]),es=new Set(ch.eventIds||[]);
  document.getElementById("workspaceCharacterChecks").innerHTML=characters.length?characters.map(c=>`
    <label class="workspace-check"><input type="checkbox" value="${safeAttr(c.id)}" ${cs.has(c.id)?"checked":""}>
    <span><b>${emojiForRole(c.role)} ${escapeHtml(c.name||"未命名")}</b><small>${escapeHtml(c.role||c.identity||"人物")}</small></span></label>`).join(""):'<div class="workspace-mini-empty">尚未建立人物</div>';
  document.getElementById("workspaceEventChecks").innerHTML=timelineEvents.length?timelineEvents.map(e=>`
    <label class="workspace-check"><input type="checkbox" value="${safeAttr(e.id)}" ${es.has(e.id)?"checked":""}>
    <span><b>${timelineTypeEmoji(e.type)} ${escapeHtml(e.title||"未命名事件")}</b><small>${escapeHtml(e.storyTime||e.status||"事件")}</small></span></label>`).join(""):'<div class="workspace-mini-empty">尚未建立事件</div>';
  updateWorkspaceStats();
  setWorkspaceSaveState("☁️ 已同步");
}

function updateWorkspaceStats(){
  const text=document.getElementById("workspaceContent").value;
  document.getElementById("workspaceCharCount").textContent=`${chapterCharCount(text).toLocaleString()} 字`;
  document.getElementById("workspaceParagraphCount").textContent=`${chapterParagraphCount(text)} 段`;
}
function setWorkspaceSaveState(text){ const el=document.getElementById("workspaceSaveState"); if(el)el.textContent=text; }
function markWorkspaceDirty(){
  if(!workspaceChapter)return;
  workspaceDirty=true;
  setWorkspaceSaveState("● 尚未儲存");
  clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer=setTimeout(()=>saveWorkspaceChapter(false),1200);
}
async function saveWorkspaceChapter(showMessage=false){
  if(!workspaceChapter)return;
  clearTimeout(workspaceSaveTimer);
  const number=Number(document.getElementById("workspaceChapterNumber").value)||1;
  const title=document.getElementById("workspaceChapterTitle").value.trim();
  const content=document.getElementById("workspaceContent").value;
  if(!title&&!content.trim())return;
  const data={
    number,title:title||`第 ${number} 章`,
    status:document.getElementById("workspaceChapterStatus").value,
    content,
    notes:document.getElementById("workspaceNotes").value.trim(),
    characterIds:[...document.querySelectorAll("#workspaceCharacterChecks input:checked")].map(x=>x.value),
    eventIds:[...document.querySelectorAll("#workspaceEventChecks input:checked")].map(x=>x.value)
  };
  setWorkspaceSaveState("☁️ 儲存中…");
  try{
    const saved=await apiPost("saveChapter",{novelId:currentNovel["ID"],chapterId:workspaceChapter.id||"",data});
    workspaceChapter={...saved};
    const i=chapters.findIndex(x=>x.id===saved.id);
    if(i>=0)chapters[i]=saved;else chapters.push(saved);
    chapters.sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
    workspaceDirty=false;
    setWorkspaceSaveState(`☁️ 已儲存 · ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`);
    renderWorkspaceChapterList();
    if(showMessage)showToast("✅ 章節已儲存");
  }catch(e){console.error(e);setWorkspaceSaveState("⚠️ 儲存失敗");showToast(e.message||"儲存失敗");}
}

function switchWorkspaceTab(tab){
  ["characters","events","reference","ai"].forEach(name=>{
    document.getElementById("workspaceTab"+name[0].toUpperCase()+name.slice(1)).classList.toggle("hidden",name!==tab);
  });
  document.querySelectorAll("[data-workspace-tab]").forEach(b=>b.classList.toggle("active",b.dataset.workspaceTab===tab));
}

function renderWorkspaceReference(){
  const q=(document.getElementById("workspaceReferenceSearch")?.value||"").trim().toLowerCase();
  const items=[];
  characters.forEach(c=>{
    const text=[c.name,c.role,c.identity,c.personality,c.abilities,c.secret].join(" ");
    if(!q||text.toLowerCase().includes(q))items.push(`<article class="workspace-ref-card"><b>${emojiForRole(c.role)} ${escapeHtml(c.name||"未命名人物")}</b><small>${escapeHtml(c.role||"")} · ${escapeHtml(c.identity||"")}</small><p>${escapeHtml(c.personality||c.appearance||"尚無摘要")}</p></article>`);
  });
  factions.forEach(f=>{
    const text=[f.name,f.type,f.leader,f.stance,f.goal,f.purpose].join(" ");
    if(!q||text.toLowerCase().includes(q))items.push(`<article class="workspace-ref-card"><b>${factionEmoji(f.type)} ${escapeHtml(f.name||"未命名勢力")}</b><small>${escapeHtml(f.type||"勢力")} · ${escapeHtml(f.leader||"")}</small><p>${escapeHtml(f.goal||f.purpose||f.stance||"尚無摘要")}</p></article>`);
  });
  document.getElementById("workspaceReferenceList").innerHTML=items.join("")||'<div class="workspace-mini-empty">找不到符合資料</div>';
}

function workspaceAI(task){
  workspaceAITask=task;
  switchWorkspaceTab("ai");
  generateWorkspaceAIPrompt();
}
function generateWorkspaceAIPrompt(){
  if(!workspaceChapter)return showToast("請先選擇章節");
  const task=AI_TASKS[workspaceAITask]||AI_TASKS.continue;
  const custom=document.getElementById("workspaceAIInstruction").value.trim();
  const content=document.getElementById("workspaceContent").value;
  const prompt=`你是一位專業的繁體中文小說創作助手。

【小說】${currentNovel?.["書名"]||"未命名"}

【人物設定】
${buildAICharacterContext()}

【人物與勢力關係】
${buildAIRelationContext()}

【世界觀】
${buildAIWorldContext()}

【勢力】
${buildAIFactionContext()}

【劇情時間線】
${buildAITimelineContext()}

【目前章節】
第 ${document.getElementById("workspaceChapterNumber").value} 章｜${document.getElementById("workspaceChapterTitle").value||"未命名"}
狀態：${document.getElementById("workspaceChapterStatus").value}

【正文】
${content||"尚無正文"}

【本次任務】
${task.title}
${task.instruction}
${custom?`\n額外要求：${custom}`:""}

規則：
1. 使用繁體中文。
2. 嚴格遵守既有人設、世界觀與人物關係。
3. 不讓人物知道尚未得知的秘密。
4. 不擅自新增衝突設定。
5. 續寫／潤飾／對話任務直接輸出可使用正文，不解釋思考過程。`;
  document.getElementById("workspaceAIPrompt").value=prompt;
  showToast("✨ AI 提示詞已產生");
}
async function copyWorkspaceAIPrompt(){
  const text=document.getElementById("workspaceAIPrompt").value;
  if(!text)return showToast("請先產生提示詞");
  try{await navigator.clipboard.writeText(text)}catch(e){const el=document.getElementById("workspaceAIPrompt");el.select();document.execCommand("copy")}
  showToast("✅ 已複製");
}
function openWorkspaceMetaAI(){
  if(!document.getElementById("workspaceAIPrompt").value)return showToast("請先產生提示詞");
  window.open("https://www.meta.ai/","_blank","noopener,noreferrer");
}

function toggleWorkspaceMobilePanel(panel){
  const shell=document.querySelector(".workspace-shell");
  if(!shell)return;
  shell.dataset.mobilePanel=panel;
  document.querySelectorAll(".workspace-mobile-nav button").forEach((b,i)=>{
    const names=["chapters","editor","inspector"];b.classList.toggle("active",names[i]===panel);
  });
}
document.getElementById("workspaceChapterSearch").addEventListener("input",renderWorkspaceChapterList);
document.getElementById("workspaceReferenceSearch").addEventListener("input",renderWorkspaceReference);
["workspaceChapterNumber","workspaceChapterTitle","workspaceChapterStatus","workspaceContent","workspaceNotes"].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener(id==="workspaceContent"?"input":"change",()=>{if(id==="workspaceContent")updateWorkspaceStats();markWorkspaceDirty()});
});
document.getElementById("workspaceCharacterChecks").addEventListener("change",markWorkspaceDirty);
document.getElementById("workspaceEventChecks").addEventListener("change",markWorkspaceDirty);

/* =========================================================
 * v1.9 AI Writing Assistant
 * 不呼叫 AI API，只建立高品質提示詞
 * =======================================================*/
const AI_TASKS = {
  continue:{
    title:"續寫目前章節",
    instruction:"延續目前章節往下寫。承接既有情緒、人物動機與劇情，不要突然跳時間或加入未設定的新核心人物。"
  },
  polish:{
    title:"潤飾目前正文",
    instruction:"潤飾目前章節，使文字更流暢、有畫面感與情緒層次，但不要改變既有劇情、人物行為與世界觀設定。"
  },
  rewrite:{
    title:"改寫目前章節",
    instruction:"在不改變劇情結果與人物設定的前提下，重新改寫目前內容，使節奏、描寫與對話更自然。"
  },
  plot:{
    title:"規劃後續劇情",
    instruction:"分析目前設定與已發生事件，提出 3 個合理的後續劇情方向。每個方向說明衝突、角色動機、可利用伏筆與可能後果。"
  },
  dialogue:{
    title:"設計角色對話",
    instruction:"依目前人物個性、身份、彼此關係與秘密，設計自然且有潛台詞的角色對話。避免角色說出他不應知道的資訊。"
  },
  foreshadow:{
    title:"伏筆與收束檢查",
    instruction:"檢查目前設定、時間線與章節，找出已埋但尚未收束的伏筆、適合新增的伏筆，以及可能遺忘的劇情線。"
  },
  logic:{
    title:"人物與劇情邏輯檢查",
    instruction:"檢查人物設定、勢力、關係、世界觀、時間線與正文是否互相矛盾。列出具體問題與修改建議，不要自行改掉原設定。"
  },
  custom:{
    title:"自訂 AI 任務",
    instruction:"依使用者的自訂要求完成任務。"
  }
};

async function openAIWriter(){
  showScreen("aiWriter");

  try{
    if(!chapters.length){
      chapters=await apiGet("getChapters",{novelId:currentNovel["ID"]})||[];
    }
  }catch(e){
    console.warn("AI 助手章節讀取失敗",e);
  }

  const select=document.getElementById("aiChapterSelect");
  select.innerHTML='<option value="">不指定章節</option>'+chapters
    .sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0))
    .map(ch=>`<option value="${safeAttr(ch.id)}">第 ${Number(ch.number)||"?"} 章｜${escapeHtml(ch.title||"未命名")}</option>`)
    .join("");

  if(currentChapter?.id) select.value=currentChapter.id;
  selectAITask(aiSelectedTask||"continue");
}

function selectAITask(task){
  aiSelectedTask=task;
  document.querySelectorAll(".ai-task-grid button").forEach(btn=>btn.classList.remove("active"));
  const buttons=[...document.querySelectorAll(".ai-task-grid button")];
  const idx=Object.keys(AI_TASKS).indexOf(task);
  if(buttons[idx])buttons[idx].classList.add("active");
}

function buildAIWorldContext(){
  const w=worldData||{};
  const lines=[
    w.worldName&&`世界／王朝：${w.worldName}`,
    w.era&&`年代：${w.era}`,
    w.summary&&`世界概要：${w.summary}`,
    w.nation&&`國家／朝代：${w.nation}`,
    w.politics&&`政治制度：${w.politics}`,
    w.culture&&`文化風俗：${w.culture}`,
    w.currency&&`貨幣：${w.currency}`,
    w.powerSystem&&`武學／能力體系：${w.powerSystem}`,
    w.medical&&`醫療：${w.medical}`,
    w.religion&&`宗教信仰：${w.religion}`
  ].filter(Boolean);
  return lines.length?lines.join("\n"):"尚未設定";
}

function buildAICharacterContext(){
  if(!characters.length)return "尚未建立人物";
  return characters.map(c=>`【${c.role||"角色"}：${c.name||"未命名"}】
身份：${c.identity||"未設定"}
外貌：${c.appearance||"未設定"}
個性：${c.personality||"未設定"}
喜歡：${c.likes||"未設定"}
討厭：${c.dislikes||"未設定"}
能力：${c.abilities||"未設定"}
弱點：${c.weakness||"未設定"}
過去：${c.past||"未設定"}
秘密：${c.secret||"未設定"}`).join("\n\n");
}

function buildAIRelationContext(){
  const lines=[];
  characterLinks.forEach(link=>{
    const a=characterById(link.sourceCharacterId),b=characterById(link.targetCharacterId);
    if(!a||!b)return;
    lines.push(`${a.name} ${link.direction==="oneway"?"→":"↔"} ${b.name}｜${link.sourceLabel||link.relationType||"關係"}${link.visibility==="秘密"?"｜秘密":""}｜親密 ${link.intimacy??50}｜信任 ${link.trust??50}`);
  });
  relations.forEach(r=>{
    const c=characterById(r.characterId),f=factionById(r.factionId);
    if(c&&f)lines.push(`${c.name} ↔ ${f.name}｜${r.role||"成員"}`);
  });
  return lines.length?lines.join("\n"):"尚未建立關聯";
}

function buildAIFactionContext(){
  if(!factions.length)return "尚未建立勢力";
  return factions.map(f=>`【${f.name||"未命名勢力"}】
類型：${f.type||"未設定"}
領袖：${f.leader||"未設定"}
立場：${f.stance||"未設定"}
目的：${f.goal||f.purpose||"未設定"}
秘密：${f.secret||"未設定"}`).join("\n\n");
}

function buildAITimelineContext(){
  if(!timelineEvents.length)return "尚未建立劇情事件";
  return timelineEvents.map(e=>`- ${e.storyTime||"時間未設定"}｜${e.title||"未命名"}｜${e.status||"規劃中"}
  ${e.summary||""}${e.impact?`\n  後續影響：${e.impact}`:""}`).join("\n");
}

function generateAIPrompt(){
  const task=AI_TASKS[aiSelectedTask]||AI_TASKS.continue;
  const chapterId=document.getElementById("aiChapterSelect").value;
  const ch=chapters.find(x=>x.id===chapterId);
  const custom=document.getElementById("aiCustomInstruction").value.trim();
  const style=document.getElementById("aiStyleSelect").value;

  const chapterText=ch?`第 ${ch.number||"?"} 章｜${ch.title||"未命名"}
狀態：${ch.status||"草稿"}

【目前正文】
${ch.content||"尚無正文"}

【章節備註】
${ch.notes||"無"}`:"未指定章節";

  const prompt=`你是一位專業的繁體中文小說創作助手。

請嚴格依照以下小說資料工作，不要擅自改變已建立的人物設定、世界觀、人物關係與已發生事件。

====================
【小說】
====================
書名：${currentNovel?.["書名"]||"未命名"}
類型：${currentNovel?.["類型"]||"未設定"}
狀態：${currentNovel?.["狀態"]||"未設定"}

====================
【世界觀】
====================
${buildAIWorldContext()}

====================
【人物設定】
====================
${buildAICharacterContext()}

====================
【人物與勢力關係】
====================
${buildAIRelationContext()}

====================
【勢力】
====================
${buildAIFactionContext()}

====================
【已建立劇情時間線】
====================
${buildAITimelineContext()}

====================
【目前章節】
====================
${chapterText}

====================
【本次任務】
====================
${task.title}

${task.instruction}

輸出風格：${style}
${custom?`額外要求：${custom}`:""}

【重要規則】
1. 使用繁體中文。
2. 不要讓人物知道他尚未得知的秘密。
3. 不要無故新增與既有設定衝突的身份、能力或世界規則。
4. 角色說話與行為必須符合既有人設。
5. 若資料不足，請提出合理選項，不要擅自把推測當成既定設定。
6. 若本次任務是續寫或改寫，直接輸出可使用的小說正文，不需要解釋思考過程。`;

  document.getElementById("aiPromptOutput").value=prompt;
  document.getElementById("aiPromptStats").textContent=`${prompt.length.toLocaleString()} 字元 · ${task.title}`;
  showToast("✨ 提示詞已產生");
}

async function copyAIPrompt(){
  const text=document.getElementById("aiPromptOutput").value;
  if(!text)return showToast("請先產生提示詞");
  try{
    await navigator.clipboard.writeText(text);
    showToast("✅ 提示詞已複製");
  }catch(e){
    const el=document.getElementById("aiPromptOutput");
    el.select(); document.execCommand("copy");
    showToast("✅ 提示詞已複製");
  }
}

function openMetaAI(){
  const text=document.getElementById("aiPromptOutput").value;
  if(!text){
    showToast("請先產生提示詞");
    return;
  }
  window.open("https://www.meta.ai/","_blank","noopener,noreferrer");
}

/* =========================================================
 * v1.8 Chapter Manager
 * Google Drive chapters.json + 自動儲存正文
 * =======================================================*/
function setChapterCloudStatus(text,state=""){
  const el=document.getElementById("chapterCloudStatus");
  if(!el)return;
  el.textContent=text; el.dataset.state=state;
}
function chapterCharCount(text){ return String(text||"").replace(/\s/g,"").length; }
function chapterParagraphCount(text){ return String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).length; }

async function openChapters(){
  showScreen("chapters");
  try{ await loadTimelineFromCloud({allowMigration:false}); }catch(e){ console.warn("章節關聯事件讀取失敗",e); }
  renderChapters();
  await refreshChaptersFromCloud(false);
}
async function refreshChaptersFromCloud(showMessage=true){
  try{
    setChapterCloudStatus("☁️ 正在同步 Google Drive…","syncing");
    chapters=await apiGet("getChapters",{novelId:currentNovel["ID"]})||[];
    chapters.sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
    setChapterCloudStatus(`☁️ Google Drive 已同步 · ${chapters.length} 章`,"ok");
    renderChapters();
    if(showMessage)showToast("✅ 章節已同步");
  }catch(e){
    console.error(e);
    setChapterCloudStatus("⚠️ 雲端同步失敗","error");
    showToast(e.message||"章節同步失敗");
  }
}
function renderChapters(){
  const q=(document.getElementById("chapterSearch")?.value||"").trim().toLowerCase();
  const status=document.getElementById("chapterStatusFilter")?.value||"";
  const rows=chapters.filter(ch=>{
    if(status&&ch.status!==status)return false;
    if(!q)return true;
    return [ch.title,ch.content,ch.notes,ch.status].join(" ").toLowerCase().includes(q);
  });
  const totalChars=chapters.reduce((n,ch)=>n+chapterCharCount(ch.content),0);
  const completed=chapters.filter(ch=>ch.status==="完成").length;
  document.getElementById("chapterStats").innerHTML=`
    <div><b>${chapters.length}</b><small>總章數</small></div>
    <div><b>${totalChars.toLocaleString()}</b><small>正文總字數</small></div>
    <div><b>${completed}</b><small>已完成</small></div>`;
  const box=document.getElementById("chapterList"),empty=document.getElementById("chapterEmpty");
  if(!rows.length){
    box.innerHTML=""; empty.classList.remove("hidden");
    empty.textContent=chapters.length?"沒有符合篩選條件的章節。":"目前還沒有章節，建立第一章吧。"; return;
  }
  empty.classList.add("hidden");
  box.innerHTML=rows.map(ch=>{
    const chars=(ch.characterIds||[]).map(id=>characterById(id)).filter(Boolean);
    const events=(ch.eventIds||[]).map(id=>timelineEvents.find(e=>e.id===id)).filter(Boolean);
    return `<button class="chapter-card" type="button" onclick="openChapterEditor('${safeAttr(ch.id)}')">
      <span class="chapter-no">第 ${Number(ch.number)||"?"} 章</span>
      <span class="chapter-card-copy"><b>${escapeHtml(ch.title||"未命名章節")}</b>
      <small>${escapeHtml(ch.status||"草稿")} · ${chapterCharCount(ch.content).toLocaleString()} 字${chars.length?` · 👤 ${chars.map(c=>escapeHtml(c.name)).join("、")}`:""}${events.length?` · 📜 ${events.length} 事件`:""}</small></span>
      <span class="chapter-arrow">›</span>
    </button>`;
  }).join("");
}
async function createChapter(){
  const next=chapters.length?Math.max(...chapters.map(c=>Number(c.number)||0))+1:1;
  currentChapter={id:"",number:next,title:"",status:"草稿",content:"",notes:"",characterIds:[],eventIds:[]};
  fillChapterEditor(currentChapter); showScreen("chapterEditor");
}
function openChapterEditor(id){
  const ch=chapters.find(x=>x.id===id); if(!ch)return showToast("找不到章節");
  currentChapter={...ch}; fillChapterEditor(currentChapter); showScreen("chapterEditor");
}
function fillChapterEditor(ch){
  chapterDirty=false;
  document.getElementById("chapterNumber").value=ch.number||1;
  document.getElementById("chapterTitle").value=ch.title||"";
  document.getElementById("chapterStatus").value=ch.status||"草稿";
  document.getElementById("chapterContent").value=ch.content||"";
  document.getElementById("chapterNotes").value=ch.notes||"";
  const cs=new Set(ch.characterIds||[]), es=new Set(ch.eventIds||[]);
  document.getElementById("chapterCharacterChecks").innerHTML=characters.length?characters.map(c=>`<label class="timeline-check"><input type="checkbox" value="${safeAttr(c.id)}" ${cs.has(c.id)?"checked":""}><span>${emojiForRole(c.role)} ${escapeHtml(c.name||"未命名人物")}</span></label>`).join(""):'<div class="muted">尚未建立人物</div>';
  document.getElementById("chapterEventChecks").innerHTML=timelineEvents.length?timelineEvents.map(e=>`<label class="timeline-check"><input type="checkbox" value="${safeAttr(e.id)}" ${es.has(e.id)?"checked":""}><span>${timelineTypeEmoji(e.type)} ${escapeHtml(e.title||"未命名事件")}</span></label>`).join(""):'<div class="muted">尚未建立事件</div>';
  updateChapterWritingStats(); setChapterSaveState("☁️ 已載入");
}
function updateChapterWritingStats(){
  const text=document.getElementById("chapterContent").value;
  document.getElementById("chapterCharCount").textContent=`${chapterCharCount(text).toLocaleString()} 字`;
  document.getElementById("chapterWordCount").textContent=`${chapterParagraphCount(text)} 段`;
}
function setChapterSaveState(text){ const el=document.getElementById("chapterSaveState"); if(el)el.textContent=text; }
function markChapterDirty(){
  chapterDirty=true; setChapterSaveState("● 尚未儲存");
  clearTimeout(chapterSaveTimer);
  chapterSaveTimer=setTimeout(()=>saveChapterNow(false),1200);
}
async function saveChapterNow(showMessage=false){
  if(!currentChapter)return;
  clearTimeout(chapterSaveTimer);
  const title=document.getElementById("chapterTitle").value.trim();
  const content=document.getElementById("chapterContent").value;
  if(!title && !content.trim()){
    if(showMessage)showToast("章名或正文至少要有一項內容");
    return;
  }
  const data={
    number:Number(document.getElementById("chapterNumber").value)||1,
    title:title||`第 ${Number(document.getElementById("chapterNumber").value)||1} 章`,
    status:document.getElementById("chapterStatus").value,
    content,
    notes:document.getElementById("chapterNotes").value.trim(),
    characterIds:[...document.querySelectorAll("#chapterCharacterChecks input:checked")].map(x=>x.value),
    eventIds:[...document.querySelectorAll("#chapterEventChecks input:checked")].map(x=>x.value)
  };
  setChapterSaveState("☁️ 儲存中…");
  try{
    const saved=await apiPost("saveChapter",{novelId:currentNovel["ID"],chapterId:currentChapter.id||"",data});
    currentChapter={...saved};
    const i=chapters.findIndex(x=>x.id===saved.id);
    if(i>=0)chapters[i]=saved; else chapters.push(saved);
    chapters.sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
    chapterDirty=false;
    setChapterSaveState(`☁️ 已儲存 · ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`);
    if(showMessage)showToast("✅ 章節已儲存到 Google Drive");
  }catch(e){ console.error(e); setChapterSaveState("⚠️ 儲存失敗"); showToast(e.message||"章節儲存失敗"); }
}
async function closeChapterEditor(){
  if(chapterDirty) await saveChapterNow(false);
  currentChapter=null; showScreen("chapters"); renderChapters();
}
document.getElementById("chapterSearch").addEventListener("input",renderChapters);
document.getElementById("chapterStatusFilter").addEventListener("change",renderChapters);
["chapterNumber","chapterTitle","chapterStatus","chapterContent","chapterNotes"].forEach(id=>{
  const el=document.getElementById(id);
  el.addEventListener(id==="chapterContent"?"input":"change",()=>{ if(id==="chapterContent")updateChapterWritingStats(); markChapterDirty(); });
});
document.getElementById("chapterCharacterChecks").addEventListener("change",markChapterDirty);
document.getElementById("chapterEventChecks").addEventListener("change",markChapterDirty);

/* =========================================================
 * v1.7 Story Timeline
 * 第一階段使用 localStorage，零後端修改即可驗證 UX
 * key 依 novelId 分開，避免小說互相污染
 * =======================================================*/
function timelineStorageKey(){
  return `novel-ai-studio:timeline:${currentNovel?.["ID"] || "unknown"}`;
}

function loadLocalTimelineBackup(){
  try{
    const raw = localStorage.getItem(timelineStorageKey());
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  }catch(err){
    console.warn("timeline local backup load failed",err);
    return [];
  }
}

function persistTimelineBackup(){
  try{
    localStorage.setItem(
      timelineStorageKey(),
      JSON.stringify(timelineEvents)
    );
  }catch(err){
    console.warn("timeline local backup save failed",err);
  }
}

function setTimelineCloudStatus(text,state=""){
  const el = document.getElementById("timelineCloudStatus");
  if(!el) return;

  el.textContent = text;
  el.dataset.state = state;
}

async function loadTimelineFromCloud({allowMigration=true} = {}){
  const novelId = currentNovel?.["ID"];
  if(!novelId){
    throw new Error("找不到小說 ID。");
  }

  setTimelineCloudStatus(
    "☁️ 正在同步 Google Drive…",
    "syncing"
  );

  let cloud = await apiGet(
    "getTimelineEvents",
    {novelId}
  );

  cloud = Array.isArray(cloud)
    ? cloud
    : [];

  /*
   * v1.7 → v1.7.1 自動搬移：
   * 雲端為空、本機有事件時，只搬一次。
   */
  if(allowMigration && cloud.length === 0){
    const local = loadLocalTimelineBackup();

    if(local.length){
      setTimelineCloudStatus(
        "☁️ 正在搬移舊版時間線…",
        "syncing"
      );

      const migration = await apiPost(
        "importTimelineEvents",
        {
          novelId,
          events:local
        }
      );

      if(migration?.events){
        cloud = migration.events;
      }else{
        cloud = await apiGet(
          "getTimelineEvents",
          {novelId}
        ) || [];
      }

      if(migration?.imported){
        showToast(
          `✅ 已將 ${migration.count || local.length} 筆本機事件搬到 Google Drive`
        );
      }
    }
  }

  timelineEvents = cloud;
  persistTimelineBackup();

  setTimelineCloudStatus(
    `☁️ Google Drive 已同步 · ${timelineEvents.length} 筆`,
    "ok"
  );

  return timelineEvents;
}

async function refreshTimelineFromCloud(){
  try{
    await loadTimelineFromCloud({
      allowMigration:false
    });
    renderTimeline();
    showToast("✅ 時間線已同步");
  }catch(error){
    console.error(error);

    setTimelineCloudStatus(
      "⚠️ 雲端同步失敗",
      "error"
    );

    showToast(
      error.message ||
      "雲端同步失敗"
    );
  }
}

function timelineTypeEmoji(type){
  return {
    "主線":"🎯","支線":"🧩","感情":"❤️","戰鬥":"⚔️","政治":"⚖️",
    "秘密":"🔒","伏筆":"🪡","轉折":"⚡","其他":"📌"
  }[type] || "📌";
}

async function openTimeline(){
  showScreen("timeline");

  timelineEvents = loadLocalTimelineBackup();
  renderTimeline();

  try{
    await loadTimelineFromCloud();
    renderTimeline();
  }catch(error){
    console.error(error);

    setTimelineCloudStatus(
      "⚠️ 雲端同步失敗 · 顯示本機備份",
      "error"
    );

    if(!timelineEvents.length){
      showToast(
        error.message ||
        "時間線讀取失敗"
      );
    }
  }
}

function renderTimeline(){
  const q = (document.getElementById("timelineSearch")?.value || "").trim().toLowerCase();
  const type = document.getElementById("timelineTypeFilter")?.value || "";
  const status = document.getElementById("timelineStatusFilter")?.value || "";

  const filtered = timelineEvents.filter(ev => {
    if(type && ev.type !== type) return false;
    if(status && ev.status !== status) return false;
    if(!q) return true;

    const charNames = (ev.characterIds || []).map(id => characterById(id)?.name || "").join(" ");
    const factionNames = (ev.factionIds || []).map(id => factionById(id)?.name || "").join(" ");
    return [
      ev.title,ev.type,ev.storyTime,ev.location,ev.summary,ev.impact,ev.notes,
      charNames,factionNames
    ].join(" ").toLowerCase().includes(q);
  });

  const stats = document.getElementById("timelineStats");
  const completed = timelineEvents.filter(e => e.status === "已完成" || e.status === "已發生").length;
  const unresolved = timelineEvents.filter(e => e.status === "伏筆未收").length;
  stats.innerHTML = `
    <div><b>${timelineEvents.length}</b><small>全部事件</small></div>
    <div><b>${completed}</b><small>已發生 / 完成</small></div>
    <div><b>${unresolved}</b><small>伏筆未收</small></div>
  `;

  const list = document.getElementById("timelineList");
  const empty = document.getElementById("timelineEmpty");

  if(!filtered.length){
    list.innerHTML = "";
    empty.classList.remove("hidden");
    empty.textContent = timelineEvents.length ? "沒有符合目前篩選條件的事件。" : "目前還沒有劇情事件，新增第一件吧。";
    return;
  }

  empty.classList.add("hidden");

  list.innerHTML = filtered.map((ev,index) => {
    const chars = (ev.characterIds || []).map(id => characterById(id)).filter(Boolean);
    const facs = (ev.factionIds || []).map(id => factionById(id)).filter(Boolean);

    return `<article class="timeline-item">
      <div class="timeline-rail">
        <span class="timeline-dot">${timelineTypeEmoji(ev.type)}</span>
        ${index < filtered.length - 1 ? '<span class="timeline-line"></span>' : ''}
      </div>

      <div class="timeline-card">
        <div class="timeline-card-head">
          <div>
            <div class="timeline-kicker">${escapeHtml(ev.storyTime || "時間未設定")} · ${escapeHtml(ev.type || "其他")}</div>
            <h3>${escapeHtml(ev.title || "未命名事件")}</h3>
          </div>
          <span class="timeline-status">${escapeHtml(ev.status || "規劃中")}</span>
        </div>

        ${ev.location ? `<div class="timeline-location">📍 ${escapeHtml(ev.location)}</div>` : ""}
        <p>${escapeHtml(ev.summary || "")}</p>

        ${chars.length ? `<div class="timeline-tags">${chars.map(c =>
          `<button type="button" onclick="jumpToCharacter('${safeAttr(c.id)}')">👤 ${escapeHtml(c.name)}</button>`
        ).join("")}</div>` : ""}

        ${facs.length ? `<div class="timeline-tags">${facs.map(f =>
          `<button type="button" onclick="jumpToFaction('${safeAttr(f.id)}')">🏯 ${escapeHtml(f.name)}</button>`
        ).join("")}</div>` : ""}

        ${ev.impact ? `<div class="timeline-impact"><b>🪡 後續影響</b><span>${escapeHtml(ev.impact)}</span></div>` : ""}

        <div class="timeline-card-actions">
          <button type="button" onclick="openTimelineEditor('${safeAttr(ev.id)}')">✏️ 編輯</button>
          <button class="danger-text" type="button" onclick="deleteTimelineEvent('${safeAttr(ev.id)}')">刪除</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function openTimelineEditor(eventId=""){
  editingTimelineEventId = eventId;
  const ev = eventId ? timelineEvents.find(x => x.id === eventId) : null;

  document.getElementById("timelineEditorTitle").textContent = ev ? "編輯劇情事件" : "新增劇情事件";
  document.getElementById("timelineEventTitle").value = ev?.title || "";
  document.getElementById("timelineEventType").value = ev?.type || "主線";
  document.getElementById("timelineStoryTime").value = ev?.storyTime || "";
  document.getElementById("timelineEventStatus").value = ev?.status || "規劃中";
  document.getElementById("timelineLocation").value = ev?.location || "";
  document.getElementById("timelineSummary").value = ev?.summary || "";
  document.getElementById("timelineImpact").value = ev?.impact || "";
  document.getElementById("timelineNotes").value = ev?.notes || "";

  const selectedChars = new Set(ev?.characterIds || []);
  const selectedFacs = new Set(ev?.factionIds || []);

  document.getElementById("timelineCharacterChecks").innerHTML = characters.length
    ? characters.map(c => `<label class="timeline-check">
        <input type="checkbox" value="${safeAttr(c.id)}" ${selectedChars.has(c.id) ? "checked" : ""}>
        <span>${emojiForRole(c.role)} ${escapeHtml(c.name || "未命名人物")}</span>
      </label>`).join("")
    : '<div class="muted">尚未建立人物</div>';

  document.getElementById("timelineFactionChecks").innerHTML = factions.length
    ? factions.map(f => `<label class="timeline-check">
        <input type="checkbox" value="${safeAttr(f.id)}" ${selectedFacs.has(f.id) ? "checked" : ""}>
        <span>${factionEmoji(f.type)} ${escapeHtml(f.name || "未命名勢力")}</span>
      </label>`).join("")
    : '<div class="muted">尚未建立勢力</div>';

  timelineReturn = "timeline";
  showScreen("timelineEditor");
}

function cancelTimelineEditor(){
  editingTimelineEventId = "";
  showScreen("timeline");
  renderTimeline();
}

async function saveTimelineEvent(){
  const title = document
    .getElementById("timelineEventTitle")
    .value
    .trim();

  const summary = document
    .getElementById("timelineSummary")
    .value
    .trim();

  if(!title){
    showToast("請先輸入事件名稱");
    return;
  }

  if(!summary){
    showToast("請先輸入事件摘要");
    return;
  }

  const characterIds = [
    ...document.querySelectorAll(
      "#timelineCharacterChecks input:checked"
    )
  ].map(x => x.value);

  const factionIds = [
    ...document.querySelectorAll(
      "#timelineFactionChecks input:checked"
    )
  ].map(x => x.value);

  const existing = editingTimelineEventId
    ? timelineEvents.find(
        x => x.id === editingTimelineEventId
      )
    : null;

  const data = {
    title,
    type:document
      .getElementById("timelineEventType")
      .value,

    storyTime:document
      .getElementById("timelineStoryTime")
      .value
      .trim(),

    status:document
      .getElementById("timelineEventStatus")
      .value,

    location:document
      .getElementById("timelineLocation")
      .value
      .trim(),

    summary,
    characterIds,
    factionIds,

    impact:document
      .getElementById("timelineImpact")
      .value
      .trim(),

    notes:document
      .getElementById("timelineNotes")
      .value
      .trim(),

    createdAt:existing?.createdAt || ""
  };

  setTimelineCloudStatus(
    "☁️ 正在儲存…",
    "syncing"
  );

  try{
    const saved = await apiPost(
      "saveTimelineEvent",
      {
        novelId:currentNovel["ID"],
        eventId:editingTimelineEventId || "",
        data
      }
    );

    const idx = timelineEvents.findIndex(
      x => x.id === saved.id
    );

    if(idx >= 0){
      timelineEvents[idx] = saved;
    }else{
      timelineEvents.push(saved);
    }

    persistTimelineBackup();

    editingTimelineEventId = "";

    setTimelineCloudStatus(
      `☁️ Google Drive 已同步 · ${timelineEvents.length} 筆`,
      "ok"
    );

    showToast(
      "✅ 劇情事件已儲存到 Google Drive"
    );

    showScreen("timeline");
    renderTimeline();

  }catch(error){
    console.error(error);

    setTimelineCloudStatus(
      "⚠️ 儲存失敗",
      "error"
    );

    showToast(
      error.message ||
      "劇情事件儲存失敗"
    );
  }
}

async function deleteTimelineEvent(id){
  const ev = timelineEvents.find(
    x => x.id === id
  );

  if(!ev) return;

  if(!confirm(
    `確定刪除「${ev.title}」？`
  )){
    return;
  }

  setTimelineCloudStatus(
    "☁️ 正在刪除…",
    "syncing"
  );

  try{
    await apiPost(
      "deleteTimelineEvent",
      {
        novelId:currentNovel["ID"],
        eventId:id
      }
    );

    timelineEvents = timelineEvents.filter(
      x => x.id !== id
    );

    persistTimelineBackup();
    renderTimeline();

    setTimelineCloudStatus(
      `☁️ Google Drive 已同步 · ${timelineEvents.length} 筆`,
      "ok"
    );

    showToast(
      "✅ 事件已從 Google Drive 刪除"
    );

  }catch(error){
    console.error(error);

    setTimelineCloudStatus(
      "⚠️ 刪除失敗",
      "error"
    );

    showToast(
      error.message ||
      "事件刪除失敗"
    );
  }
}

document.getElementById("timelineSearch")
  .addEventListener("input",renderTimeline);
document.getElementById("timelineTypeFilter")
  .addEventListener("change",renderTimeline);
document.getElementById("timelineStatusFilter")
  .addEventListener("change",renderTimeline);

/* =========================================================
 * v1.6 Relationship Graph
 * 使用既有 relations + characterLinks，不新增後端資料
 * =======================================================*/
function graphRelationView(link, centerId){
  if(link.sourceCharacterId === centerId){
    return {
      otherId:link.targetCharacterId,
      label:link.sourceLabel || link.relationType || "關係",
      arrow:link.direction === "oneway" ? "→" : "↔"
    };
  }

  if(link.direction !== "oneway" && link.targetCharacterId === centerId){
    return {
      otherId:link.sourceCharacterId,
      label:link.targetLabel || link.sourceLabel || link.relationType || "關係",
      arrow:"↔"
    };
  }

  return null;
}

function openRelationshipGraph(centerId=""){
  if(!characters.length){
    showToast("正在讀取人物資料……");
  }

  const select = document.getElementById("graphCenterCharacter");
  select.innerHTML = characters.map(c =>
    `<option value="${safeAttr(c.id)}">${escapeHtml(c.name || "未命名人物")}｜${escapeHtml(c.role || "未設定")}</option>`
  ).join("");

  const preferred =
    centerId ||
    currentCharacter?.id ||
    characters[0]?.id ||
    "";

  if(preferred) select.value = preferred;

  showScreen("relationshipGraph");
  renderRelationshipGraph();
}

function renderRelationshipGraph(){
  const select = document.getElementById("graphCenterCharacter");
  const centerId = select.value;
  const center = characterById(centerId);

  const canvas = document.getElementById("relationshipGraphCanvas");
  const empty = document.getElementById("graphEmptyState");
  const peopleBox = document.getElementById("graphPeopleNodes");
  const factionBox = document.getElementById("graphFactionNodes");
  const centerNode = document.getElementById("graphCenterNode");
  const stats = document.getElementById("graphCenterStats");

  if(!center){
    canvas.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "目前沒有可顯示的人物。";
    return;
  }

  canvas.classList.remove("hidden");

  const peopleLinks = characterLinks
    .map(link => ({link,view:graphRelationView(link,centerId)}))
    .filter(x => x.view);

  const factionLinks = relations
    .filter(r => r.characterId === centerId);

  centerNode.innerHTML = `
    <span class="graph-avatar">${emojiForRole(center.role)}</span>
    <span class="graph-node-copy">
      <b>${escapeHtml(center.name || "未命名人物")}</b>
      <small>${escapeHtml(center.role || "未設定")} · ${escapeHtml(center.identity || "")}</small>
    </span>
  `;
  centerNode.onclick = () => jumpToCharacter(centerId);

  stats.innerHTML = `
    <span>👥 ${peopleLinks.length} 個人物關係</span>
    <span>🏯 ${factionLinks.length} 個勢力關係</span>
  `;

  peopleBox.innerHTML = peopleLinks.length
    ? peopleLinks.map(({link,view}) => {
        const other = characterById(view.otherId);
        const secret = link.visibility === "秘密" ? " · 🔒" : "";
        return `<button class="graph-node graph-person-node" data-graph-node="people" type="button" onclick="jumpToCharacter('${safeAttr(view.otherId)}')">
          <span class="graph-avatar">${other ? emojiForRole(other.role) : "👤"}</span>
          <span class="graph-node-copy">
            <b>${escapeHtml(other?.name || "已刪除的人物")}</b>
            <small>${escapeHtml(view.arrow + " " + view.label + secret)}</small>
            <small>親密 ${clampRelationScore(link.intimacy)} · 信任 ${clampRelationScore(link.trust)}</small>
          </span>
        </button>`;
      }).join("")
    : '<div class="graph-side-empty">尚無人物關係</div>';

  factionBox.innerHTML = factionLinks.length
    ? factionLinks.map(link => {
        const faction = factionById(link.factionId);
        return `<button class="graph-node graph-faction-node" data-graph-node="factions" type="button" onclick="jumpToFaction('${safeAttr(link.factionId)}')">
          <span class="graph-avatar">${faction ? factionEmoji(faction.type) : "🏯"}</span>
          <span class="graph-node-copy">
            <b>${escapeHtml(faction?.name || "已刪除的勢力")}</b>
            <small>${escapeHtml(link.role || faction?.type || "關聯勢力")}</small>
          </span>
        </button>`;
      }).join("")
    : '<div class="graph-side-empty">尚無勢力關係</div>';

  const hasAny = peopleLinks.length || factionLinks.length;
  empty.classList.toggle("hidden", !!hasAny);
  if(!hasAny){
    empty.textContent = "這個人物目前還沒有任何人物或勢力關聯。";
  }

  requestAnimationFrame(drawRelationshipGraphLines);
}

function drawRelationshipGraphLines(){
  const canvas = document.getElementById("relationshipGraphCanvas");
  const svg = document.getElementById("relationshipGraphLines");
  const center = document.getElementById("graphCenterNode");

  if(!canvas || !svg || !center || canvas.classList.contains("hidden")) return;

  const box = canvas.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  svg.setAttribute("width", box.width);
  svg.setAttribute("height", box.height);

  const centerRect = center.getBoundingClientRect();
  const cx = centerRect.left - box.left + centerRect.width / 2;
  const cy = centerRect.top - box.top + centerRect.height / 2;

  const nodes = [
    ...canvas.querySelectorAll(".graph-person-node"),
    ...canvas.querySelectorAll(".graph-faction-node")
  ];

  const mobile = window.innerWidth < 900;

  svg.innerHTML = nodes.map(node => {
    const r = node.getBoundingClientRect();
    const nx = r.left - box.left + r.width / 2;
    const ny = r.top - box.top + r.height / 2;

    if(mobile){
      const midY = (cy + ny) / 2;
      return `<path d="M ${cx} ${cy} C ${cx} ${midY}, ${nx} ${midY}, ${nx} ${ny}" />`;
    }

    const midX = (cx + nx) / 2;
    return `<path d="M ${cx} ${cy} C ${midX} ${cy}, ${midX} ${ny}, ${nx} ${ny}" />`;
  }).join("");
}

document.getElementById("graphCenterCharacter")
  .addEventListener("change", renderRelationshipGraph);

window.addEventListener("resize", () => {
  if(!screens.relationshipGraph.classList.contains("hidden")){
    requestAnimationFrame(drawRelationshipGraphLines);
  }
});

/* =========================================================
 * v1.5 Character Relations — 人物 × 人物關係網
 * 單一來源：character-relations.json
 * =======================================================*/
function characterLinkTypeEmoji(type){
  return ({愛情:"❤️",親屬:"🩸",朋友:"🤝",主從:"👑",師徒:"📚",盟友:"🛡️",敵對:"⚔️",競爭:"🔥",利用:"🎭",其他:"🔗"})[type] || "🔗";
}

function clampRelationScore(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getCharacterLinkView(link, characterId){
  if(link.sourceCharacterId === characterId){
    return {
      otherId: link.targetCharacterId,
      label: link.sourceLabel || link.relationType || "關係",
      direction: link.direction === "oneway" ? "→" : "↔"
    };
  }
  if(link.direction !== "oneway" && link.targetCharacterId === characterId){
    return {
      otherId: link.sourceCharacterId,
      label: link.targetLabel || link.sourceLabel || link.relationType || "關係",
      direction: "↔"
    };
  }
  return null;
}

function renderCharacterLinks(){
  const box = document.getElementById("characterLinkList");
  if(!box || !currentCharacter) return;

  const rows = characterLinks
    .map(link => ({link, view:getCharacterLinkView(link, currentCharacter.id)}))
    .filter(x => x.view);

  box.innerHTML = rows.length ? rows.map(({link,view}) => {
    const other = characterById(view.otherId);
    const secret = link.visibility === "秘密" ? " · 🔒 秘密" : (link.visibility ? ` · ${link.visibility}` : "");
    const scores = `親密 ${clampRelationScore(link.intimacy)} · 信任 ${clampRelationScore(link.trust)}`;
    return `<article class="relation-card character-link-card">
      <button class="relation-main" type="button" onclick="jumpToCharacter('${safeAttr(view.otherId)}')">
        <span class="relation-emoji">${characterLinkTypeEmoji(link.relationType)}</span>
        <span class="relation-copy">
          <b>${escapeHtml(other?.name || "已刪除的人物")} <span class="link-direction">${view.direction}</span></b>
          <small>${escapeHtml(view.label)}${escapeHtml(secret)}</small>
          <small>${escapeHtml(scores)}</small>
        </span>
        <span class="character-arrow">›</span>
      </button>
      <div class="relation-card-actions">
        <button class="relation-edit" type="button" onclick="event.stopPropagation();editCharacterLink('${safeAttr(link.id)}')">編輯</button>
        <button class="relation-delete" type="button" onclick="event.stopPropagation();deleteCharacterLink('${safeAttr(link.id)}')">移除</button>
      </div>
    </article>`;
  }).join("") : '<div class="relation-empty">尚未建立人物關係。</div>';
}

async function ensureCharacterLinkSources(){
  if(!characters.length){
    characters = await apiGet("getCharacters",{novelId:currentNovel["ID"]}) || [];
  }
}

async function openCharacterLinkEditor(){
  if(!currentCharacter) return showToast("請先選擇人物");
  try{
    await ensureCharacterLinkSources();
    editingCharacterLinkId = "";
    fillCharacterLinkEditor({});
    showScreen("characterLinkEditor");
  }catch(e){ showToast(e.message || "讀取人物資料失敗"); }
}

function fillCharacterLinkEditor(link){
  const sourceId = link.sourceCharacterId || currentCharacter?.id || "";
  const source = characterById(sourceId);
  characterLinkSourceId.innerHTML = source
    ? `<option value="${safeAttr(source.id)}">${escapeHtml(source.name || "未命名人物")}</option>`
    : "";

  const candidates = characters.filter(c => c.id !== sourceId);
  characterLinkTargetId.innerHTML = candidates.length
    ? candidates.map(c => `<option value="${safeAttr(c.id)}" ${c.id===link.targetCharacterId?"selected":""}>${escapeHtml(c.name || "未命名人物")}｜${escapeHtml(c.role || "未設定")}</option>`).join("")
    : '<option value="">尚無其他人物</option>';

  characterLinkType.value = link.relationType || "愛情";
  characterLinkSourceLabel.value = link.sourceLabel || "";
  characterLinkTargetLabel.value = link.targetLabel || "";
  characterLinkDirection.value = link.direction || "bidirectional";
  characterLinkVisibility.value = link.visibility || "公開";
  characterLinkIntimacy.value = clampRelationScore(link.intimacy ?? 50);
  characterLinkTrust.value = clampRelationScore(link.trust ?? 50);
  characterLinkNotes.value = link.notes || "";
}

function cancelCharacterLinkEditor(){
  editingCharacterLinkId = "";
  if(currentCharacter) return openCharacterDetail(currentCharacter.id);
  showScreen("characters");
}

function editCharacterLink(id){
  const link = characterLinks.find(x => x.id === id);
  if(!link) return showToast("找不到這筆人物關係");

  // 若從目標人物進入，轉成目前人物視角編輯，避免操作混亂
  let viewLink = {...link};
  if(currentCharacter && link.targetCharacterId === currentCharacter.id && link.direction !== "oneway"){
    viewLink = {
      ...link,
      sourceCharacterId: link.targetCharacterId,
      targetCharacterId: link.sourceCharacterId,
      sourceLabel: link.targetLabel,
      targetLabel: link.sourceLabel
    };
  }
  editingCharacterLinkId = id;
  fillCharacterLinkEditor(viewLink);
  showScreen("characterLinkEditor");
}

async function saveCharacterLinkEditor(){
  const sourceCharacterId = characterLinkSourceId.value;
  const targetCharacterId = characterLinkTargetId.value;
  if(!sourceCharacterId || !targetCharacterId) return showToast("請選擇關係對象");
  if(sourceCharacterId === targetCharacterId) return showToast("不能把人物和自己建立關係");

  const data = {
    sourceCharacterId,
    targetCharacterId,
    relationType:characterLinkType.value,
    sourceLabel:characterLinkSourceLabel.value.trim(),
    targetLabel:characterLinkTargetLabel.value.trim(),
    direction:characterLinkDirection.value,
    visibility:characterLinkVisibility.value,
    intimacy:clampRelationScore(characterLinkIntimacy.value),
    trust:clampRelationScore(characterLinkTrust.value),
    notes:characterLinkNotes.value.trim()
  };

  const btn = saveCharacterLinkBtn;
  btn.disabled = true;
  btn.textContent = "☁️ 儲存中……";
  try{
    const saved = await apiPost("saveCharacterRelation",{
      novelId:currentNovel["ID"],
      relationId:editingCharacterLinkId || "",
      data
    });

    const i = characterLinks.findIndex(x => x.id === saved.id);
    if(i >= 0) characterLinks[i] = saved;
    else characterLinks.push(saved);

    editingCharacterLinkId = "";
    currentCharacter = characterById(sourceCharacterId) || currentCharacter;
    showToast("✅ 人物關係已儲存");
    openCharacterDetail(currentCharacter.id);
  }catch(e){
    console.error(e);
    showToast(e.message || "人物關係儲存失敗");
  }finally{
    btn.disabled = false;
    btn.textContent = "💾 儲存關係";
  }
}

async function deleteCharacterLink(id){
  if(!confirm("確定移除這筆人物關係？")) return;
  try{
    await apiPost("deleteCharacterRelation",{
      novelId:currentNovel["ID"],
      relationId:id
    });
    characterLinks = characterLinks.filter(x => x.id !== id);
    renderCharacterLinks();
    showToast("✅ 人物關係已移除");
  }catch(e){ showToast(e.message || "移除失敗"); }
}

/* =========================================================
 * v1.4 Relations — 人物 × 勢力雙向關聯
 * 單一來源：relations.json
 * =======================================================*/
function characterById(id){ return characters.find(x => x.id === id); }
function factionById(id){ return factions.find(x => x.id === id); }

function renderCharacterRelations(){
  const box = document.getElementById("characterRelationList");
  if(!box || !currentCharacter) return;
  const list = relations.filter(r => r.characterId === currentCharacter.id);
  box.innerHTML = list.length ? list.map(r => {
    const f = factionById(r.factionId);
    return `<article class="relation-card">
      <button class="relation-main" type="button" onclick="jumpToFaction('${safeAttr(r.factionId)}')">
        <span class="relation-emoji">${f ? factionEmoji(f.type) : "🏯"}</span>
        <span class="relation-copy"><b>${escapeHtml(f?.name || "已刪除的勢力")}</b><small>${escapeHtml(r.role || f?.type || "關聯勢力")}</small></span>
        <span class="character-arrow">›</span>
      </button>
      <button class="relation-delete" type="button" onclick="deleteRelation('${safeAttr(r.id)}')">移除</button>
    </article>`;
  }).join("") : '<div class="relation-empty">尚未建立勢力關聯。</div>';
}

function renderFactionRelations(){
  const box = document.getElementById("factionRelationList");
  if(!box || !currentFaction) return;
  const list = relations.filter(r => r.factionId === currentFaction.id);
  box.innerHTML = list.length ? list.map(r => {
    const c = characterById(r.characterId);
    return `<article class="relation-card">
      <button class="relation-main" type="button" onclick="jumpToCharacter('${safeAttr(r.characterId)}')">
        <span class="relation-emoji">${c ? emojiForRole(c.role) : "👤"}</span>
        <span class="relation-copy"><b>${escapeHtml(c?.name || "已刪除的人物")}</b><small>${escapeHtml(r.role || c?.role || "關聯人物")}</small></span>
        <span class="character-arrow">›</span>
      </button>
      <button class="relation-delete" type="button" onclick="deleteRelation('${safeAttr(r.id)}')">移除</button>
    </article>`;
  }).join("") : '<div class="relation-empty">尚未建立人物關聯。</div>';
}

async function ensureRelationSources(){
  if(!characters.length) characters = await apiGet("getCharacters",{novelId:currentNovel["ID"]}) || [];
  if(!factions.length) factions = await apiGet("getFactions",{novelId:currentNovel["ID"]}) || [];
}

async function openRelationEditorFromCharacter(){
  relationReturn = "detail";
  try{
    await ensureRelationSources();
    fillRelationEditor(currentCharacter?.id || "", "");
    showScreen("relationEditor");
  }catch(e){ showToast(e.message || "讀取關聯資料失敗"); }
}

async function openRelationEditorFromFaction(){
  relationReturn = "factionDetail";
  try{
    await ensureRelationSources();
    fillRelationEditor("", currentFaction?.id || "");
    showScreen("relationEditor");
  }catch(e){ showToast(e.message || "讀取關聯資料失敗"); }
}

function fillRelationEditor(characterId="", factionId=""){
  relationCharacterId.innerHTML = characters.map(c =>
    `<option value="${safeAttr(c.id)}" ${c.id===characterId?"selected":""}>${escapeHtml(c.name || "未命名人物")}｜${escapeHtml(c.role || "未設定")}</option>`
  ).join("");
  relationFactionId.innerHTML = factions.map(f =>
    `<option value="${safeAttr(f.id)}" ${f.id===factionId?"selected":""}>${escapeHtml(f.name || "未命名勢力")}｜${escapeHtml(f.type || "其他")}</option>`
  ).join("");
  relationRole.value = "";
  relationNotes.value = "";
}

function cancelRelationEditor(){
  if(relationReturn === "factionDetail" && currentFaction) return openFactionDetail(currentFaction.id);
  if(currentCharacter) return openCharacterDetail(currentCharacter.id);
  showScreen("novel");
}

async function saveRelationEditor(){
  const characterId = relationCharacterId.value;
  const factionId = relationFactionId.value;
  const role = relationRole.value.trim();
  const notes = relationNotes.value.trim();
  if(!characterId || !factionId) return showToast("請選擇人物與勢力");

  const btn = saveRelationBtn;
  btn.disabled = true; btn.textContent = "☁️ 儲存中……";
  try{
    const saved = await apiPost("saveRelation",{
      novelId:currentNovel["ID"],
      data:{characterId,factionId,role,notes}
    });
    const i = relations.findIndex(r => r.id === saved.id);
    if(i >= 0) relations[i] = saved; else relations.push(saved);
    showToast("✅ 關聯已建立");
    if(relationReturn === "factionDetail") openFactionDetail(factionId);
    else openCharacterDetail(characterId);
  }catch(e){
    console.error(e); showToast(e.message || "關聯儲存失敗");
  }finally{
    btn.disabled=false; btn.textContent="💾 儲存關聯";
  }
}

async function deleteRelation(id){
  if(!confirm("確定移除這筆關聯？")) return;
  try{
    await apiPost("deleteRelation",{novelId:currentNovel["ID"],relationId:id});
    relations = relations.filter(r => r.id !== id);
    renderCharacterRelations(); renderFactionRelations();
    showToast("✅ 關聯已移除");
  }catch(e){ showToast(e.message || "移除失敗"); }
}

function jumpToFaction(id){
  const f = factionById(id);
  if(!f) return showToast("找不到這個勢力");
  currentFaction = f;
  openFactionDetail(id);
}
function jumpToCharacter(id){
  const c = characterById(id);
  if(!c) return showToast("找不到這個人物");
  currentCharacter = c;
  openCharacterDetail(id);
}

document.getElementById("backBtn").addEventListener("click", () => {
  if (!screens.creativeWorkspace.classList.contains("hidden")) { if(workspaceDirty) saveWorkspaceChapter(false); return showScreen("novel"); }
  if (!screens.aiWriter.classList.contains("hidden")) return showScreen("novel");
  if (!screens.chapterEditor.classList.contains("hidden")) return closeChapterEditor();
  if (!screens.chapters.classList.contains("hidden")) return showScreen("novel");
  if (!screens.timelineEditor.classList.contains("hidden")) return cancelTimelineEditor();
  if (!screens.timeline.classList.contains("hidden")) return showScreen("novel");
  if (!screens.relationshipGraph.classList.contains("hidden")) return showScreen("novel");
  if (!screens.characterLinkEditor.classList.contains("hidden")) return cancelCharacterLinkEditor();
  if (!screens.relationEditor.classList.contains("hidden")) return cancelRelationEditor();
  if (!screens.factionEditor.classList.contains("hidden")) return cancelFactionEditor();
  if (!screens.factionSection.classList.contains("hidden")) return openFactionDetail(currentFaction.id);
  if (!screens.factionDetail.classList.contains("hidden")) return showScreen("factions");
  if (!screens.factions.classList.contains("hidden")) return showScreen("novel");
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
