const assert = require('node:assert/strict');

/** 复现 AI Studio 在行内公式中嵌套 PRE／CODE 的实际网页结构。 */
module.exports = function checkAIStudio(window) {
  const document = window.document;
  let checks = 0;
  const verify = (condition, label) => { assert.ok(condition, label); console.log('PASS ' + label); checks++; };
  const mathHost = (tex, display = false) => {
    const host = document.createElement('ms-katex');
    host.className = display ? '' : 'inline';
    host.innerHTML = '<pre>  <code class="rendered"><span class="katex"><annotation encoding="application/x-tex"></annotation><span class="katex-html">rendered</span></span></code>\n</pre>';
    host.querySelector('annotation').textContent = tex;
    return host;
  };
  const paragraph = document.createElement('p');
  const wrapper = document.createElement('ms-cmark-node');
  const bold = document.createElement('strong');
  bold.append('针对 ', mathHost('K_{t+1}'), ' 求导');
  wrapper.append(bold, '：', document.createElement('br'), '假设第 ', mathHost('t'), ' 期继续投资。');
  paragraph.append(wrapper);
  document.body.append(paragraph);
  let result = window.ZoteroPaste.captureElement(paragraph);
  let parsed = window.verifyZoteroHTML(result.html).json;
  verify(parsed.content.length === 1 && result.inline === 2 && result.display === 0,
    'AI Studio PRE/CODE math hosts do not split inline prose');
  const formula = parsed.content[0].content.find(node => node.type === 'math_inline');
  verify(formula?.marks?.some(mark => mark.type === 'strong'), 'bold formula stays in the same bold phrase');
  verify(!/<pre|<code/.test(result.html) && result.html.includes('<br>'),
    'rendering containers disappear while intentional line breaks remain');
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  window.getSelection().removeAllRanges();window.getSelection().addRange(range);
  verify(window.ZoteroPaste.captureSelection().html === result.html,
    'selection copy handles the same AI Studio host structure');
  const visibleText = paragraph.querySelector('.katex-html').firstChild;
  range.setStart(visibleText, 1);range.setEnd(visibleText, 3);
  window.getSelection().removeAllRanges();window.getSelection().addRange(range);
  result = window.ZoteroPaste.captureSelection();
  verify(result.inline === 1 && result.html.includes('K_{t+1}') && !/<pre|<code/.test(result.html),
    'partial formula selection expands through the complete inline host');
  const displayHost = mathHost('y=x^2', true);
  const displayParagraph = document.createElement('p');
  displayParagraph.append('之前', displayHost, '之后');document.body.append(displayParagraph);
  result = window.ZoteroPaste.captureElement(displayParagraph);
  parsed = window.verifyZoteroHTML(result.html).json;
  verify(result.display === 1 && parsed.content.map(node => node.type).join(',') === 'paragraph,math_display,paragraph',
    'AI Studio display hosts remain separate display formulas');
  const codeParagraph = document.createElement('p');
  const codeWrapper = document.createElement('pre');
  codeWrapper.innerHTML = '<code><span class="katex"><annotation encoding="application/x-tex">z</annotation></span></code>';
  codeParagraph.append('前', codeWrapper, '后');document.body.append(codeParagraph);
  result = window.ZoteroPaste.captureElement(codeParagraph);
  parsed = window.verifyZoteroHTML(result.html).json;
  verify(parsed.content.length === 1 && result.inline === 1,
    'generic formula code wrappers are cleaned before HTML can split paragraphs');
  window.getSelection().removeAllRanges();
  return checks;
};
