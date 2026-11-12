import MarkdownIt from 'markdown-it';
import {cloneClipboardShell,cloneClipboardContents,prepareClipboardLayout,compactClipboardBlocks} from './layout.js';

// All output is semantic HTML understood by Zotero's public note schema.
// No rendered KaTeX glyphs, scripts, images, or page styles enter the clipboard.
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escaped = (s, p) => { let n=0; while(p>0 && s[--p]==='\\') n++; return n%2===1; };
const ends = (s, x) => s.endsWith(x) && !escaped(s,s.length-x.length);
export function normalizeTex(input) {
  let s=String(input).replace(/\u200b/g,'').replace(/\u00a0/g,' ').trim();
  for(let i=0;i<8;i++) {
    if(s.startsWith('\\[') && ends(s,'\\]') || s.startsWith('\\(') && ends(s,'\\)')) s=s.slice(2,-2).trim();
    else if(s.startsWith('$$') && ends(s,'$$')) s=s.slice(2,-2).trim();
    else if(s.startsWith('$') && ends(s,'$') && s.length>1) s=s.slice(1,-1).trim();
    else break;
  }
  return s;
}
function mathAt(s,pos) {
  if(escaped(s,pos)) return null;
  const open=['\\[','\\(','$$','$'].find(x=>s.startsWith(x,pos));
  if(!open) return null;
  const close=({'\\[':'\\]','\\(':'\\)','$$':'$$','$':'$'})[open];
  if(open==='$' && /\s/.test(s[pos+1]||' ')) return null;
  let end=pos+open.length;
  while((end=s.indexOf(close,end))>=0) {
    if(escaped(s,end)) { end+=close.length; continue; }
    if(open==='$' && (s[end-1]==='$' || s[end+1]==='$' || /\s/.test(s[end-1]))) return null;
    const content=s.slice(pos+open.length,end);
    if(open==='$' && (content.includes('\n') || /^[\d.,\s–-]+$/.test(content) && /\d/.test(s[end+1]||''))) return null;
    return {tex:normalizeTex(content),display:open==='$$'||open==='\\[',end:end+close.length};
  }
  return null;
}
const placeholder = m => `<zp-math data-display="${m.display?'1':'0'}" data-tex="${esc(m.tex)}"></zp-math>`;
const md=new MarkdownIt({html:false,linkify:false,typographer:false,breaks:false});
md.inline.ruler.before('escape','zotero_math',(state,silent)=>{
  const m=mathAt(state.src,state.pos);
  if(!m || !m.tex) return false;
  if(!silent) {const token=state.push('html_inline','',0); token.content=placeholder(m);}
  state.pos=m.end; return true;
});
md.block.ruler.before('fence','zotero_display_math',(state,start,end,silent)=>{
  const pos=state.bMarks[start]+state.tShift[start];
  if(!state.src.startsWith('$$',pos) && !state.src.startsWith('\\[',pos)) return false;
  const m=mathAt(state.src,pos);
  if(!m || !m.tex || m.end>state.eMarks[end-1]) return false;
  let line=start; while(line<end && state.eMarks[line]<m.end) line++;
  if(line>=end || state.src.slice(m.end,state.eMarks[line]).trim()) return false;
  if(silent) return true;
  const token=state.push('html_block','',0); token.content=placeholder(m)+'\n'; token.map=[start,line+1];
  state.line=line+1; return true;
},{alt:['paragraph','reference','blockquote','list']});
md.renderer.rules.fence=(tokens,i,options,env,self)=>{
  const token=tokens[i];
  if(/^(math|latex|tex|katex)\s*$/i.test(token.info.trim())) return placeholder({tex:normalizeTex(token.content),display:true});
  return `<pre><code>${esc(token.content)}</code></pre>\n`;
};
export const markdownHTML = input => md.render(String(input));

