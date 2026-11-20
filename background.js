chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['network-bridge.js']});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['helper.js']});
    await chrome.action.setBadgeText({tabId:tab.id,text:''});
  } catch (error) {
    console.error('无法打开助手', error);
    await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
    await chrome.action.setTitle({tabId:tab.id,title:'请在头歌答题页打开助手；扩展更新后请刷新页面。'});
  }
});
