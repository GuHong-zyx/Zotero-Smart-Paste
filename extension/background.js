async function run(tabId,mode) {
  if(!tabId) throw new Error('请先打开 AI Studio 网页。');
  await chrome.scripting.executeScript({target:{tabId},files:['converter.js']});
  const results=await chrome.scripting.executeScript({target:{tabId},func:mode=>mode==='pick'?ZoteroPaste.pickAnswer():ZoteroPaste.copySelection(),args:[mode]});
  return results[0]?.result||{ok:true};
}
chrome.runtime.onInstalled.addListener(()=>{
  chrome.contextMenus.removeAll(()=>chrome.contextMenus.create({id:'copy-zotero',title:'复制选区到 Zotero（保留公式）',contexts:['selection']}));
});
chrome.contextMenus.onClicked.addListener((info,tab)=>{if(info.menuItemId==='copy-zotero') run(tab.id,'selection').catch(console.error);});
chrome.commands.onCommand.addListener(async command=>{
  if(command!=='copy-for-zotero')return;
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  try{await run(tab?.id,'selection');}catch(error){console.error(error);chrome.action.setBadgeText({text:'!'});chrome.action.setBadgeBackgroundColor({color:'#9e2537'});}
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message.type!=='run') return;
  run(message.tabId,message.mode).then(sendResponse).catch(error=>sendResponse({ok:false,error:error.message}));
  return true;
});
