import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {normalizePrintModePayload} from
  "../functions/print-mode/payload.js";

const source = fs.readFileSync(
    new URL("../public/admin.js", import.meta.url),
    "utf8",
);

function loadFunctions(names, globals = {}) {
  const context = vm.createContext(globals);
  for (const name of names) {
    const start = source.indexOf(`  function ${name}(`);
    assert.notEqual(start, -1, `Missing function ${name}`);
    const end = source.indexOf("\n  }", start);
    assert.notEqual(end, -1, `Missing end of function ${name}`);
    vm.runInContext(source.slice(start, end + 4), context);
  }
  return context;
}

function loadMarkdownRenderers(context) {
  const start = source.indexOf("  function renderAdminMarkdownLite_(value) {");
  const end = source.lastIndexOf("\n}());");
  assert.notEqual(start, -1, "Missing Markdown renderer");
  assert.notEqual(end, -1, "Missing admin module boundary");
  vm.runInContext(source.slice(start, end), context);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function placementContext(draft) {
  const adminState = {
    bulletinDraft: draft,
    bulletinError: "",
    bulletinMessage: "",
  };
  return loadFunctions([
    "normalizeBulletinLayout3_",
    "getBulletinLayout3_",
    "getBulletinLayout3Capacity_",
    "packBulletinLayout3Back_",
    "setBulletinLayout3Placement_",
  ], {
    adminState,
    getBulletinLayout3Entries_: (side) =>
      adminState.bulletinDraft.layout3.items.filter(
          (item) => item.side === side,
      ),
  });
}

function choiceContext(draft, initialStep = 3) {
  const adminState = {
    bulletinDraft: draft,
    bulletinError: "",
    bulletinMessage: "",
  };
  let step = initialStep;
  const context = loadFunctions([
    "normalizeBulletinLayout3_",
    "getBulletinLayout3_",
    "getBulletinLayout3Capacity_",
    "packBulletinLayout3Back_",
    "setBulletinLayout3Placement_",
    "updateBulletinChoice_",
  ], {
    adminState,
    getPrintModeStep_: () => step,
    getBulletinLayout3Entries_: (side) =>
      adminState.bulletinDraft.layout3.items.filter(
          (item) => item.side === side,
      ),
  });
  return {
    context,
    setStep(value) {
      step = value;
    },
  };
}

function choiceInput(type, id, checked) {
  return {
    checked,
    getAttribute(name) {
      if (name === "data-admin-bulletin-choice") return type;
      if (name === "data-admin-doc-id") return id;
      return "";
    },
  };
}

function fallbackSaveContext(adminState) {
  const effects = {
    dirty: [],
    transitions: [],
    renders: 0,
  };
  const context = loadFunctions([
    "createEmptyBulletinFallbackBlockDraft_",
    "normalizeBulletinBlockSize_",
    "normalizeBulletinFrontContentOrder_",
    "normalizeBulletinBackContentOrder_",
    "normalizeBulletinLayout3_",
    "getBulletinLayout3_",
    "getBulletinLayout3Capacity_",
    "packBulletinLayout3Back_",
    "saveBulletinFallbackBlock_",
  ], {
    PRINT_MODE_MAX_CUSTOM_BLOCKS: 8,
    adminState,
    Date: {now: () => 12345},
    getBulletinLayout_: () => "readable",
    getBulletinFallbackImageUrl_: (value) => String(value || ""),
    getBulletinLayout3Entries_: (side) =>
      adminState.bulletinDraft.layout3.items.filter(
          (item) => item.side === side,
      ),
    markAdminDirtyScope_: (scope) => effects.dirty.push(scope),
    requestBulletinPreviewLayoutTransition_: (...args) =>
      effects.transitions.push(args),
    renderAdmin_: () => {
      effects.renders += 1;
    },
  });
  return {context, effects};
}

function measureLayout3({
  regions = [],
  usage = {front: 0, back: 0},
  documentOverrides = {},
} = {}) {
  let removed = false;
  let appended = false;
  const holder = {
    style: {},
    innerHTML: "",
    setAttribute() {},
    querySelectorAll: () => regions,
    remove() {
      removed = true;
    },
  };
  const entries = Array.from(
      {length: usage.back},
      () => ({size: 1}),
  );
  const context = loadFunctions([
    "packBulletinLayout3Back_",
    "bulletinLayout3ContentOverflows_",
    "measureBulletinLayout3Fit_",
  ], {
    document: Object.assign({
      createElement: () => holder,
      createTreeWalker: () => ({nextNode: () => null}),
      createRange: () => ({
        selectNodeContents() {},
        getClientRects: () => [],
      }),
    }, documentOverrides),
    appEl: {appendChild(node) {
      assert.equal(node, holder);
      appended = true;
    }},
    renderBulletinPanel_: (side) => `<section>${side}</section>`,
    getBulletinLayout3Capacity_: () => usage,
    getBulletinLayout3Entries_: () => entries,
  });
  const result = context.measureBulletinLayout3Fit_();
  assert.equal(appended, true);
  assert.equal(removed, true);
  return result;
}

function layout3ContentOverflowContext({textRects = [], imageRects = []} = {}) {
  const textNodes = textRects.map((rects) => ({
    nodeValue: "Visible copy",
    rects,
  }));
  const images = imageRects.map((rect) => ({
    getBoundingClientRect: () => rect,
  }));
  const region = {
    clientTop: 2,
    clientHeight: 96,
    getBoundingClientRect: () => ({top: 100, bottom: 200}),
    querySelectorAll(selector) {
      assert.equal(selector, "img, svg, canvas");
      return images;
    },
  };
  const context = loadFunctions(["bulletinLayout3ContentOverflows_"], {
    document: {
      createTreeWalker(root, whatToShow) {
        assert.equal(root, region);
        assert.equal(whatToShow, 4);
        let index = 0;
        return {
          nextNode() {
            return textNodes[index++] || null;
          },
        };
      },
      createRange() {
        let selectedNode = null;
        return {
          selectNodeContents(node) {
            selectedNode = node;
          },
          getClientRects() {
            return selectedNode.rects;
          },
        };
      },
    },
  });
  return {context, region};
}

test("client and backend normalize Layout 3 keys and limits consistently", () => {
  const context = loadFunctions(["normalizeBulletinLayout3_"]);
  const validItems = Array.from({length: 250}, (_unused, index) => ({
    key: `campaign:campaign-${index + 1}`,
    side: index % 2 ? "back" : "front",
    size: index % 3 ? 1 : 2,
  }));
  const sourceLayout = {
    items: [
      null,
      {key: " campaign: padded-id ", side: "front", size: 2},
      {key: "campaign:padded-id", side: "back", size: 1},
      {key: "campaign:   ", side: "front", size: 2},
      {key: "event:event-1", side: "front", size: 2},
      {key: "serve:serve-1", side: "invalid", size: 7},
      ...validItems,
    ],
  };

  const client = plain(context.normalizeBulletinLayout3_(sourceLayout));
  const backend = normalizePrintModePayload({layout3: sourceLayout}).layout3;

  assert.deepEqual(client, backend);
  assert.equal(client.items.length, 250);
  assert.deepEqual(client.items.slice(0, 3), [
    {key: "campaign:padded-id", side: "front", size: 2},
    {key: "event:event-1", side: "back", size: 1},
    {key: "serve:serve-1", side: "off", size: 1},
  ]);
  assert.equal(context.normalizeBulletinLayout3_([]), null);
});

test("first use imports legacy selections without changing legacy fields", () => {
  const draft = {
    campaignIds: ["campaign-1", "campaign-2"],
    serveNeedIds: ["serve-1"],
    fallbackBlocks: [{
      id: "custom-1",
      size: 3,
      enabled: true,
      includeOnFront: false,
      includeOnBack: true,
    }],
    events: [
      {id: "event-1", included: true},
      {id: "event-2", included: false},
    ],
    layout3: null,
  };
  const legacyBefore = plain(draft);
  const context = loadFunctions([
    "normalizeBulletinLayout3_",
    "getBulletinLayout3_",
  ], {adminState: {bulletinDraft: draft}});

  assert.deepEqual(plain(context.getBulletinLayout3_().items), [
    {key: "campaign:campaign-1", side: "front", size: 1},
    {key: "campaign:campaign-2", side: "front", size: 1},
    {key: "serve:serve-1", side: "front", size: 1},
    {key: "custom:custom-1", side: "back", size: 2},
    {key: "event:event-1", side: "back", size: 1},
    {key: "event:event-2", side: "off", size: 1},
  ]);
  const after = plain(draft);
  delete after.layout3;
  delete legacyBefore.layout3;
  assert.deepEqual(after, legacyBefore);
});

test("Readable uses half-letter without overwriting the stored format", () => {
  const adminState = {
    bulletinDraft: {
      bulletinLayout: "classic",
      printFormat: "full-page",
      campaignIds: [],
      serveNeedIds: [],
      fallbackBlocks: [],
      events: [],
      layout3: null,
    },
    bulletinError: "",
    bulletinMessage: "",
  };
  const context = loadFunctions([
    "normalizeBulletinLayout3_",
    "getBulletinLayout3_",
    "getBulletinLayout_",
    "getBulletinPrintFormat_",
    "updateBulletinDraftField_",
  ], {
    adminState,
    getPrintModeStep_: () => 1,
  });

  context.updateBulletinDraftField_("bulletinLayout", "readable");
  assert.equal(adminState.bulletinDraft.printFormat, "full-page");
  assert.equal(context.getBulletinPrintFormat_(), "half-letter");
  context.updateBulletinDraftField_("printFormat", "half-letter");
  assert.equal(adminState.bulletinDraft.printFormat, "full-page");
  context.updateBulletinDraftField_("bulletinLayout", "classic");
  assert.equal(context.getBulletinPrintFormat_(), "full-page");
});

test("Layout 3 placement changes remain independent of legacy placement", () => {
  const draft = {
    campaignIds: ["campaign-1"],
    serveNeedIds: [],
    fallbackBlocks: [{
      id: "custom-1",
      size: 3,
      enabled: true,
      includeOnFront: true,
      includeOnBack: false,
    }],
    events: [{id: "event-1", included: false}],
    layout3: {
      items: [
        {key: "campaign:campaign-1", side: "front", size: 1},
        {key: "custom:custom-1", side: "back", size: 1},
        {key: "event:event-1", side: "off", size: 1},
      ],
    },
  };
  const legacyBefore = {
    campaignIds: plain(draft.campaignIds),
    fallbackBlocks: plain(draft.fallbackBlocks),
    events: plain(draft.events),
  };
  const context = placementContext(draft);

  assert.equal(
      context.setBulletinLayout3Placement_(
          "custom:custom-1",
          "size",
          2,
      ),
      true,
  );
  assert.equal(
      context.setBulletinLayout3Placement_(
          "event:event-1",
          "side",
          "front",
      ),
      true,
  );
  assert.deepEqual(plain(draft.layout3.items), [
    {key: "campaign:campaign-1", side: "front", size: 1},
    {key: "custom:custom-1", side: "back", size: 2},
    {key: "event:event-1", side: "back", size: 1},
  ]);
  assert.deepEqual({
    campaignIds: plain(draft.campaignIds),
    fallbackBlocks: plain(draft.fallbackBlocks),
    events: plain(draft.events),
  }, legacyBefore);
});

test("Layout 3 include checkboxes update only the arrangement", () => {
  const draft = {
    campaignIds: ["legacy-campaign"],
    serveNeedIds: ["legacy-serve"],
    fallbackBlocks: [{
      id: "custom-1",
      includeOnFront: true,
      includeOnBack: false,
      enabled: true,
    }],
    events: [{id: "event-1", included: false}],
    layout3: {items: [
      {key: "campaign:campaign-1", side: "off", size: 1},
      {key: "serve:serve-1", side: "off", size: 1},
      {key: "custom:custom-1", side: "off", size: 1},
      {key: "event:event-1", side: "off", size: 1},
    ]},
  };
  const legacyBefore = {
    campaignIds: plain(draft.campaignIds),
    serveNeedIds: plain(draft.serveNeedIds),
    fallbackBlocks: plain(draft.fallbackBlocks),
    events: plain(draft.events),
  };
  const {context, setStep} = choiceContext(draft);

  for (const [type, id, expectedSide] of [
    ["layout3-campaign", "campaign-1", "front"],
    ["layout3-event", "event-1", "back"],
  ]) {
    const include = choiceInput(type, id, true);
    assert.equal(context.updateBulletinChoice_(include), true);
    assert.equal(
        draft.layout3.items.find((item) => item.key.endsWith(id)).side,
        expectedSide,
    );
    const exclude = choiceInput(type, id, false);
    assert.equal(context.updateBulletinChoice_(exclude), true);
    assert.equal(
        draft.layout3.items.find((item) => item.key.endsWith(id)).side,
        "off",
    );
  }

  setStep(4);
  for (const [type, id] of [
    ["layout3-serve", "serve-1"],
    ["layout3-custom", "custom-1"],
  ]) {
    const include = choiceInput(type, id, true);
    assert.equal(context.updateBulletinChoice_(include), true);
    assert.equal(
        draft.layout3.items.find((item) => item.key.endsWith(id)).side,
        "back",
    );
    const exclude = choiceInput(type, id, false);
    assert.equal(context.updateBulletinChoice_(exclude), true);
    assert.equal(
        draft.layout3.items.find((item) => item.key.endsWith(id)).side,
        "off",
    );
  }

  assert.deepEqual({
    campaignIds: plain(draft.campaignIds),
    serveNeedIds: plain(draft.serveNeedIds),
    fallbackBlocks: plain(draft.fallbackBlocks),
    events: plain(draft.events),
  }, legacyBefore);
});

test("a rejected Layout 3 checkbox restores its checked state", () => {
  const draft = {
    campaignIds: ["legacy-campaign"],
    serveNeedIds: ["legacy-serve"],
    fallbackBlocks: [],
    events: [{id: "legacy-event", included: true}],
    layout3: {items: [
      {key: "campaign:front-1", side: "front", size: 1},
      {key: "campaign:front-2", side: "front", size: 1},
      {key: "campaign:new", side: "off", size: 1},
    ]},
  };
  const before = plain(draft);
  const {context} = choiceContext(draft);
  const input = choiceInput("layout3-campaign", "new", true);

  assert.equal(context.updateBulletinChoice_(input), false);
  assert.equal(input.checked, false);
  assert.deepEqual(plain(draft), before);
  assert.match(context.adminState.bulletinError, /front is full/);
});

test("front and back capacity failures roll placement moves back", () => {
  const draft = {
    layout3: {items: [
      {key: "campaign:f1", side: "front", size: 1},
      {key: "campaign:f2", side: "front", size: 1},
      ...Array.from({length: 6}, (_unused, index) => ({
        key: `campaign:b${index + 1}`,
        side: "back",
        size: 1,
      })),
    ]},
  };
  const context = placementContext(draft);
  const before = plain(draft.layout3.items);

  assert.equal(
      context.setBulletinLayout3Placement_("campaign:b1", "side", "front"),
      false,
  );
  assert.deepEqual(plain(draft.layout3.items), before);
  assert.match(context.adminState.bulletinError, /front is full/);

  assert.equal(
      context.setBulletinLayout3Placement_("campaign:f1", "side", "back"),
      false,
  );
  assert.deepEqual(plain(draft.layout3.items), before);
  assert.match(context.adminState.bulletinError, /back is full/);
});

test("Large uses two slots, events use one, and back packing is exact", () => {
  const context = loadFunctions([
    "normalizeBulletinLayout3_",
    "packBulletinLayout3Back_",
  ]);
  const normalized = plain(context.normalizeBulletinLayout3_({items: [
    {key: "custom:large", side: "back", size: 2},
    {key: "event:event-1", side: "front", size: 2},
  ]}));

  assert.deepEqual(normalized.items, [
    {key: "custom:large", side: "back", size: 2},
    {key: "event:event-1", side: "back", size: 1},
  ]);
  assert.equal(
      context.packBulletinLayout3Back_(
          Array.from({length: 6}, () => ({size: 1})),
      ).length,
      6,
  );
  assert.equal(
      context.packBulletinLayout3Back_([
        {size: 2}, {size: 2}, {size: 1}, {size: 1},
      ]).length,
      4,
  );
  assert.equal(
      context.packBulletinLayout3Back_([
        {size: 2}, {size: 2}, {size: 2},
      ]),
      null,
  );
});

test("back order moves preserve the packed visual order", () => {
  const adminState = {
    bulletinDraft: {layout3: {items: [
      {key: "custom:large-1", side: "back", size: 2},
      {key: "custom:large-2", side: "back", size: 2},
      {key: "custom:standard-1", side: "back", size: 1},
      {key: "custom:standard-2", side: "back", size: 1},
    ]}},
    bulletinError: "",
  };
  const dirty = [];
  const context = loadFunctions([
    "normalizeBulletinLayout3_",
    "getBulletinLayout3_",
    "packBulletinLayout3Back_",
    "getBulletinLayout3DisplayEntries_",
    "moveBulletinLayout3Item_",
  ], {
    adminState,
    getBulletinLayout3Entries_: (side) =>
      adminState.bulletinDraft.layout3.items.filter(
          (item) => item.side === side,
      ),
    markAdminDirtyScope_: (scope) => dirty.push(scope),
  });
  const displayKeys = () => plain(
      context.getBulletinLayout3DisplayEntries_("back"),
  ).map((item) => item.key);
  const original = plain(adminState.bulletinDraft.layout3.items);

  assert.deepEqual(displayKeys(), [
    "custom:large-1",
    "custom:standard-1",
    "custom:large-2",
    "custom:standard-2",
  ]);

  context.moveBulletinLayout3Item_("custom:large-2", "up");
  assert.deepEqual(plain(adminState.bulletinDraft.layout3.items), original);
  assert.deepEqual(displayKeys(), [
    "custom:large-1",
    "custom:standard-1",
    "custom:large-2",
    "custom:standard-2",
  ]);
  assert.match(adminState.bulletinError, /gap too small for a Large block/);
  assert.deepEqual(dirty, []);

  context.moveBulletinLayout3Item_("custom:large-1", "down");
  assert.deepEqual(
      plain(adminState.bulletinDraft.layout3.items).map((item) => item.key),
      [
        "custom:standard-1",
        "custom:large-1",
        "custom:large-2",
        "custom:standard-2",
      ],
  );
  assert.deepEqual(displayKeys(), [
    "custom:standard-1",
    "custom:large-1",
    "custom:large-2",
    "custom:standard-2",
  ]);
  assert.equal(adminState.bulletinError, "");
  assert.deepEqual(dirty, ["bulletin"]);
});

test("over-capacity imports stay editable and can be reduced", () => {
  const draft = {
    layout3: {items: [
      {key: "campaign:one", side: "front", size: 2},
      {key: "campaign:two", side: "front", size: 2},
      {key: "campaign:three", side: "front", size: 2},
    ]},
  };
  const context = placementContext(draft);

  assert.equal(context.getBulletinLayout3_().items.length, 3);
  assert.equal(context.getBulletinLayout3Capacity_().front, 6);
  assert.equal(
      context.setBulletinLayout3Placement_(
          "campaign:one",
          "side",
          "off",
      ),
      true,
  );
  assert.equal(context.getBulletinLayout3Capacity_().front, 4);
  assert.equal(
      context.setBulletinLayout3Placement_(
          "campaign:two",
          "size",
          1,
      ),
      true,
  );
  assert.equal(context.getBulletinLayout3Capacity_().front, 3);
});

test("saving an existing Layout 3 block preserves legacy size and placement", () => {
  const originalBlock = {
    id: "custom-1",
    eyebrow: "Before",
    title: "Original",
    description: "Original copy",
    imageUrl: "",
    imageStoragePath: "",
    imageSide: "right",
    size: 1,
    includeOnFront: true,
    includeOnBack: false,
    enabled: true,
  };
  const adminState = {
    bulletinDraft: {
      fallbackBlocks: [originalBlock],
      frontContentOrder: ["custom:custom-1", "campaigns", "serveNeeds"],
      backContentOrder: ["custom:custom-1"],
      layout3: {items: [
        {key: "campaign:front", side: "front", size: 1},
        {key: "custom:custom-1", side: "back", size: 1},
      ]},
    },
    bulletinFallbackBlockEditingId: "custom-1",
    bulletinFallbackBlockEditorOpen: true,
    bulletinFallbackBlockDraft: {
      eyebrow: "After",
      title: "Updated",
      description: "Updated copy",
      imageUrl: "https://example.test/image.png",
      imageStoragePath: "bulletin-mode/fallback-images/custom.png",
      imageSide: "left",
      size: 3,
      includeOnFront: false,
      includeOnBack: true,
      layout3Side: "back",
    },
    bulletinError: "",
    bulletinMessage: "",
  };
  const {context, effects} = fallbackSaveContext(adminState);

  context.saveBulletinFallbackBlock_();

  const saved = adminState.bulletinDraft.fallbackBlocks[0];
  assert.equal(saved.title, "Updated");
  assert.equal(saved.description, "Updated copy");
  assert.equal(saved.size, 1);
  assert.equal(saved.includeOnFront, true);
  assert.equal(saved.includeOnBack, false);
  assert.equal(saved.enabled, true);
  assert.deepEqual(plain(adminState.bulletinDraft.layout3.items), [
    {key: "campaign:front", side: "front", size: 1},
    {key: "custom:custom-1", side: "back", size: 2},
  ]);
  assert.deepEqual(effects.dirty, ["bulletin"]);
  assert.deepEqual(effects.transitions, [["custom:custom-1", "resize"]]);
  assert.equal(adminState.bulletinFallbackBlockEditorOpen, false);
});

test("saving a new Layout 3 block leaves its legacy selection off", () => {
  const adminState = {
    bulletinDraft: {
      fallbackBlocks: [],
      frontContentOrder: ["campaigns", "serveNeeds"],
      backContentOrder: [],
      layout3: {items: []},
    },
    bulletinFallbackBlockEditingId: "",
    bulletinFallbackBlockEditorOpen: true,
    bulletinFallbackBlockDraft: {
      eyebrow: "New",
      title: "New block",
      description: "New copy",
      imageUrl: "",
      imageStoragePath: "",
      imageSide: "right",
      size: 3,
      includeOnFront: true,
      includeOnBack: true,
      layout3Side: "back",
    },
    bulletinError: "",
    bulletinMessage: "",
  };
  const {context, effects} = fallbackSaveContext(adminState);

  context.saveBulletinFallbackBlock_();

  assert.deepEqual(plain(adminState.bulletinDraft.fallbackBlocks), [{
    id: "fallback-9ix",
    eyebrow: "New",
    title: "New block",
    description: "New copy",
    imageUrl: "",
    imageStoragePath: "",
    imageSide: "right",
    size: 2,
    includeOnFront: false,
    includeOnBack: false,
    enabled: false,
  }]);
  assert.deepEqual(plain(adminState.bulletinDraft.layout3.items), [{
    key: "custom:fallback-9ix",
    side: "back",
    size: 2,
  }]);
  assert.deepEqual(effects.dirty, ["bulletin"]);
});

test("an invalid Layout 3 block move rolls back block and arrangement", () => {
  const originalBlock = {
    id: "custom-1",
    eyebrow: "Before",
    title: "Original",
    description: "Original copy",
    imageUrl: "",
    imageStoragePath: "",
    imageSide: "right",
    size: 1,
    includeOnFront: false,
    includeOnBack: true,
    enabled: true,
  };
  const originalItems = [
    {key: "campaign:front-1", side: "front", size: 1},
    {key: "campaign:front-2", side: "front", size: 1},
    {key: "custom:custom-1", side: "back", size: 1},
  ];
  const adminState = {
    bulletinDraft: {
      fallbackBlocks: [originalBlock],
      frontContentOrder: ["custom:custom-1", "campaigns", "serveNeeds"],
      backContentOrder: ["custom:custom-1"],
      layout3: {items: plain(originalItems)},
    },
    bulletinFallbackBlockEditingId: "custom-1",
    bulletinFallbackBlockEditorOpen: true,
    bulletinFallbackBlockDraft: {
      eyebrow: "Changed",
      title: "Changed title",
      description: "Changed copy",
      imageUrl: "",
      imageStoragePath: "",
      imageSide: "right",
      size: 3,
      includeOnFront: true,
      includeOnBack: false,
      layout3Side: "front",
    },
    bulletinError: "",
    bulletinMessage: "",
  };
  const {context, effects} = fallbackSaveContext(adminState);

  context.saveBulletinFallbackBlock_();

  assert.deepEqual(plain(adminState.bulletinDraft.fallbackBlocks), [
    originalBlock,
  ]);
  assert.deepEqual(plain(adminState.bulletinDraft.layout3.items), originalItems);
  assert.match(adminState.bulletinError, /Not enough slots on the front/);
  assert.equal(adminState.bulletinFallbackBlockEditorOpen, true);
  assert.deepEqual(effects.dirty, []);
  assert.deepEqual(effects.transitions, []);
  assert.equal(effects.renders, 1);
});

test("Layout 3 fit measurement catches back overflow without false positives", () => {
  const exactRegion = {
    scrollHeight: 100,
    clientHeight: 100,
    scrollWidth: 200,
    clientWidth: 200,
    closest: () => null,
    getAttribute: () => "Exact region",
  };
  const exact = measureLayout3({
    regions: [exactRegion],
    usage: {front: 2, back: 6},
  });
  assert.equal(exact.fits, true);
  assert.equal(exact.overflow, 0);

  const overflowingBackRegion = {
    scrollHeight: 103,
    clientHeight: 100,
    scrollWidth: 200,
    clientWidth: 200,
    closest: () => ({}),
    getAttribute: () => "Event card",
    clientTop: 0,
    getBoundingClientRect: () => ({top: 0, bottom: 100}),
    querySelectorAll: () => [],
  };
  const overflow = measureLayout3({regions: [overflowingBackRegion]});
  assert.equal(overflow.fits, false);
  assert.equal(overflow.overflow, 1);
  assert.match(overflow.message, /Back: Event card/);
});

test("Layout 3 ignores clipped trailing card and hero padding when content fits", () => {
  for (const [name, scrollHeight, clientHeight, contentBottom] of [
    ["hero", 245, 239, 333],
    ["card", 198, 192, 287],
  ]) {
    const {context, region} = layout3ContentOverflowContext({
      textRects: [[{
        top: 120,
        bottom: contentBottom,
        width: 100,
        height: contentBottom - 120,
      }]],
    });
    region.clientHeight = clientHeight;
    assert.equal(
        context.bulletinLayout3ContentOverflows_(region),
        false,
        `${name} content should fit despite ${scrollHeight - clientHeight}px of trailing padding`,
    );
  }
});

test("Layout 3 preflight permits a region whose only scroll overflow is padding", () => {
  const textNode = {nodeValue: "Visible copy", rects: [{
    top: 120,
    bottom: 287,
    width: 100,
    height: 167,
  }]};
  const region = {
    scrollHeight: 198,
    clientHeight: 192,
    scrollWidth: 200,
    clientWidth: 200,
    clientTop: 2,
    closest: () => null,
    getAttribute: () => "Padded card",
    getBoundingClientRect: () => ({top: 100, bottom: 292}),
    querySelectorAll: () => [],
  };
  const result = measureLayout3({
    regions: [region],
    documentOverrides: {
      createTreeWalker: () => {
        let used = false;
        return {nextNode: () => (used ? null : (used = true, textNode))};
      },
      createRange: () => ({
        selectNodeContents() {},
        getClientRects: () => textNode.rects,
      }),
    },
  });
  assert.equal(result.fits, true);
});

test("Layout 3 blocks text or image content clipped beyond a region", () => {
  const text = layout3ContentOverflowContext({
    textRects: [[{top: 120, bottom: 201, width: 100, height: 81}]],
  });
  assert.equal(text.context.bulletinLayout3ContentOverflows_(text.region), true);

  const image = layout3ContentOverflowContext({
    imageRects: [{top: 120, bottom: 201, width: 100, height: 81}],
  });
  assert.equal(image.context.bulletinLayout3ContentOverflows_(image.region), true);
});

test("Layout 3 treats unmeasurable vertical overflow as unsafe", () => {
  const {context, region} = layout3ContentOverflowContext();
  assert.equal(context.bulletinLayout3ContentOverflows_(region), true);
});

test("Layout 3 retains the strict horizontal overflow check", () => {
  const region = {
    scrollHeight: 100,
    clientHeight: 100,
    scrollWidth: 203,
    clientWidth: 200,
    closest: () => null,
    getAttribute: () => "Wide title",
  };
  const result = measureLayout3({regions: [region]});
  assert.equal(result.fits, false);
  assert.match(result.message, /Front: Wide title/);
});

test("Readable events retain the familiar checked and disabled card UI", () => {
  const event = {
    id: "event-1",
    date: "September 20",
    time: "9:00 AM",
    location: "Auditorium",
    title: "Sunday Event",
    description: "Event details",
    included: false,
  };
  const context = loadFunctions([
    "escapeHtml_",
    "escapeAttr_",
    "renderBulletinChoice_",
    "renderBulletinEventEditor_",
    "renderBulletinLayout3Events_",
  ], {
    adminState: {bulletinEventFilter: "all"},
    getBulletinLayout3Entries_: () => [{key: "event:event-1"}],
    getBulletinEventDraftsInWindow_: () => [event],
    getFilteredBulletinEventDrafts_: (events) => events,
    getBulletinEventWeekCounts_: () => [0, 0, 0, 1],
  });
  const html = context.renderBulletinLayout3Events_(false, []);

  assert.match(html, /class="central-admin-bulletin-event-editor"/);
  assert.match(
      html,
      /data-admin-bulletin-choice="layout3-event"[^>]*checked[^>]*disabled/,
  );
  assert.match(html, /central-admin-bulletin-event-schedule/);
  assert.match(html, /central-admin-bulletin-event-copy/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /data-admin-action="set-bulletin-layout3"/);
});

test("Layout 3 flexible rows use checkboxes and selected-only segments", () => {
  const renderRow = (type, selected) => {
    const item = {
      id: `${type}-1`,
      title: `${type} title`,
      need: type === "serve" ? "Serve title" : undefined,
      ministry: type === "serve" ? "Kids" : undefined,
      imageUrl: "",
    };
    const key = `${type}:${item.id}`;
    const context = loadFunctions([
      "escapeHtml_",
      "escapeAttr_",
      "formatBulletinServeMinistryLabel_",
      "renderBulletinLayout3Segments_",
      "renderBulletinLayout3EditorRow_",
    ], {
      getBulletinLayout3_: () => ({items: [{
        key,
        side: selected ? "front" : "off",
        size: 2,
      }]}),
      getBulletinFallbackImageUrl_: () => "",
    });
    return context.renderBulletinLayout3EditorRow_({
      key,
      type,
      item,
    }, true);
  };

  for (const type of ["campaign", "serve", "custom"]) {
    const selected = renderRow(type, true);
    assert.match(
        selected,
        new RegExp(`data-admin-bulletin-choice="layout3-${type}"[^>]*checked`),
    );
    assert.match(selected, /class="[^\"]*b3-choice[^\"]*is-selected/);
    assert.match(selected, /data-admin-action="set-bulletin-layout3"/);
    assert.match(selected, /aria-label="Placement"/);
    assert.match(selected, /aria-label="Size"/);
    assert.doesNotMatch(selected, /<select/);

    const unselected = renderRow(type, false);
    assert.match(
        unselected,
        new RegExp(`data-admin-bulletin-choice="layout3-${type}"`),
    );
    assert.doesNotMatch(unselected, /data-admin-action="set-bulletin-layout3"/);
    assert.doesNotMatch(unselected, /<select/);
  }
});

test("Layout 3 cards render full escaped Markdown and event metadata", () => {
  const context = loadFunctions([
    "escapeHtml_",
    "escapeAttr_",
    "renderBulletinLayout3Meta_",
    "renderBulletinLayout3Card_",
  ], {
    formatBulletinLongDate_: () => "Sunday <September 20>",
    getBulletinFallbackImageUrl_: () => "",
  });
  loadMarkdownRenderers(context);
  const ending = "FINAL-MARKER-<unsafe>";
  const description = [
    "# **Welcome**",
    "",
    "Read *everything* safely.",
    "x".repeat(1800) + ending,
  ].join("\n");
  const html = context.renderBulletinLayout3Card_({
    key: "event:event-1",
    type: "event",
    size: 1,
    item: {
      title: "<script>Event</script>",
      date: "2026-09-20",
      time: "9:00 < 10:00",
      location: "Room & Hall",
      doors_open_time: "8:30 < early",
      description,
      includeDescription: true,
    },
  });

  assert.match(html, /&lt;script&gt;Event&lt;\/script&gt;/);
  assert.match(html, /Sunday &lt;September 20&gt;/);
  assert.match(html, /9:00 &lt; 10:00/);
  assert.match(html, /Room &amp; Hall/);
  assert.match(html, /Doors open 8:30 &lt; early/);
  assert.match(
      html,
      /<h3 class="whats-new-heading level-1"><strong>Welcome<\/strong><\/h3>/,
  );
  assert.match(html, /Read <em>everything<\/em> safely\./);
  assert.match(html, /FINAL-MARKER-&lt;unsafe&gt;/);
  assert.equal(html.includes(ending), false);
});


test("saving Layout 3 prunes old weeks before the cap without changing live draft", () => {
  const oldItems = Array.from({length: 260}, (_, i) => ({key: `event:old-${i}`, side: "off", size: 1}));
  const draft = {
    fallbackBlocks: [{id: "current-block"}],
    layout3: {items: oldItems.concat([
      {key: "event:current", side: "back", size: 1},
      {key: "custom:deleted", side: "front", size: 1},
      {key: "custom:current-block", side: "front", size: 2},
      {key: "campaign:retained", side: "off", size: 1},
    ])},
  };
  const snapshot = JSON.stringify(draft);
  const context = loadFunctions(["normalizeBulletinLayout3_", "getBulletinLayout3ForSave_"], {
    adminState: {bulletinDraft: draft},
    getBulletinEventDraftsInWindow_: () => [{id: "current"}],
  });
  assert.deepEqual(plain(context.getBulletinLayout3ForSave_()), {items: [
    {key: "event:current", side: "back", size: 1},
    {key: "custom:current-block", side: "front", size: 2},
    {key: "campaign:retained", side: "off", size: 1},
  ]});
  assert.equal(JSON.stringify(draft), snapshot);
  draft.layout3 = null;
  assert.equal(context.getBulletinLayout3ForSave_(), null);
});
