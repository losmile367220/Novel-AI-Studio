let currentIdToken = '';

async function handleCredentialResponse(response) {
  const status = document.getElementById('status');

  if (!response || !response.credential) {
    status.textContent = '❌ Google 登入失敗，請再試一次。';
    return;
  }

  currentIdToken = response.credential;
  status.textContent = '正在驗證登入並讀取小說……';

  try {
    const url = new URL(APP_CONFIG.GAS_API_URL);

    // 一次完成登入驗證、白名單與小說清單讀取
    url.searchParams.set('action', 'bootstrap');
    url.searchParams.set('idToken', currentIdToken);
    url.searchParams.set('_t', Date.now().toString());

    const apiResponse = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store'
    });

    const responseText = await apiResponse.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Apps Script 原始回應：', responseText);

      throw new Error(
        'Apps Script 回傳的不是 JSON，請確認部署已更新為最新版本。'
      );
    }

    if (!result.success) {
      throw new Error(result.error || '登入驗證失敗。');
    }

    const bootstrap = result.data || {};
    const user = bootstrap.user || {};
    const novels = bootstrap.novels || [];

    renderNovelList(user, novels);

  } catch (error) {
    console.error(error);

    status.innerHTML = `
      ❌ 無法讀取 Novel AI Studio<br><br>
      ${escapeHtml(error.message || '發生未知錯誤')}
    `;
  }
}

function renderNovelList(user, novels) {
  const status = document.getElementById('status');

  const welcome = `
    <div class="login-success">
      ✅ 登入與白名單驗證成功
    </div>

    <p>
      歡迎回來，${escapeHtml(user.name || user.email || '創作者')}
    </p>
  `;

  if (!novels.length) {
    status.innerHTML = `
      ${welcome}

      <h2>📚 我的小說</h2>

      <div class="empty-message">
        目前還沒有小說
      </div>
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
    ${welcome}

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
