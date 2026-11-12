const assert = require('node:assert/strict');

/** 针对真实网页布局容器验证段落、列表层级和空白，不更改用户网页。 */
module.exports = function checkLayout(window) {
  let checks = 0;
  const verify = (condition, label) => {
    assert.ok(condition, label);
    console.log('PASS ' + label);
    checks++;
  };
  const document = window.document;
  const convert = window.ZoteroPaste.convertHTML;
  const select = element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return window.ZoteroPaste.captureSelection();
  };
  const paragraphWithMath = () => {
    const paragraph = document.createElement('p');
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-layout';
    wrapper.innerHTML = '<span class="katex"><annotation encoding="application/x-tex">x_i</annotation></span>';
    paragraph.append('前文 ', wrapper, ' 后文。');
    return paragraph;
  };
  document.body.innerHTML = '<style>.inline-layout{display:inline-block}</style>';
  const paragraph = paragraphWithMath();
  document.body.append(paragraph);
  let result = select(paragraph);
  let parsed = window.verifyZoteroHTML(result.html).json;
  verify(parsed.content.length === 1 && parsed.content[0].type === 'paragraph'
    && parsed.content[0].content.map(node => node.type).join(',') === 'text,math_inline,text',
  'inline layout wrappers do not split prose at formulas');
  verify(paragraph.querySelector('div') && !paragraph.querySelector('[data-zp-inline-layout]'),
    'capture does not modify the source page');
  verify(window.ZoteroPaste.captureElement(paragraph).html === result.html,
    'whole-answer copy applies the same paragraph normalization');

  const list = document.createElement('ol');
  list.start = 4;
  const item = document.createElement('li');
  const nested = document.createElement('ul');
  const nestedItem = document.createElement('li');
  nestedItem.append(paragraphWithMath());
  nested.append(nestedItem);
  item.append(paragraphWithMath(), nested);
  list.append(item);
  document.body.append(list);
  result = select(list);
  parsed = window.verifyZoteroHTML(result.html).json;
  const outer = parsed.content[0];
  verify(outer.type === 'orderedList' && outer.attrs.order === 4
    && outer.content[0].content[1].type === 'bulletList', 'mixed lists retain their types, start and nesting');
  verify(outer.content[0].content[0].content.some(node => node.type === 'math_inline')
    && outer.content[0].content[1].content[0].content.length === 1,
  'formulas in nested lists stay inside their original paragraph');

  result = convert('<div>\n<p>第一段</p>\n<p><br></p>\n<div>\u200b</div>\n<p>第二段</p>\n</div>');
  parsed = window.verifyZoteroHTML(result.html).json;
  verify(parsed.content.length === 2 && parsed.content.every(node => node.content?.length),
    'empty paragraphs and layout-only blank blocks are removed');
  verify(!/>\s+</.test(result.html), 'indentation between block nodes is removed');
  result = convert('<p>第一行<br>第二行</p><pre><code>first\n\nthird</code></pre>');
  verify(result.html.includes('第一行<br>第二行') && result.html.includes('first\n\nthird'),
    'intentional inline breaks and blank code lines remain');
  result = convert('<p><strong>first</strong> <em>second</em></p>');
  verify(result.html.includes('</strong> <em>'), 'spaces between inline marks remain');
  result = convert('<ul><li><p>一</p><p></p></li><li><p>二</p></li></ul>');
  parsed = window.verifyZoteroHTML(result.html).json;
  verify(parsed.content[0].content.length === 2 && parsed.content[0].content[0].content.length === 1,
    'blank paragraphs do not inflate list items');
  window.getSelection().removeAllRanges();
  return checks;
};
