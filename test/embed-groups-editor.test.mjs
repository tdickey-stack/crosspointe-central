import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const editorSource = fs.readFileSync(
    path.join(projectRoot, "public/embeds.js"),
    "utf8",
);
const editorHtml = fs.readFileSync(
    path.join(projectRoot, "public/embeds.html"),
    "utf8",
);
const labSource = fs.readFileSync(
    path.join(projectRoot, "public/embed-lab.js"),
    "utf8",
);
const labHtml = fs.readFileSync(
    path.join(projectRoot, "public/embed-lab.html"),
    "utf8",
);

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

test("embed creation chooses an immutable Events or Groups type", () => {
  const createBlock = functionBlock(editorSource, "createEmbed_", "renameEmbed_");
  assert.match(createBlock, /type: normalizeEmbedType_\(state\.createType\)/);
  assert.match(editorSource, /data-embeds-action=\\"set-create-type\\"/);
  assert.match(editorSource, /data-embed-type=\\"/);
  assert.match(editorSource, /function normalizeEmbedType_\(type\)[\s\S]*?type === "groups" \? "groups" : "events"/);
});

test("Groups drafts save only their type and selected theme", () => {
  const saveBlock = functionBlock(editorSource, "saveActiveEmbed_", "uploadEventImage_");
  assert.match(saveBlock, /type: type/);
  assert.match(saveBlock, /if \(type === "groups"\) \{[\s\S]*?payload\.theme = getEmbedTheme_\(embed\)/);
  assert.match(saveBlock, /else \{[\s\S]*?payload\.layout[\s\S]*?payload\.items/);
  assert.match(editorSource, /theme === "dark" \|\| theme === "responsive" \? theme : "light"/);
});

test("Groups editor exposes name and theme without manual content controls", () => {
  const groupsBlock = functionBlock(
      editorSource,
      "renderGroupsEditor_",
      "renderSavebar_",
  );
  assert.match(groupsBlock, /data-embed-name/);
  assert.match(groupsBlock, /renderThemePicker_\(embed\)/);
  assert.match(groupsBlock, /Groups stay connected to Planning Center/);
  assert.doesNotMatch(groupsBlock, /toggle-event|embed-image-input|Select events/);
  assert.match(editorSource, /The groups layout is always responsive/);
  assert.match(editorSource, /Responsive follows each visitor’s light or dark system preference/);
  assert.match(editorHtml, /events and groups/);
});

test("Groups copy and lab use the shared loader with a public fallback", () => {
  for (const source of [editorSource, labSource]) {
    assert.match(source, /https:\/\/crosspointetv\.churchcenter\.com\/groups/);
    assert.match(source, /\/embed\.css/);
    assert.match(source, /\/embed\.js/);
    assert.match(source, /Browse all CrossPointe groups/);
  }
  assert.doesNotMatch(labSource, /group-lab\.html/);
  assert.match(labSource, /getPayloadType_\(payload\)/);
  assert.match(labSource, /live \/api\/groups directory/);
  assert.match(labSource, /prefers-color-scheme: dark/);
  assert.match(labHtml, /data-lab-type-summary/);
  assert.match(labHtml, /data-lab-theme-summary/);
});

test("Embed Lab simulates Groups without borrowing the lab page heading", () => {
  assert.match(
      labHtml,
      /data-demo-id="embed_labgroupsresponsive"[\s\S]*?>Groups demo</,
  );
  assert.match(labHtml, /scrolling="auto"/);
  assert.match(
      labSource,
      /isGroups \? "Your website content" : "Upcoming at CrossPointe"/,
  );
  assert.doesNotMatch(labSource, /isGroups \? "Find your people\."/);
});

test("Embed Lab bounds Groups while Events keep measured auto-height", () => {
  const messageBlock = functionBlock(
      labSource,
      "handleFrameMessage_",
      "applyFrameMode_",
  );
  assert.match(
      messageBlock,
      /getPayloadType_\(state\.payload\) === "groups"[\s\S]*?frame\.style\.height = "720px";[\s\S]*?return;/,
  );
  assert.match(
      messageBlock,
      /Math\.min\(1800, Math\.max\(520, requestedHeight \+ 2\)\)/,
  );
});

test("Responsive Groups iframe follows the live system color scheme", () => {
  assert.match(
      labSource,
      /systemTheme\.addEventListener\("change", handleSystemThemeChange_\)/,
  );
  const prepareBlock = functionBlock(
      labSource,
      "prepareStaticHtml_",
      "handleSystemThemeChange_",
  );
  assert.match(
      prepareBlock,
      /getPayloadType_\(payload\) === "groups"[\s\S]*?payload\.theme === "responsive"/,
  );
  assert.match(
      prepareBlock,
      /systemTheme\.matches \? "dark" : "light"/,
  );
  assert.match(
      prepareBlock,
      /data-central-embed-theme=\(\['"\]\)responsive/,
  );
  const bootstrapBlock = functionBlock(
      labSource,
      "createPreviewThemeScript_",
      "handleSystemThemeChange_",
  );
  assert.match(bootstrapBlock, /new MutationObserver\(apply\)/);
  assert.match(
      bootstrapBlock,
      /data-central-embed-theme'[\s\S]*?===\s*'responsive'[\s\S]*?setAttribute/,
  );
  const changeBlock = functionBlock(
      labSource,
      "handleSystemThemeChange_",
      "updateLinks_",
  );
  assert.match(changeBlock, /updatePayloadSummary_\(\)/);
  assert.match(
      changeBlock,
      /state\.payload\.theme !== "responsive"\) return;/,
  );
  assert.match(
      changeBlock,
      /frame\.srcdoc = createHostDocument_\(state\.id, state\.staticHtml, state\.payload\)/,
  );
});
