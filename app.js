let currentIdToken = '';

async function handleCredentialResponse(response) {
  const status = document.getElementById('status');

  if (!response || !response.credential) {
    status.textContent = '❌ Google 登入失敗，請再試一次。';
    return;
  }

  currentIdToken = response.credential;
  status.textContent = '正在驗證登入權限……';

  try {
    const url = new URL(APP_CONFIG.GAS_API_URL);

    url.searchParams.set('action', 'getCurrentUser');
    url.searchParams.set('idToken', currentIdToken);

    const apiResponse = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    const result = await apiResponse.json();

    if (!result.success) {
      throw new Error(result.error || '登入驗證失敗。');
    }

    const user = result.data;

    status.innerHTML = `
      ✅ 登入成功<br>
      歡迎回來，${escapeHtml(user.name || user.email)}
      <br><br>
      正在讀取小說清單……
    `;

    await loadNovelList();

  } catch (error) {
    console.error(error);

    status.innerHTML = `
      ❌ 無法連接 Apps Script API<br><br>
      ${escapeHtml(error.message || '發生未知錯誤')}
    `;
  }
}

async function loadNovelList() {
  const status = document.getElementById('status');

  try {
    const url = new URL(APP_CONFIG.GAS_API_URL);

    url.searchParams.set('action', 'getNovelList');
    url.searchParams.set('idToken', currentIdToken);

    const apiResponse = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    const result = await apiResponse.json();

    if (!result.success) {
      throw new Error(result.error || '讀取小說清單失敗。');
    }

    renderNovelList(result.data || []);

  } catch (error) {
    console.error(error);

    status.innerHTML = `
      ✅ Google 登入成功<br>
      ❌ 小說清單讀取失敗<br><br>
      ${escapeHtml(error.message || '發生未知錯誤')}
    `;
  }
}

function renderNovelList(novels) {
  const status = document.getElementById('status');

  if (!novels.length) {
    status.innerHTML = `
      ✅ 登入與白名單驗證成功<br><br>
      📚 目前還沒有小說
    `;
    return;
  }

  const cards = novels.map(novel => `
    <article class="novel-card">
      <div class="novel-title">
        📖 ${escapeHtml(novel['書名'] || '未命名小說')}
      </div>

      <div class="novel-meta">
        ${escapeHtml(novel['男主角'] || '未設定男主')}
        ×
        ${escapeHtml(novel['女主角'] || '未設定女主')}
      </div>

      <div class="novel-meta">
        ${escapeHtml(novel['類型'] || '未分類')}
        ｜
        ${escapeHtml(novel['狀態'] || '構思中')}
      </div>

      <div class="novel-id">
        ${escapeHtml(novel['ID'] || '')}
      </div>
    </article>
  `).join('');

  status.innerHTML = `
    <div class="login-success">
      ✅ 登入與白名單驗證成功
    </div>

    <h2>📚 我的小說</h2>

    <div class="novel-list">
      ${cards}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );
}
