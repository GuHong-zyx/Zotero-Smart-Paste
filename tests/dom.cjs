const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),esbuild=require('esbuild');
const root=path.dirname(__dirname);let checks=0;
const ok=(condition,label)=>{assert.ok(condition,label);console.log('PASS '+label);checks++;};
(async()=>{
  const schemaOutput=path.join(root,'tests/.schema-test.js');
  await esbuild.build({entryPoints:[path.join(root,'tests/schema-entry.js')],outfile:schemaOutput,bundle:true,nodePaths:[path.join(root,'node_modules')],format:'iife',plugins:[{name:'non-editor-ui-stubs',setup(build){build.onLoad({filter:/note-editor[\\/]src[\\/]core[\\/]utils\.js$/},()=>({contents:`export const encodeObject=x=>encodeURIComponent(JSON.stringify(x)); export const decodeObject=x=>JSON.parse(decodeURIComponent(x)); export const randomString=()=>"test"; export const formatCitationItem=()=>"citation";`,loader:'js'}));}}]});
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://aistudio.google.com/prompts/test',pretendToBeVisual:true}),w=dom.window;
  w.eval(fs.readFileSync(path.join(root,'extension/converter.js'),'utf8'));w.eval(fs.readFileSync(schemaOutput,'utf8'));
  const convert=w.ZoteroPaste.convertMarkdown,html=w.ZoteroPaste.convertHTML;
  let r=convert(String.raw`前文 $C_{n,t}$ 与 \(P^c_{n,t}\)。

$$
\sum_j p^j_{n,t}c^j_{n,t}=P^c_{n,t}C_{n,t}
$$

后文。`);
  ok(r.inline===2&&r.display===1,'mixed inline and display delimiters');
  const parsed=w.verifyZoteroHTML(r.html),flat=JSON.stringify(parsed.json);
  ok((flat.match(/math_inline/g)||[]).length===2&&(flat.match(/math_display/g)||[]).length===1,'official Zotero schema recognizes editable math');
  ok(parsed.html.includes('pre class="math"')&&parsed.html.includes('span class="math"'),'official schema serialization roundtrip');
  r=convert(String.raw`$$ $x_{i}^{2}$ $$`);ok(r.display===1&&!r.html.includes('$$$')&&r.html.includes('$$x_{i}^{2}$$'),'nested display/inline dollars repaired');
  r=convert('```python\nx = "$x$"\n```\n\n`$price$`\n\n```math\n\\sum_j x_j\n```');ok(r.inline===0&&r.display===1&&r.html.includes('x = "$x$"'),'real code remains code');
  r=html('<p>前文</p><pre><code>\n \u200b</code></pre><p>后文</p>');ok(!r.html.includes('<pre')&&!JSON.stringify(w.verifyZoteroHTML(r.html).json).includes('codeBlock'),'blank code containers do not become wide bars');
  r=html('<pre><code><span class="katex-display"><span class="katex"><annotation encoding="application/x-tex">x^2</annotation></span></span></code></pre>');
  let wrappedMath=w.verifyZoteroHTML(r.html).json;
  ok(r.html==='<pre class="math">$$x^2$$</pre>'&&wrappedMath.content.length===1&&wrappedMath.content[0].type==='math_display','display formula wrappers produce no phantom codeBlock');
  r=html('<pre><code><span class="katex"><annotation encoding="application/x-tex">X_t</annotation></span></code></pre>');
  wrappedMath=w.verifyZoteroHTML(r.html).json;
  ok(r.html==='<span class="math">$X_t$</span>'&&!JSON.stringify(wrappedMath).includes('codeBlock')&&!JSON.stringify(wrappedMath).includes('"type":"code"'),'inline formula wrappers produce no codeBlock or code mark');
  r=html('<pre><code>before = 1\n<span class="katex-display"><span class="katex"><annotation encoding="application/x-tex">y^2</annotation></span></span>\nafter = 2</code></pre>');
  wrappedMath=w.verifyZoteroHTML(r.html).json;
  ok(wrappedMath.content.map(x=>x.type).join(',')==='codeBlock,math_display,codeBlock'&&wrappedMath.content[0].content[0].text.includes('before = 1')&&wrappedMath.content[2].content[0].text.includes('after = 2'),'mixed code/formula wrappers retain real code on both sides');
  r=html('<p>前文</p><hr><p>后文</p>');ok(r.html.includes('<hr>'),'intentional horizontal rule remains intact');
  r=convert('价格为 $5 和 $10，区间 $5–$10。');ok(r.inline===0,'currency ranges remain text');
  r=html('<p>正文 <span class="katex"><span class="katex-mathml"><math><semantics><mi>C</mi><annotation encoding="application/x-tex">C_{n,t}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">Cn,t</span></span>。</p><span class="katex-display"><span class="katex"><annotation encoding="application/x-tex">\\sum_j x_j</annotation><span class="katex-html">Σjxj</span></span></span>');
  ok(r.inline===1&&r.display===1&&!r.html.includes('katex')&&!r.html.includes('Cn,t'),'KaTeX duplicate layers collapse into one formula');
  r=html('<p>前 <span data-tex="\\frac{a}{b}" data-display="true"></span> 后</p>');ok(r.html==='<p>前 </p><pre class="math">$$\\frac{a}{b}$$</pre><p> 后</p>','display math lifted out of prose paragraph');
  r=html('<p onclick="alert(1)">正文<a href="javascript:alert(1)">链接</a><script>bad()</script><img src="https://example.com/a.png"></p>');ok(!/script|onclick|<img|javascript:/.test(r.html)&&r.warnings.length===1,'safe semantic HTML clipboard output');
  r=html('<ol start="3"><li><p><strong>同期问题</strong> <span class="math">$C_{n,t}$</span></p></li></ol><table><tr><th>变量</th><th>说明</th></tr><tr><td><span class="math">$x$</span></td><td>解释</td></tr></table>');ok(r.inline===2&&r.html.includes('start="3"')&&r.html.includes('<table>')&&r.html.includes('<strong>'),'list numbering, table, bold and inline math preserved');
  w.document.body.innerHTML='<p>文字 <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">C_{n,t}</annotation></semantics></math></span><span class="katex-html">Cn,t</span></span> 结尾</p>';
  const node=w.document.querySelector('.katex-html').firstChild,range=w.document.createRange();range.setStart(node,0);range.setEnd(node,1);w.getSelection().addRange(range);
  r=w.ZoteroPaste.captureSelection();ok(r.inline===1&&r.html.includes('C_{n,t}'),'partial selection expands to complete formula source');
  w.getSelection().removeAllRanges();w.document.body.innerHTML='<ol><li>第一项</li><li><p><strong>第二项</strong></p></li></ol>';
  const listText=w.document.querySelector('strong').firstChild,listRange=w.document.createRange();listRange.selectNodeContents(listText);w.getSelection().addRange(listRange);
  r=w.ZoteroPaste.captureSelection();ok(r.html.includes('<ol start="2">')&&r.html.includes('<strong>第二项</strong>'),'text-only selection retains list number and bold');
  r=html('<p><span class="math">$\\$x$</span></p>');ok(r.html.includes('\\$x'),'escaped dollar inside TeX remains unchanged');
  // Execute actual page event handlers; browser clipboard IO is mocked here.
  const ui=new JSDOM(fs.readFileSync(path.join(root,'extension/convert.html'),'utf8'),{runScripts:'outside-only',url:'https://converter.invalid',pretendToBeVisual:true}),v=ui.window;
  v.eval(fs.readFileSync(path.join(root,'extension/converter.js'),'utf8'));v.eval(fs.readFileSync(path.join(root,'extension/vendor/katex.min.js'),'utf8'));
  let clipboard;v.ClipboardItem=class {constructor(data){this.data=data;}};
  Object.defineProperty(v.navigator,'clipboard',{value:{write:async items=>{clipboard=items[0].data;}}});
  v.eval(fs.readFileSync(path.join(root,'extension/convert.js'),'utf8'));v.document.getElementById('demo').click();
  ok(v.document.querySelectorAll('.katex').length===7,'page preview renders five inline and two display formulas');
  v.document.getElementById('copy').click();await new Promise(resolve=>setTimeout(resolve,0));
  ok(clipboard['text/html'].type==='text/html'&&clipboard['text/plain'].type==='text/plain','clipboard writer supplies HTML plus plain text');
  const source=v.document.getElementById('source'),input=source.value;
  const result=v.ZoteroPaste.convertMarkdown(input),demoFlat=JSON.stringify(w.verifyZoteroHTML(result.html).json);
  ok((demoFlat.match(/math_inline/g)||[]).length===5&&(demoFlat.match(/math_display/g)||[]).length===2,'example survives official schema with correct formula types');
  const pasted=new v.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(pasted,'clipboardData',{value:{getData:type=>type==='text/html'?'<p>粘贴 <span class="math">$z^2$</span></p>':'粘贴 z2'}});source.select();source.dispatchEvent(pasted);
  ok(v.document.querySelectorAll('.katex').length===1&&source.value.includes('$z^2$'),'rich paste retains original LaTeX source');
  console.log(`\n${checks} DOM/schema checks passed. Browser permissions and live AI Studio/Zotero desktop are not tested by this suite.`);
  dom.window.close();ui.window.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
