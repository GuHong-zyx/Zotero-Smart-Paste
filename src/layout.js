const layoutTags = /^(DIV|SECTION|ARTICLE)$/;
const inlineParents = 'p,h1,h2,h3,h4,h5,h6,strong,em,u,s,a,code';
const semanticBlocks = 'p,h1,h2,h3,h4,h5,h6,ul,ol,li,table,blockquote,pre:not(.math)';

/** 克隆元素外层，并记录影响段落结构的行内布局，不复制网页样式。 */
export function cloneClipboardShell(element) {
  const clone = element.cloneNode(false);
  const view = element.ownerDocument.defaultView;
  if (layoutTags.test(element.tagName) && view
      && /^(inline|inline-block|contents)$/.test(view.getComputedStyle(element).display)) {
    clone.setAttribute('data-zp-inline-layout', '1');
  }
  return clone;
}

/** 克隆选区并保留布局标记；返回文档片段，不修改原网页或原选区。 */
export function cloneClipboardContents(range) {
  const sourceRoot = range.commonAncestorContainer;
  const cloneRoot = sourceRoot.cloneNode(true);
  const owner = sourceRoot.ownerDocument;
  const sourceWalker = owner.createTreeWalker(sourceRoot, 0xffffffff);
  const cloneWalker = owner.createTreeWalker(cloneRoot, 0xffffffff);
  let sourceNode = sourceRoot, cloneNode = cloneRoot, startNode, endNode;
  while (sourceNode) {
    if (sourceNode === range.startContainer) startNode = cloneNode;
    if (sourceNode === range.endContainer) endNode = cloneNode;
    if (sourceNode.nodeType === 1 && layoutTags.test(sourceNode.tagName)) {
      const shell = cloneClipboardShell(sourceNode);
      if (shell.hasAttribute('data-zp-inline-layout')) cloneNode.setAttribute('data-zp-inline-layout', '1');
    }
    sourceNode = sourceWalker.nextNode();
    cloneNode = cloneWalker.nextNode();
  }
  const copiedRange = owner.createRange();
  copiedRange.setStart(startNode, range.startOffset);
  copiedRange.setEnd(endNode, range.endOffset);
  return copiedRange.cloneContents();
}

/** 在序列化前展开网页布局容器，避免 HTML 解析器把行内公式拆出段落。 */
export function prepareClipboardLayout(root) {
  for (const container of [...root.querySelectorAll('div,section,article')].reverse()) {
    const inline = container.hasAttribute('data-zp-inline-layout')
      || /^(inline|inline-block|contents)$/.test(container.style.display);
    const inParagraph = container.parentElement?.closest(inlineParents);
    if (!inline && !(inParagraph && !container.querySelector(semanticBlocks))) continue;
    if (container.querySelector(semanticBlocks) && !container.matches('.katex-display,.katex,[data-tex],[data-latex]')) {
      container.replaceWith(...container.childNodes);
      continue;
    }
    const replacement = container.ownerDocument.createElement('span');
    for (const attribute of container.attributes) replacement.setAttribute(attribute.name, attribute.value);
    replacement.append(...container.childNodes);
    container.replaceWith(replacement);
  }
}

/** 删除转换产生的空段落和块间缩进空白，保留真实代码、公式和段内换行。 */
export function compactClipboardBlocks(root) {
  for (const paragraph of [...root.querySelectorAll('p,div')].reverse()) {
    if (paragraph.closest('pre,code')) continue;
    if (!paragraph.textContent.replace(/[\s\u200b-\u200d\ufeff]/g, '')
        && !paragraph.querySelector('span.math,pre.math,table,hr')) paragraph.remove();
  }
  const block = node => node?.nodeType === 1
    && /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|PRE|HR)$/.test(node.tagName);
  for (const container of [root, ...root.querySelectorAll('div,ul,ol,li,blockquote,table,thead,tbody,tfoot,tr,td,th')]) {
    for (const child of [...container.childNodes]) {
      if (child.nodeType === 3 && !child.textContent.trim()
          && (block(child.previousSibling) || block(child.nextSibling))) child.remove();
    }
  }
}
