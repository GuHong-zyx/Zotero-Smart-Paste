const source=document.getElementById('source'),preview=document.getElementById('preview'),message=document.getElementById('message');
let result=null;
function show(converted) {
  result=converted;preview.innerHTML=result.html;
  for(const node of preview.querySelectorAll('pre.math,span.math')) {
    const displayMode=node.matches('pre');
    try{katex.render(ZoteroPaste.normalizeTex(node.textContent),node,{displayMode,throwOnError:true,trust:false,strict:'warn'});}catch{result.warnings.push('有公式无法预览，已保留源码；请检查 LaTeX。');}
  }
  message.textContent=`${result.inline} 个行内公式 · ${result.display} 个独立公式`+(result.warnings.length?'。'+[...new Set(result.warnings)].join(' '):'。复制后到 Zotero 按 Ctrl+V。');
}
source.addEventListener('input',()=>show(ZoteroPaste.convertMarkdown(source.value)));
source.addEventListener('paste',event=>{
  const html=event.clipboardData.getData('text/html'),text=event.clipboardData.getData('text/plain');
  // Preserve rich HTML only when replacing the whole input; ordinary text edits stay predictable.
  if(html && (!source.value.trim() || source.selectionStart===0 && source.selectionEnd===source.value.length)) {
    event.preventDefault();const converted=ZoteroPaste.convertHTML(html);source.value=converted.text;show(converted);
  }
});
document.getElementById('copy').addEventListener('click',async()=>{try{await ZoteroPaste.writeClipboard(result);message.textContent='已复制。请在 Zotero 笔记正文按 Ctrl+V。'+(result.warnings.length?' '+result.warnings.join(' '):'');}catch(error){message.textContent=error.message;}});
document.getElementById('clear').addEventListener('click',()=>{source.value='';result=null;preview.replaceChildren();message.textContent='已清空。';source.focus();});
document.getElementById('demo').addEventListener('click',()=>{
  source.value=String.raw`#### 技巧一：动静分离

把家庭决策分为两个步骤：

$$
\sum_j p_{n,t}^{j}c_{n,t}^{j}=P_{n,t}^{c}C_{n,t}
$$

1. **同期问题**：给定总消费 $C_{n,t}$，分配各部门的 $c_{n,t}^{j}$，使花费最小，由此确定价格指数 $P_{n,t}^{c}$。
2. **跨期问题**：把 $C_{n,t}$ 看作价格为 $P_{n,t}^{c}$ 的单一商品。

重复分隔符也可修复：

$$ $x^2+y^2=z^2$ $$
`;show(ZoteroPaste.convertMarkdown(source.value));
});
preview.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});
