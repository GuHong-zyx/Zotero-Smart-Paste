for(const mode of ['selection','pick']) document.getElementById(mode).addEventListener('click',async()=>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  document.getElementById('status').textContent='正在处理…';
  const response=await chrome.runtime.sendMessage({type:'run',tabId:tab?.id,mode});
  if(response?.ok) {if(mode==='pick')window.close();else document.getElementById('status').textContent=`已复制：${response.inline} 个行内公式，${response.display} 个独立公式。请按 Ctrl+V 粘贴。`;}
  else document.getElementById('status').textContent=response?.error||'此页面无法运行扩展，请使用粘贴转换。';
});
document.getElementById('convert').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('convert.html')}));
