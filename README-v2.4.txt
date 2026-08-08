v2.4 伏筆／線索管理中心

GitHub：覆蓋 index.html、style.css、app.js；config.js 不動。
Apps Script：新增 PlotHookService.gs。

doGet switch 的 default 前：
case 'getPlotHooks':
  result = getPlotHooks_(params.novelId);
  break;

doPost switch 的 default 前：
case 'savePlotHook':
  result = savePlotHook_(body.novelId, body.plotHookId, body.data || {});
  break;
case 'deletePlotHook':
  result = deletePlotHook_(body.novelId, body.plotHookId);
  break;

Apps Script 加完後重新部署新版本。
