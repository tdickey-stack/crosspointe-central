function inlineTokens(value) {
  const source = String(value || "");
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/gu;
  return source.split(pattern).filter((part) => part !== "").map((part) => {
    if (/^`[^`\n]+`$/u.test(part)) return {type: "code", text: part.slice(1, -1)};
    if (/^\*\*[^*\n]+\*\*$/u.test(part) || /^__[^_\n]+__$/u.test(part)) {
      return {type: "strong", text: part.slice(2, -2)};
    }
    if (/^\*[^*\n]+\*$/u.test(part) || /^_[^_\n]+_$/u.test(part)) {
      return {type: "emphasis", text: part.slice(1, -1)};
    }
    return {type: "text", text: part};
  });
}

export function parseBriefMarkdown(value) {
  const normalized = String(value || "").replace(/\r\n/gu, "\n").trim();
  if (!normalized) return [];
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({type: "paragraph", lines: paragraph.map(inlineTokens)});
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  normalized.split("\n").forEach((rawLine) => {
    const trimmed = String(rawLine || "").trim();
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/u);
    const listItem = String(rawLine || "").match(/^\s*([-*]|\d+\.)\s+(.*)$/u);
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({type: "heading", level: heading[1].length, content: inlineTokens(heading[2])});
      return;
    }
    if (listItem) {
      flushParagraph();
      const type = /^\d+\.$/u.test(listItem[1]) ? "ordered-list" : "unordered-list";
      if (!list || list.type !== type) {
        flushList();
        list = {type, items: []};
      }
      list.items.push(inlineTokens(listItem[2]));
      return;
    }
    flushList();
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  return blocks;
}

export function briefMarkdownToPlainText(value) {
  return parseBriefMarkdown(value).map((block) => {
    const text = (tokens) => tokens.map((token) => token.text).join("");
    if (block.type === "heading") return text(block.content);
    if (block.type === "paragraph") return block.lines.map(text).join("\n");
    return block.items.map((item, index) =>
      `${block.type === "ordered-list" ? `${index + 1}.` : "-"} ${text(item)}`,
    ).join("\n");
  }).join("\n\n");
}

