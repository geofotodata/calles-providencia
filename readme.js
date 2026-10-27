// Small, text-only Markdown renderer for the project's README. Raw HTML is never executed.
function renderReadme(markdown, target) {
  function inline(text, parent) {
    const pattern = /(`[^`]+`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(cursor, match.index)));
      let element;
      if (match[2]) {
        element = document.createElement('a');
        const url = new URL(match[3], document.baseURI);
        if (['https:', 'http:'].includes(url.protocol)) {
          element.href = url.href;
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
        }
        inline(match[2], element);
      } else {
        element = document.createElement(match[0][0] === '`' ? 'code' : match[4] ? 'strong' : 'em');
        element.textContent = match[4] || match[5] || match[0].slice(1, -1);
      }
      parent.append(element);
      cursor = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(cursor)));
  }
  const fragment = document.createDocumentFragment();
  const lists = [];
  let paragraph = null;
  let code = null;
  for (const line of markdown.replace(/\r/g, '').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (code) { code = null; } else {
        const pre = document.createElement('pre');
        code = document.createElement('code');
        pre.append(code);
        fragment.append(pre);
      }
      paragraph = null;
      continue;
    }
    if (code) { code.append(document.createTextNode(line + '\n')); continue; }
    if (!trimmed) { paragraph = null; continue; }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    const item = line.match(/^(\s*)(?:[*-]|\d+\.)\s+(.+)$/);
    if (item) {
      paragraph = null;
      const depth = item[1].length;
      const tag = /^\d/.test(trimmed) ? 'ol' : 'ul';
      while (lists.length && lists.at(-1).depth > depth) lists.pop();
      if (lists.length && lists.at(-1).depth === depth && lists.at(-1).element.tagName.toLowerCase() !== tag) lists.pop();
      if (!lists.length || lists.at(-1).depth < depth) {
        const element = document.createElement(tag);
        (lists.length ? lists.at(-1).element.lastElementChild : fragment).append(element);
        lists.push({ depth, element });
      }
      const li = document.createElement('li');
      inline(item[2], li);
      lists.at(-1).element.append(li);
      continue;
    }
    lists.length = 0;
    if (heading || /^---+$/.test(trimmed) || trimmed.startsWith('> ')) {
      paragraph = null;
      const element = document.createElement(heading ? `h${Math.min(heading[1].length + 1, 6)}` : trimmed.startsWith('> ') ? 'blockquote' : 'hr');
      if (heading) inline(heading[2], element);
      else if (trimmed.startsWith('> ')) inline(trimmed.slice(2), element);
      fragment.append(element);
      continue;
    }
    if (!paragraph) {
      paragraph = document.createElement('p');
      fragment.append(paragraph);
    } else paragraph.append(document.createTextNode(' '));
    inline(trimmed, paragraph);
  }
  // Present the complete README as an introduction and expandable sections.
  const layout = document.createDocumentFragment();
  let section = document.createElement('div');
  section.className = 'about-intro';
  layout.append(section);
  for (const node of [...fragment.childNodes]) {
    if (node.nodeName === 'HR') continue;
    if (node.nodeName === 'H3') {
      const details = document.createElement('details');
      details.className = 'about-section';
      const summary = document.createElement('summary');
      summary.textContent = node.textContent;
      details.append(summary);
      section = document.createElement('div');
      section.className = 'about-section-body';
      details.append(section);
      layout.append(details);
    } else section.append(node);
  }
  target.replaceChildren(layout);
}
