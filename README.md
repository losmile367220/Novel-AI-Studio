# Novel AI Studio v1.1.1 Speed Fix

這版專門修正手機人物編輯速度與即時更新問題。

## 修正
- 「下一步 / 上一步」改成正式 JavaScript event listener
- 第 1～4 步完全本機切換，不連 Apps Script
- 儲存人物只呼叫一次 POST
- 儲存成功後直接使用後端回傳的新人物資料更新畫面
- 不再儲存後重新 GET 整份 characters.json
- 刪除後也不再重新 GET
- API 加入逾時提示，避免無限「儲存中」
- 更新 cache-busting 版本號

## 預期體感
- 下一步：立即切換
- 備註改成「測試123」：儲存成功後立刻看到
- 編輯人物：比上一版少一次雲端請求
- 新增人物：比上一版少一次雲端請求

## 更新 GitHub
只需要覆蓋：
- index.html
- style.css
- app.js

config.js 沒有功能變更，可以不覆蓋。

Apps Script 本次不用修改、不用重新部署。