const formulaSelector='ms-katex,.katex-display,.katex,mjx-container,math,math-inline,math-display,span.math,pre.math,.math-inline,.math-block,[data-tex],[data-latex],[data-formula],script[type^="math/tex"]';
const drop=new Set(['SCRIPT','STYLE','LINK','META','NOSCRIPT','TEMPLATE','IFRAME','OBJECT','EMBED','SVG','CANVAS','BUTTON','INPUT','TEXTAREA','SELECT','NAV','ASIDE']);
const allowed=new Set(['P','H1','H2','H3','H4','H5','H6','STRONG','EM','U','S','SUB','SUP','CODE','PRE','UL','OL','LI','BLOCKQUOTE','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH','A','BR','HR']);
const blocks=new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','TABLE','TR','PRE']);
function getMath(node) {
  if(node.tagName==='ZP-MATH') return {tex:normalizeTex(node.getAttribute('data-tex')||''),display:node.dataset.display==='1'};
  if(!node.matches(formulaSelector)) return null;
  const display=node.matches('.katex-display,pre.math,.math-block,math-display') || node.getAttribute('display')==='block'
    || node.tagName==='MS-KATEX' && !node.classList.contains('inline')
    || node.getAttribute('data-display')==='true' || node.getAttribute('data-display-mode')==='true'
    || /mode\s*=\s*display/.test(node.getAttribute('type')||'') || node.classList.contains('MathJax_Display')
    || node.tagName==='MJX-CONTAINER' && node.getAttribute('display')==='true';
  const annotation=node.querySelector('annotation[encoding="application/x-tex"],annotation[encoding="application/x-latex"]');
  let tex=annotation?.textContent || node.getAttribute('data-tex') || node.getAttribute('data-latex') || node.getAttribute('data-formula');
  if(!tex && node.matches('span.math,pre.math,math-inline,math-display,.math-inline,.math-block,script[type^="math/tex"]')) tex=node.textContent;
  return {tex:tex?normalizeTex(tex):null,display};
}
function createMath(doc,tex,display) {
  const out=doc.createElement(display?'pre':'span'); out.className='math';
  out.textContent=(display?'$$':'$')+normalizeTex(tex)+(display?'$$':'$'); return out;
}
function splitText(text,doc) {
  const out=doc.createDocumentFragment(); let start=0,pos=0;
  while(pos<text.length) {
    const m=mathAt(text,pos);
    if(m?.tex) {out.append(doc.createTextNode(text.slice(start,pos)),createMath(doc,m.tex,m.display));pos=m.end;start=pos;}
    else pos++;
  }
  out.append(doc.createTextNode(text.slice(start))); return out;
}
function safeHref(value,base) {
  if(!value) return null;
  try {const u=new URL(value,base||'https://invalid.local'); return /^(https?:|mailto:|zotero:)$/.test(u.protocol)?u.href:null;} catch{return null;}
}
function cleanCodeContainer(target,doc) {
  // A rendered formula can sit inside AI Studio's PRE/CODE wrappers. Passing
  // those through makes Zotero create an empty codeBlock before the formula.
  const result=doc.createDocumentFragment();
  function appendCode(content) {
    if(!content.textContent.replace(/[\s\u200b-\u200d\ufeff]/g,'')) return;
    const code=target.cloneNode(false);code.append(content);result.append(code);
  }
  let formula;
  while((formula=target.querySelector('span.math,pre.math'))) {
    const range=doc.createRange();range.setStart(target,0);range.setEndBefore(formula);
    appendCode(range.extractContents());
    result.append(formula);
  }
  const remainder=doc.createDocumentFragment();remainder.append(...target.childNodes);
  appendCode(remainder);
  return result;
}
function cleanNode(node,doc,ctx,inCode=false) {
  if(node.nodeType===3) return inCode?doc.createTextNode(node.textContent):splitText(node.textContent,doc);
  if(node.nodeType!==1) return doc.createDocumentFragment();
  const math=getMath(node);
  if(math?.tex) return createMath(doc,math.tex,math.display);
  if(math && !math.tex) {
    ctx.warnings.add('有公式未提供 LaTeX 源码，已保留其可见文字；请检查。');
    const visible=node.querySelector('.katex-html') || node;
    return doc.createTextNode(visible.textContent||'');
  }
  if(drop.has(node.tagName) || node.hidden || node.getAttribute('aria-hidden')==='true') return doc.createDocumentFragment();
  if(node.tagName==='IMG') {ctx.warnings.add('图片未复制；本工具只处理文字、公式和表格。');return doc.createDocumentFragment();}
  let tag=({'B':'STRONG','I':'EM','DEL':'S','STRIKE':'S'})[node.tagName]||node.tagName;
  if(tag==='PRE') {
    const lang=node.querySelector('code')?.className||node.className;
    if(/(?:language-|lang-)(?:math|latex|tex|katex)\b/i.test(lang)) return createMath(doc,node.textContent,true);
  }
  let target;
  if(allowed.has(tag)) target=doc.createElement(tag);
  else if(blocks.has(tag)) target=doc.createElement('div');
  else target=doc.createDocumentFragment();
  if(tag==='A' && target.nodeType===1) {const href=safeHref(node.getAttribute('href'),ctx.base);if(href) target.setAttribute('href',href);}
  if(tag==='OL' && /^\d+$/.test(node.getAttribute('start')||'')) target.setAttribute('start',node.getAttribute('start'));
  if(tag==='TD'||tag==='TH') for(const key of ['colspan','rowspan']) if(/^\d+$/.test(node.getAttribute(key)||'')) target.setAttribute(key,String(Math.min(100,Number(node.getAttribute(key)))));
  for(const child of node.childNodes) target.append(cleanNode(child,doc,ctx,inCode||tag==='CODE'||tag==='PRE'));
  if(tag==='PRE'||tag==='CODE') return cleanCodeContainer(target,doc);
  return target;
}
function liftDisplay(root) {
  // A block formula inside a paragraph/mark must be lifted without losing prose.
  for(const formula of [...root.querySelectorAll('pre.math')]) {
    while(formula.parentElement && formula.parentElement!==root && /^(P|SPAN|STRONG|EM|U|S|A|H[1-6]|CODE|SUB|SUP)$/.test(formula.parentElement.tagName)) {
      const parent=formula.parentElement, before=parent.cloneNode(false),after=parent.cloneNode(false);
      while(parent.firstChild && parent.firstChild!==formula) before.append(parent.firstChild);
      while(formula.nextSibling) after.append(formula.nextSibling);
      const parts=[]; if(before.textContent.trim()||before.querySelector('br')) parts.push(before);
      parts.push(formula); if(after.textContent.trim()||after.querySelector('br')) parts.push(after);
      parent.replaceWith(...parts);
    }
  }
}
function toMarkdown(node) {
  if(node.nodeType===3) return node.textContent;
  if(node.nodeType!==1) return '';
  if(node.matches('pre.math')) return '\n\n$$\n'+normalizeTex(node.textContent)+'\n$$\n\n';
  if(node.matches('span.math')) return '$'+normalizeTex(node.textContent)+'$';
  const body=[...node.childNodes].map(toMarkdown).join('');
  const tag=node.tagName;
  if(/^H[1-6]$/.test(tag)) return '\n\n'+'#'.repeat(Number(tag[1]))+' '+body+'\n\n';
  if(tag==='STRONG') return '**'+body+'**'; if(tag==='EM') return '*'+body+'*'; if(tag==='S') return '~~'+body+'~~';
  if(tag==='PRE') return '\n\n```\n'+node.textContent+'\n```\n\n';
  if(tag==='CODE') return '`'+body+'`'; if(tag==='BR') return '\n'; if(tag==='HR') return '\n\n---\n\n';
  if(tag==='A') return node.getAttribute('href')?'['+body+']('+node.getAttribute('href')+')':body;
  if(tag==='LI') {const list=node.parentElement;const index=list?.tagName==='OL'?Number(list.getAttribute('start')||1)+[...list.children].indexOf(node):null;return '\n'+(index===null?'- ':index+'. ')+body.trim().replace(/\n/g,'\n  ')+'\n';}
  if(tag==='TD'||tag==='TH') return body+' | '; if(tag==='TR') return '\n| '+body+'\n';
  return blocks.has(tag)?'\n\n'+body+'\n\n':body;
}
/** 直接清理节点树，避免重新解析网页字符串时提前拆开含公式的段落。 */
function convertDOM(source,{base}={}) {
  const doc=document.implementation.createHTMLDocument(''); const root=doc.createElement('div');
  const ctx={warnings:new Set(),base};
  for(const node of source.childNodes) root.append(cleanNode(node,doc,ctx));
  liftDisplay(root);
  compactClipboardBlocks(root);
  const inline=root.querySelectorAll('span.math').length,display=root.querySelectorAll('pre.math').length;
  return {html:root.innerHTML,text:toMarkdown(root).replace(/\n{3,}/g,'\n\n').trim(),inline,display,warnings:[...ctx.warnings]};
}
export function convertHTML(html,options={}) {
  const source=new DOMParser().parseFromString(String(html),'text/html');
  return convertDOM(source.body,options);
}
export const convertMarkdown = input => convertHTML(markdownHTML(input));
/** 复制完整元素的内容，按原网页布局整理后返回 Zotero 富文本。 */
export function captureElement(element) {
  const range=document.createRange();range.selectNodeContents(element);
  const captured=document.createElement('div'),wrapper=cloneClipboardShell(element);
  wrapper.append(cloneClipboardContents(range));captured.append(wrapper);
  prepareClipboardLayout(captured);
  return convertDOM(captured,{base:location.href});
}
function mathRoot(node) {
  let el=node.nodeType===1?node:node.parentElement; const nearest=el?.closest(formulaSelector);
  if(!nearest) return null;
  return nearest.closest('ms-katex') || nearest.closest('.katex-display') || nearest.closest('mjx-container') || nearest;
}
export function captureSelection(selection=window.getSelection()) {
  if(!selection?.rangeCount || selection.isCollapsed) return null;
  const root=document.createElement('div');
  for(let i=0;i<selection.rangeCount;i++) {
    const range=selection.getRangeAt(i).cloneRange();
    const start=mathRoot(range.startContainer),end=mathRoot(range.endContainer);
    if(start) range.setStartBefore(start); if(end) range.setEndAfter(end);
    const ancestor=range.commonAncestorContainer;
    if(ancestor.nodeType===1 && !/^(HTML|BODY)$/.test(ancestor.tagName)) {
      let wrapper=cloneClipboardShell(ancestor); wrapper.append(cloneClipboardContents(range));
      let original=ancestor;
      const list=ancestor.closest('ol,ul');
      if(list) {
        while(original!==list) {original=original.parentElement;const parent=cloneClipboardShell(original);parent.append(wrapper);wrapper=parent;}
        if(list.tagName==='OL') {
          const first=[...list.children].find(child=>range.intersectsNode(child));
          if(first) wrapper.setAttribute('start',String(Number(list.getAttribute('start')||1)+[...list.children].indexOf(first)));
        }
      }
      root.append(wrapper);
    } else {
      const fragment=cloneClipboardContents(range);
      // A text-only common ancestor still inherits its surrounding inline marks.
      if(ancestor.nodeType===3 && ancestor.parentElement && !/^(HTML|BODY)$/.test(ancestor.parentElement.tagName)) {
        let original=ancestor.parentElement,wrapper=cloneClipboardShell(original);wrapper.append(fragment);
        const list=original.closest('ol,ul');
        if(list) {const first=original.closest('li');while(original!==list){original=original.parentElement;const parent=cloneClipboardShell(original);parent.append(wrapper);wrapper=parent;}if(list.tagName==='OL') wrapper.setAttribute('start',String(Number(list.getAttribute('start')||1)+[...list.children].indexOf(first)));}
        root.append(wrapper);
      } else root.append(fragment);
    }
  }
  prepareClipboardLayout(root);
  return convertDOM(root,{base:location.href});
}
export async function writeClipboard(result) {
  if(!result?.text?.trim()) throw new Error('没有可复制的文字。请先选中回答中的文字。');
  if(navigator.clipboard?.write && typeof ClipboardItem!=='undefined') {
    try {await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([result.html],{type:'text/html'}),'text/plain':new Blob([result.text],{type:'text/plain'})})]);return;} catch { /* use synchronous rich-copy fallback */ }
  }
  let supplied=false;
  const listener=event=>{event.preventDefault();event.stopImmediatePropagation();event.clipboardData.setData('text/html',result.html);event.clipboardData.setData('text/plain',result.text);supplied=true;};
  document.addEventListener('copy',listener,true);
  try {if(!document.execCommand('copy') || !supplied) throw new Error('浏览器未允许复制。请点击扩展，打开“粘贴转换”后再复制。');}
  finally {document.removeEventListener('copy',listener,true);}
}
export function toast(message,error=false) {
  document.getElementById('zp-toast')?.remove();
  const host=document.createElement('div');host.id='zp-toast';
  host.style.cssText='position:fixed;right:24px;bottom:24px;z-index:2147483647;max-width:480px;';
  const shadow=host.attachShadow({mode:'closed'}),box=document.createElement('div');
  box.style.cssText=`padding:15px 20px;border-radius:12px;background:${error?'#9e2537':'#143e37'};color:white;font:14px/1.7 system-ui,sans-serif;box-shadow:0 8px 32px #0003;white-space:pre-line;`;
  box.textContent=message;shadow.append(box);document.documentElement.append(host);setTimeout(()=>host.remove(),7000);
}
export async function copySelection() {
  try {const result=captureSelection();await writeClipboard(result);toast(`已复制：${result.inline} 个行内公式，${result.display} 个独立公式。\n到 Zotero 笔记按 Ctrl+V 粘贴。`+(result.warnings.length?'\n'+result.warnings.join('\n'):''));return {ok:true,...result};}
  catch(error){toast(error.message,true);return {ok:false,error:error.message};}
}
export function pickAnswer() {
  window.__zpCancelPicker?.();
  const outline=document.createElement('div');outline.style.cssText='position:fixed;pointer-events:none;border:2px solid #087f68;border-radius:8px;background:#087f6812;z-index:2147483646;';
  document.documentElement.append(outline); let current=null;
  toast('点击要复制的回答；Esc 取消。\n也可以先选中文字，再按 Ctrl+Shift+Z。');
  function candidate(target) {
    if(!(target instanceof Element) || target.closest('#zp-toast')) return null;
    const turn=target.closest('ms-chat-turn,ms-model-response,[data-message-author-role="assistant"]');
    if(turn) return turn.querySelector('.model-response-text,.markdown,ms-cmark-node')?.closest('.model-response-text') || turn.querySelector('.markdown') || turn;
    return target.closest('ms-cmark-node,.markdown,.markdown-body,.model-response-text,.response-content') || target.closest('article,p,li,table,pre,blockquote,h1,h2,h3,h4');
  }
  function move(event){current=candidate(event.target); if(!current){outline.style.display='none';return;}const r=current.getBoundingClientRect();Object.assign(outline.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
  function cancel(){document.removeEventListener('pointermove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);outline.remove();delete window.__zpCancelPicker;}
  async function click(event){if(!current)return;event.preventDefault();event.stopImmediatePropagation();const answer=current;cancel();try{const result=captureElement(answer);await writeClipboard(result);toast(`已复制：${result.inline} 个行内公式，${result.display} 个独立公式。\n到 Zotero 笔记按 Ctrl+V。`+(result.warnings.length?'\n'+result.warnings.join('\n'):''));}catch(error){toast(error.message,true);}}
  function key(event){if(event.key==='Escape'){cancel();toast('已取消。');}}
  document.addEventListener('pointermove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);window.__zpCancelPicker=cancel;
}
