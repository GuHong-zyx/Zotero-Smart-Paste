const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));}
const root=path.dirname(__dirname),extension=path.join(root,'extension');
let checks=0;const ok=(condition,label)=>{assert.ok(condition,label);console.log('PASS '+label);checks++;};
(async()=>{
  const schemaOutput=path.join(root,'tests/.schema-test.js');
  await esbuild.build({entryPoints:[path.join(root,'tests/schema-entry.js')],outfile:schemaOutput,bundle:true,nodePaths:[path.join(root,'node_modules')],format:'iife',plugins:[{name:'non-editor-ui-stubs',setup(build){
    build.onLoad({filter:/note-editor[\\/]src[\\/]core[\\/]utils\.js$/},()=>({contents:`export const isMac=()=>false; export const encodeObject=x=>encodeURIComponent(JSON.stringify(x)); export const decodeObject=x=>JSON.parse(decodeURIComponent(x)); export const randomString=()=>"test"; export const formatCitationItem=()=>"citation";`,loader:'js'}));
  }}]});
  const server=http.createServer((req,res)=>{const file=path.join(extension,decodeURIComponent(req.url.split('?')[0]==='/'?'/convert.html':req.url.split('?')[0]));if(!file.startsWith(extension+path.sep)){res.writeHead(403);return res.end();}try{const types={'.html':'text/html','.js':'application/javascript','.css':'text/css'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const browser=await playwright.chromium.launch({...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1400,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.addScriptTag({path:schemaOutput});
    const convert=async s=>page.evaluate(s=>ZoteroPaste.convertMarkdown(s),s),html=async s=>page.evaluate(s=>ZoteroPaste.convertHTML(s),s);
    let r=await convert(String.raw`前文 $C_{n,t}$ 与 \(P^c_{n,t}\)。

$$
\sum_j p^j_{n,t}c^j_{n,t}=P^c_{n,t}C_{n,t}
$$

后文。`);
    ok(r.inline===2&&r.display===1,'mixed inline and display delimiters');
    const parsed=await page.evaluate(s=>verifyZoteroHTML(s),r.html);
    const flat=JSON.stringify(parsed.json);ok((flat.match(/math_inline/g)||[]).length===2&&(flat.match(/math_display/g)||[]).length===1,'official Zotero schema recognizes editable math nodes');
    ok(parsed.html.includes('pre class="math"')&&parsed.html.includes('span class="math"'),'Zotero schema serialization roundtrip');
    r=await convert(String.raw`$$ $x_{i}^{2}$ $$`);ok(r.display===1&&!r.html.includes('$$$')&&r.html.includes('$$x_{i}^{2}$$'),'nested display / inline dollars repaired');
    r=await convert('```python\nx = "$x$"\n```\n\n`$price$`\n\n```math\n\\sum_j x_j\n```');ok(r.inline===0&&r.display===1&&r.html.includes('x = "$x$"'),'real code is not converted to math');
    r=await convert('价格为 $5 和 $10，区间 $5–$10。');ok(r.inline===0,'currency ranges remain text');
    r=await html('<p>正文 <span class="katex"><span class="katex-mathml"><math><semantics><mi>C</mi><annotation encoding="application/x-tex">C_{n,t}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">Cn,t</span></span>。</p><span class="katex-display"><span class="katex"><annotation encoding="application/x-tex">\\sum_j x_j</annotation><span class="katex-html">Σjxj</span></span></span>');
    ok(r.inline===1&&r.display===1&&!r.html.includes('katex')&&!r.html.includes('Cn,t'),'KaTeX visual and hidden layers collapse to one formula');
    r=await html('<p>前 <span data-tex="\\frac{a}{b}" data-display="true"></span> 后</p>');ok(r.display===1&&!/<p>[^]*<pre/.test(r.html.split('</p>')[0]),'display formula lifted out of prose paragraph');
    r=await html('<p onclick="alert(1)">正文<a href="javascript:alert(1)">链接</a><script>bad()</script><img src="https://example.com/a.png"></p>');ok(!/script|onclick|<img|javascript:/.test(r.html)&&r.warnings.length===1,'only safe semantic HTML enters clipboard');
    r=await html('<ol start="3"><li><p><strong>同期问题</strong> <span class="math">$C_{n,t}$</span></p></li></ol><table><tr><th>变量</th><th>说明</th></tr><tr><td><span class="math">$x$</span></td><td>解释</td></tr></table>');
    ok(r.inline===2&&r.html.includes('start="3"')&&r.html.includes('<table>')&&r.html.includes('<strong>'),'lists, bold, tables and math remain structured');
    await page.evaluate(()=>{const p=document.createElement('p');p.id='selection-fixture';p.innerHTML='文字 <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">C_{n,t}</annotation></semantics></math></span><span class="katex-html">Cn,t</span></span> 结尾';document.body.append(p);const node=p.querySelector('.katex-html').firstChild,range=document.createRange();range.setStart(node,0);range.setEnd(node,1);const s=getSelection();s.removeAllRanges();s.addRange(range);});
    r=await page.evaluate(()=>ZoteroPaste.captureSelection());ok(r.inline===1&&r.html.includes('C_{n,t}'),'partial selection expands to complete formula source');
    await page.click('#demo');await page.click('#copy');
    const clipboard=await page.evaluate(async()=>{const items=await navigator.clipboard.read();const x=items[0];return {html:await(await x.getType('text/html')).text(),text:await(await x.getType('text/plain')).text()};});
    ok(clipboard.html.includes('<pre class="math">')&&clipboard.html.includes('<span class="math">'),'real browser clipboard includes rich HTML and plain-text fallback');
    await page.evaluate(()=>makeZoteroTestEditor());await page.keyboard.press('Control+V');await page.waitForTimeout(200);
    const doc=await page.evaluate(()=>testEditor.state.doc.toJSON());const pasted=JSON.stringify(doc);
    ok((pasted.match(/math_inline/g)||[]).length===5&&(pasted.match(/math_display/g)||[]).length===2,'Ctrl+V into official Zotero schema yields five inline and two display formulas');
    await page.locator('#test-editor').evaluate(node=>node.remove());await page.locator('#selection-fixture').evaluate(node=>node.remove());
    const layoutResult=await page.evaluate(async()=>{
      const fixture=document.createElement('div');fixture.id='layout-fixture';
      fixture.innerHTML='<ol start="4"><li><p>前文 </p><ul><li><p>嵌套内容</p><p><br></p></li></ul></li></ol>';
      const paragraph=fixture.querySelector('p'),formula=document.createElement('div');
      formula.style.display='inline-block';formula.innerHTML='<span class="katex"><annotation encoding="application/x-tex">x_i</annotation></span>';
      paragraph.append(formula,' 后文。');document.body.append(fixture);
      const range=document.createRange();range.selectNodeContents(fixture);getSelection().removeAllRanges();getSelection().addRange(range);
      const result=ZoteroPaste.captureSelection();await ZoteroPaste.writeClipboard(result);return result;
    });
    ok(layoutResult.inline===1&&!layoutResult.html.includes('<p><br>'),'copy removes blank list paragraphs while retaining inline math');
    await page.evaluate(()=>makeZoteroTestEditor());await page.keyboard.press('Control+V');
    const layoutDoc=await page.evaluate(()=>testEditor.state.doc.toJSON());
    const ordered=layoutDoc.content.find(node=>node.type==='orderedList');
    ok(ordered?.attrs.order===4&&ordered.content[0].content[1].type==='bulletList','actual clipboard paste preserves mixed-list types and numbering');
    ok(ordered.content[0].content[0].content.map(node=>node.type).join(',')==='text,math_inline,text','actual Zotero paste plugin keeps prose and inline formula in one paragraph');
    ok(ordered.content[0].content[1].content[0].content.length===1,'actual clipboard paste introduces no empty nested-list paragraphs');
    await page.locator('#test-editor').evaluate(node=>node.remove());await page.locator('#layout-fixture').evaluate(node=>node.remove());
    await page.screenshot({path:path.join(root,'tests/preview.png'),fullPage:true});
    ok(errors.length===0,'converter UI has no JavaScript errors');
    console.log(`\n${checks} checks passed. Official Zotero schema commit: 7439a18414ffa6e90918283da9e4dbd35fce1a97.`);
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
