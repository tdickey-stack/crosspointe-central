import React, {useEffect, useState} from "react";
import {focalMediaStyle, normalizeImageOpacity} from "./focal.js";
import {
  getBrandColor,
  getEventPalette,
  getEventFont,
  getTemplateById,
  isDocumentProject,
  normalizeEventComposition,
  textToLines,
} from "./templates.js";

function BrandMark({inverse = false}) {
  return (
    <div className={`studio-preview-brand${inverse ? " is-inverse" : ""}`}>
      <img src="/favicon.svg" alt="" />
      <span>CROSSPOINTE</span>
    </div>
  );
}

function hasText(value) {
  return Boolean(String(value || "").trim());
}

function visibleItems(items) {
  return (Array.isArray(items) ? items : []).filter(hasText);
}

const CHECKLIST_DENSITY_CLASSES = [
  "",
  "is-density-compact",
  "is-density-tight",
  "is-density-maximum",
];
const trimmedLogoSourceCache = new Map();

function transparentPixelBounds(pixelData, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixelData[(y * width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function loadLogoImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/iu.test(source)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Studio could not inspect that logo."));
    image.src = source;
  });
}

async function trimTransparentLogoSource(source) {
  if (!source) return "";
  if (trimmedLogoSourceCache.has(source)) {
    return trimmedLogoSourceCache.get(source);
  }

  const cropPromise = (async () => {
    try {
      const image = await loadLogoImage(source);
      const scanScale = Math.min(
        1,
        2048 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const scanWidth = Math.max(1, Math.round(image.naturalWidth * scanScale));
      const scanHeight = Math.max(1, Math.round(image.naturalHeight * scanScale));
      const scanCanvas = document.createElement("canvas");
      scanCanvas.width = scanWidth;
      scanCanvas.height = scanHeight;
      const scanContext = scanCanvas.getContext("2d", {
        alpha: true,
        willReadFrequently: true,
      });
      if (!scanContext) return source;
      scanContext.drawImage(image, 0, 0, scanWidth, scanHeight);
      const pixels = scanContext.getImageData(0, 0, scanWidth, scanHeight);
      const bounds = transparentPixelBounds(
        pixels.data,
        scanWidth,
        scanHeight,
      );
      if (!bounds) return source;

      const fillsCanvas =
        bounds.x <= 1 &&
        bounds.y <= 1 &&
        bounds.x + bounds.width >= scanWidth - 1 &&
        bounds.y + bounds.height >= scanHeight - 1;
      if (fillsCanvas) return source;

      const padding = Math.max(
        2,
        Math.round(Math.max(bounds.width, bounds.height) * 0.015),
      );
      const paddedLeft = Math.max(0, bounds.x - padding);
      const paddedTop = Math.max(0, bounds.y - padding);
      const paddedRight = Math.min(
        scanWidth,
        bounds.x + bounds.width + padding,
      );
      const paddedBottom = Math.min(
        scanHeight,
        bounds.y + bounds.height + padding,
      );
      const sourceX = Math.floor(paddedLeft / scanScale);
      const sourceY = Math.floor(paddedTop / scanScale);
      const sourceWidth = Math.min(
        image.naturalWidth - sourceX,
        Math.ceil((paddedRight - paddedLeft) / scanScale),
      );
      const sourceHeight = Math.min(
        image.naturalHeight - sourceY,
        Math.ceil((paddedBottom - paddedTop) / scanScale),
      );
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = sourceWidth;
      outputCanvas.height = sourceHeight;
      const outputContext = outputCanvas.getContext("2d", {alpha: true});
      if (!outputContext) return source;
      outputContext.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      );
      return outputCanvas.toDataURL("image/png");
    } catch (error) {
      return source;
    }
  })();

  trimmedLogoSourceCache.set(source, cropPromise);
  return cropPromise;
}

function EventHeroLogo({source, name}) {
  const [renderedSource, setRenderedSource] = useState(source);

  useEffect(() => {
    let isCurrent = true;
    setRenderedSource(source);
    trimTransparentLogoSource(source).then((trimmedSource) => {
      if (isCurrent) setRenderedSource(trimmedSource || source);
    });
    return () => {
      isCurrent = false;
    };
  }, [source]);

  return (
    <img
      className="event-hero-logo"
      src={renderedSource}
      alt={name || "Event logo"}
    />
  );
}

function checklistContentOverflows(section, list) {
  if (!section || !list) return false;
  const sectionRect = section.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const paddingBottom =
    Number.parseFloat(window.getComputedStyle(section).paddingBottom) || 0;
  return listRect.bottom > sectionRect.bottom - paddingBottom + 0.5;
}

function ListBlock({label, title, items}) {
  const filteredItems = visibleItems(items);
  if (!hasText(label) && !hasText(title) && !filteredItems.length) return null;
  return (
    <section className="policy-card policy-list-card">
      {hasText(label) ? <span className="policy-card-label">{label}</span> : null}
      {hasText(title) ? <h3>{title}</h3> : null}
      {filteredItems.length ? (
        <ul>
          {filteredItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DocumentPageNumber({pageNumber, pageCount, showPageNumbers = true}) {
  if (!showPageNumbers || !pageNumber || !pageCount) return null;
  return (
    <span className="document-page-number">
      {pageNumber} / {pageCount}
    </span>
  );
}

function DocumentFooter({
  content,
  pageNumber,
  pageCount,
  showPageNumbers,
}) {
  const showNumber = Boolean(
    showPageNumbers && pageNumber && pageCount,
  );
  if (
    !hasText(content.footerNote) &&
    !hasText(content.footerReference) &&
    !showNumber
  ) {
    return null;
  }
  return (
    <footer className="document-standard-footer">
      {hasText(content.footerNote) ? <span>{content.footerNote}</span> : null}
      {hasText(content.footerReference) ? (
        <strong>{content.footerReference}</strong>
      ) : null}
      <DocumentPageNumber
        pageNumber={pageNumber}
        pageCount={pageCount}
        showPageNumbers={showPageNumbers}
      />
    </footer>
  );
}

function DocumentHeader({content}) {
  const hasMeta = hasText(content.eyebrow) || hasText(content.audience);
  const hasTitle =
    hasText(content.documentNumber) ||
    hasText(content.title) ||
    hasText(content.subtitle);
  if (!hasMeta && !hasTitle) return null;
  return (
    <header className="document-standard-hero">
      {hasMeta ? (
        <div className="policy-meta-row">
          {hasText(content.eyebrow) ? (
            <span className="policy-meta-pill">{content.eyebrow}</span>
          ) : null}
          {hasText(content.audience) ? (
            <span className="policy-meta-pill is-accent">
              {content.audience}
            </span>
          ) : null}
        </div>
      ) : null}
      {hasTitle ? (
        <div className="document-standard-title">
          {hasText(content.documentNumber) ? (
            <p>{content.documentNumber}</p>
          ) : null}
          {hasText(content.title) ? <h2>{content.title}</h2> : null}
          {hasText(content.subtitle) ? <span>{content.subtitle}</span> : null}
        </div>
      ) : null}
    </header>
  );
}

export function PolicyPreview({
  content,
  previewRef,
  pageNumber,
  pageCount,
  showPageNumbers = true,
}) {
  const primaryItems = visibleItems(content.primaryItems);
  const secondaryItems = visibleItems(content.secondaryItems);
  const ownerItems = visibleItems(content.ownerItems);
  const processSteps = visibleItems(content.processSteps);
  const showOperatingRule =
    hasText(content.operatingRuleLabel) || hasText(content.operatingRule);
  const showPrimary =
    hasText(content.primarySectionLabel) ||
    hasText(content.primarySectionTitle) ||
    primaryItems.length > 0;
  const showSecondary =
    hasText(content.secondarySectionLabel) ||
    hasText(content.secondarySectionTitle) ||
    secondaryItems.length > 0;
  const listSectionCount = Number(showPrimary) + Number(showSecondary);
  const showOwner =
    hasText(content.ownerLabel) ||
    hasText(content.ownerTitle) ||
    ownerItems.length > 0;
  const showFooter =
    hasText(content.processLabel) ||
    processSteps.length > 0 ||
    hasText(content.footerNote) ||
    hasText(content.footerReference) ||
    Boolean(showPageNumbers && pageNumber && pageCount);

  return (
    <article ref={previewRef} className="studio-policy-document">
      <header className="policy-hero">
        <div className="policy-meta-row">
          <span className="policy-meta-pill">{content.eyebrow}</span>
          <span className="policy-meta-pill is-accent">{content.audience}</span>
        </div>
        <div className="policy-title-block">
          <p>{content.documentNumber}</p>
          <h2>{content.title}</h2>
          <span>{content.subtitle}</span>
        </div>
      </header>

      <div className="policy-body">
        {showOperatingRule ? (
          <section className="policy-card policy-operating-rule">
            {hasText(content.operatingRuleLabel) ? (
              <span className="policy-card-label">
                {content.operatingRuleLabel}
              </span>
            ) : null}
            {hasText(content.operatingRule) ? (
              <p>{content.operatingRule}</p>
            ) : null}
          </section>
        ) : null}

        {listSectionCount ? (
          <div className={`policy-two-column is-count-${listSectionCount}`}>
            {showPrimary ? (
              <ListBlock
                label={content.primarySectionLabel}
                title={content.primarySectionTitle}
                items={primaryItems}
              />
            ) : null}
            {showSecondary ? (
              <ListBlock
                label={content.secondarySectionLabel}
                title={content.secondarySectionTitle}
                items={secondaryItems}
              />
            ) : null}
          </div>
        ) : null}

        {showOwner ? (
          <section className="policy-card policy-owner-card">
            {hasText(content.ownerLabel) ? (
              <span className="policy-card-label">{content.ownerLabel}</span>
            ) : null}
            {hasText(content.ownerTitle) ? <h3>{content.ownerTitle}</h3> : null}
            {ownerItems.length ? (
              <div
                className="policy-owner-grid"
                style={{"--policy-owner-columns": ownerItems.length}}
              >
                {ownerItems.map((item, index) => (
                  <p key={`${item}-${index}`}>{item}</p>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {showFooter ? (
          <footer className="policy-footer">
            {hasText(content.processLabel) ? (
              <div className="policy-footer-label">{content.processLabel}</div>
            ) : null}
            {processSteps.length ? (
              <div className="policy-process-row">
                {processSteps.map((step, index) => (
                  <React.Fragment key={`${step}-${index}`}>
                    <span>{step}</span>
                    {index < processSteps.length - 1 ? (
                      <i aria-hidden="true">•</i>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
            ) : null}
            {hasText(content.footerNote) ||
            hasText(content.footerReference) ||
            (showPageNumbers && pageNumber && pageCount) ? (
              <div className="policy-footer-note">
                {hasText(content.footerNote) ? (
                  <span>{content.footerNote}</span>
                ) : null}
                {hasText(content.footerReference) ? (
                  <strong>{content.footerReference}</strong>
                ) : null}
                <DocumentPageNumber
                  pageNumber={pageNumber}
                  pageCount={pageCount}
                  showPageNumbers={showPageNumbers}
                />
              </div>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

function ChecklistSection({title, items}) {
  const sectionRef = React.useRef(null);
  const listRef = React.useRef(null);
  const [densityIndex, setDensityIndex] = React.useState(0);
  const [fitVersion, setFitVersion] = React.useState(0);
  const measuredLayoutRef = React.useRef("");
  const checklistItems = visibleItems(items)
    .map((item) => {
      const value = String(item).trim();
      const heading = value.match(/^#{1,3}\s+(.+)$/u);
      const isDivider = /^-{3,}$/u.test(value);
      const isSubItem = /^-\s+/u.test(value);
      if (heading) {
        return {
          type: "heading",
          text: heading[1].trim(),
        };
      }
      if (isDivider) {
        return {
          type: "divider",
          text: "",
        };
      }
      return {
        type: isSubItem ? "subitem" : "item",
        text: isSubItem ? value.replace(/^-\s+/u, "").trim() : value,
      };
    })
    .filter((item) => item.type === "divider" || hasText(item.text));
  const contentSignature = `${String(title || "").trim()}|${checklistItems
    .map((item) => `${item.type}:${item.text}`)
    .join("|")}`;
  const layoutSignature = `${contentSignature}|${fitVersion}`;
  const density = CHECKLIST_DENSITY_CLASSES[densityIndex];

  React.useLayoutEffect(() => {
    if (measuredLayoutRef.current !== layoutSignature) {
      measuredLayoutRef.current = layoutSignature;
      if (densityIndex !== 0) {
        setDensityIndex(0);
        return;
      }
    }
    if (
      checklistContentOverflows(sectionRef.current, listRef.current) &&
      densityIndex < CHECKLIST_DENSITY_CLASSES.length - 1
    ) {
      setDensityIndex((current) => current + 1);
    }
  }, [densityIndex, layoutSignature]);

  React.useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof ResizeObserver === "undefined") return undefined;
    let previousWidth = section.clientWidth;
    let previousHeight = section.clientHeight;
    const observer = new ResizeObserver(() => {
      const nextWidth = section.clientWidth;
      const nextHeight = section.clientHeight;
      if (nextWidth === previousWidth && nextHeight === previousHeight) return;
      previousWidth = nextWidth;
      previousHeight = nextHeight;
      setFitVersion((current) => current + 1);
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  if (!hasText(title) && !checklistItems.length) return null;
  return (
    <section
      ref={sectionRef}
      className={`checklist-section${density ? ` ${density}` : ""}`}
    >
      {hasText(title) ? <h3>{title}</h3> : null}
      {checklistItems.length ? (
        <ul ref={listRef}>
          {checklistItems.map((item, index) => {
            if (item.type === "heading") {
              return (
                <li className="is-heading" key={`${item.text}-${index}`}>
                  <h4>{item.text}</h4>
                </li>
              );
            }
            if (item.type === "divider") {
              return (
                <li
                  aria-hidden="true"
                  className="is-divider"
                  key={`divider-${index}`}
                >
                  <hr />
                </li>
              );
            }
            return (
              <li
                className={item.type === "subitem" ? "is-subitem" : undefined}
                key={`${item.text}-${index}`}
              >
                <span aria-hidden="true" />
                <p>{item.text}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function ChecklistPreview({
  content,
  previewRef,
  pageNumber,
  pageCount,
  showPageNumbers = true,
}) {
  const checklistSections = [
    {
      key: "one",
      title: content.sectionOneTitle,
      items: visibleItems(content.sectionOneItems),
    },
    {
      key: "two",
      title: content.sectionTwoTitle,
      items: visibleItems(content.sectionTwoItems),
    },
    {
      key: "three",
      title: content.sectionThreeTitle,
      items: visibleItems(content.sectionThreeItems),
    },
  ].filter((section) => hasText(section.title) || section.items.length);
  const showInstructions =
    hasText(content.instructionsLabel) || hasText(content.instructions);
  const showCallout =
    hasText(content.calloutLabel) || hasText(content.calloutText);

  return (
    <article ref={previewRef} className="studio-checklist-document">
      <DocumentHeader content={content} />
      <div className="checklist-body">
        {showInstructions ? (
          <section className="checklist-instructions">
            {hasText(content.instructionsLabel) ? (
              <span className="policy-card-label">
                {content.instructionsLabel}
              </span>
            ) : null}
            {hasText(content.instructions) ? (
              <p>{content.instructions}</p>
            ) : null}
          </section>
        ) : null}
        {checklistSections.length ? (
          <div
            className={`checklist-sections is-count-${checklistSections.length}`}
          >
            {checklistSections.map((section) => (
              <ChecklistSection
                key={section.key}
                title={section.title}
                items={section.items}
              />
            ))}
          </div>
        ) : null}
        {showCallout ? (
          <section className="checklist-callout">
            {hasText(content.calloutLabel) ? (
              <span>{content.calloutLabel}</span>
            ) : null}
            {hasText(content.calloutText) ? (
              <p>{content.calloutText}</p>
            ) : null}
          </section>
        ) : null}
        <DocumentFooter
          content={content}
          pageNumber={pageNumber}
          pageCount={pageCount}
          showPageNumbers={showPageNumbers}
        />
      </div>
    </article>
  );
}

export function SignupSheetPreview({
  content,
  previewRef,
  pageNumber,
  pageCount,
  showPageNumbers = true,
}) {
  const signupCount = Math.min(
    24,
    Math.max(4, Number(content.signupCount) || 12),
  );
  const columns = [
    content.columnOneLabel,
    content.columnTwoLabel,
    content.columnThreeLabel,
  ];
  const showInstructions =
    hasText(content.instructionsLabel) || hasText(content.instructions);
  return (
    <article ref={previewRef} className="studio-signup-document">
      <DocumentHeader content={content} />
      <div className="signup-sheet-body">
        {showInstructions ? (
          <section className="signup-sheet-instructions">
            {hasText(content.instructionsLabel) ? (
              <span className="policy-card-label">
                {content.instructionsLabel}
              </span>
            ) : null}
            {hasText(content.instructions) ? (
              <p>{content.instructions}</p>
            ) : null}
          </section>
        ) : null}
        <div
          className={`signup-sheet-table${
            content.showNumbers !== false ? " has-numbers" : ""
          }`}
          style={{"--signup-row-count": signupCount}}
        >
          <div className="signup-sheet-row is-header">
            {content.showNumbers !== false ? (
              <span className="signup-sheet-number">#</span>
            ) : null}
            {columns.map((label, index) => (
              <strong key={`${label}-${index}`}>{label}</strong>
            ))}
          </div>
          {Array.from({length: signupCount}, (_, index) => (
            <div className="signup-sheet-row" key={`signup-row-${index}`}>
              {content.showNumbers !== false ? (
                <span className="signup-sheet-number">{index + 1}</span>
              ) : null}
              {columns.map((label, columnIndex) => (
                <span
                  aria-hidden="true"
                  key={`${label}-${columnIndex}-${index}`}
                />
              ))}
            </div>
          ))}
        </div>
        <DocumentFooter
          content={content}
          pageNumber={pageNumber}
          pageCount={pageCount}
          showPageNumbers={showPageNumbers}
        />
      </div>
    </article>
  );
}

function DirectoryCard({card}) {
  if (!hasText(card?.name) && !hasText(card?.details)) return null;
  const meetingDay = [
    ["SUNDAY", /\bsun(?:day)?s?\b/i],
    ["MONDAY", /\bmon(?:day)?s?\b/i],
    ["TUESDAY", /\btue(?:sday)?s?\b/i],
    ["WEDNESDAY", /\bwed(?:nesday)?s?\b/i],
    ["THURSDAY", /\bthu(?:rsday)?s?\b/i],
    ["FRIDAY", /\bfri(?:day)?s?\b/i],
    ["SATURDAY", /\bsat(?:urday)?s?\b/i],
  ].find(([, pattern]) => pattern.test(String(card.subtitle || "")))?.[0];
  return (
    <article className="directory-card">
      <div
        className={`directory-card-image${
          hasText(card.imageUrl) ? " has-image" : ""
        }`}
      >
        {hasText(card.imageUrl) ? (
          <img
            alt=""
            data-studio-directory-image
            src={card.imageUrl}
          />
        ) : (
          <span aria-hidden="true">
            {String(card.name || "C").trim().slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="directory-card-copy">
        <div>
          <h3>{card.name}</h3>
          {meetingDay ? (
            <span className="directory-meeting-day">{meetingDay}</span>
          ) : null}
        </div>
        {hasText(card.subtitle) ? <strong>{card.subtitle}</strong> : null}
        {hasText(card.details) ? <p>{card.details}</p> : null}
      </div>
    </article>
  );
}

export function DirectoryPreview({
  content,
  previewRef,
  pageNumber,
  pageCount,
  showPageNumbers = true,
}) {
  const cards = (Array.isArray(content.cards) ? content.cards : [])
    .filter((card) => hasText(card?.name) || hasText(card?.details))
    .slice(0, 8);
  return (
    <article ref={previewRef} className="studio-directory-document">
      <DocumentHeader content={content} />
      <div className="directory-body">
        <div className={`directory-grid is-count-${cards.length}`}>
          {cards.map((card, index) => (
            <DirectoryCard
              card={card}
              key={card.id || `${card.name}-${index}`}
            />
          ))}
        </div>
        <DocumentFooter
          content={content}
          pageNumber={pageNumber}
          pageCount={pageCount}
          showPageNumbers={showPageNumbers}
        />
      </div>
    </article>
  );
}

function renderInlineMarkdown(value) {
  const input = String(value || "");
  const pattern =
    /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/gu;
  return input.split(pattern).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/u.test(part)) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/u.test(part)) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>;
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/u);
    if (link) {
      return (
        <a key={`${part}-${index}`} href={link[2]}>
          {link[1]}
        </a>
      );
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function ContentBlockPreview({block}) {
  if (block.type !== "divider" && !hasText(block.text)) return null;
  if (block.type === "divider") {
    return <hr className="content-page-divider" />;
  }
  if (block.type === "heading") {
    return <h3>{renderInlineMarkdown(block.text)}</h3>;
  }
  if (block.type === "callout") {
    return (
      <aside className="content-page-callout">
        {renderInlineMarkdown(block.text)}
      </aside>
    );
  }
  if (block.type === "bullets" || block.type === "numbered") {
    const ListTag = block.type === "numbered" ? "ol" : "ul";
    return (
      <ListTag>
        {textToLines(block.text, 12).map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ListTag>
    );
  }
  return <p>{renderInlineMarkdown(block.text)}</p>;
}

export function ContentPagePreview({
  content,
  previewRef,
  pageNumber,
  pageCount,
  showPageNumbers = true,
}) {
  const visibleBlocks = (content.blocks || []).filter(
    (block) => block.type === "divider" || hasText(block.text),
  );
  return (
    <article ref={previewRef} className="studio-content-document">
      <DocumentHeader content={content} />
      <div className="content-page-body">
        <div className="content-page-blocks">
          {visibleBlocks.map((block) => (
            <ContentBlockPreview block={block} key={block.id} />
          ))}
        </div>
        <DocumentFooter
          content={content}
          pageNumber={pageNumber}
          pageCount={pageCount}
          showPageNumbers={showPageNumbers}
        />
      </div>
    </article>
  );
}

export function DocumentPagePreview({
  page,
  previewRef,
  pageNumber,
  pageCount,
  showPageNumbers = true,
}) {
  const props = {
    content: page.content || {},
    previewRef,
    pageNumber,
    pageCount,
    showPageNumbers,
  };
  if (page.templateId === "document-checklist") {
    return <ChecklistPreview {...props} />;
  }
  if (page.templateId === "document-signup-sheet") {
    return <SignupSheetPreview {...props} />;
  }
  if (page.templateId === "document-directory") {
    return <DirectoryPreview {...props} />;
  }
  if (page.templateId === "document-content-page") {
    return <ContentPagePreview {...props} />;
  }
  return <PolicyPreview {...props} />;
}

function EventGraphicDecoration({composition}) {
  if (composition === "flat" || composition === "color-overlay") {
    return null;
  }

  if (composition === "signal") {
    return (
      <div className="event-signal-art" aria-hidden="true">
        <span className="event-signal-ring is-one" />
        <span className="event-signal-ring is-two" />
        <span className="event-signal-ring is-three" />
        <span className="event-signal-core" />
      </div>
    );
  }

  if (composition === "split") {
    return (
      <div className="event-split-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (composition === "editorial") {
    return (
      <div className="event-editorial-art" aria-hidden="true">
        <span className="event-orbit is-one" />
        <span className="event-orbit is-two" />
        <span className="event-orbit is-three" />
      </div>
    );
  }

  return (
    <div
      className={`event-template-composition-art is-${composition}`}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

const EVENT_EDITABLE_FIELDS = {
  eyebrow: {label: "Utility label", maximum: 30},
  title: {label: "Event title", maximum: 52},
  subtitle: {label: "Supporting line", maximum: 110, multiline: true},
  date: {label: "Date", maximum: 28},
  time: {label: "Time", maximum: 24},
  location: {label: "Location", maximum: 34},
  cta: {label: "Call to action", maximum: 44},
};

function EditableEventText({
  as: Tag,
  children,
  editorMode,
  field,
  onEditField,
  onSelectField,
  selectedField,
  className = "",
}) {
  if (!editorMode) {
    return <Tag className={className || undefined}>{children}</Tag>;
  }

  const config = EVENT_EDITABLE_FIELDS[field];
  const commitValue = (event) => {
    const rawValue = config.multiline
      ? event.currentTarget.innerText
      : event.currentTarget.textContent;
    const value = String(rawValue || "")
      .replace(/\u00a0/g, " ")
      .replace(config.multiline ? /\r/g : /[\r\n]+/g, config.multiline ? "" : " ")
      .slice(0, config.maximum);
    if (value !== children) onEditField(field, value);
  };

  return (
    <Tag
      className={[
        className,
        "event-editable-field",
        selectedField === field ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={`Edit ${config.label}`}
      aria-multiline={config.multiline || undefined}
      data-event-field={field}
      data-placeholder={config.label}
      onClick={(event) => {
        event.stopPropagation();
        onSelectField(field);
      }}
      onFocus={() => onSelectField(field)}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.blur();
        }
        if (event.key === "Enter" && !config.multiline) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    >
      {children}
    </Tag>
  );
}

export function EventPreview({
  content,
  previewRef,
  templateId,
  editorMode = false,
  selectedField = "",
  onSelectField = () => {},
  onEditField = () => {},
}) {
  const template = getTemplateById(templateId);
  const displayFont = getEventFont(templateId, content.fontKey);
  const composition = normalizeEventComposition(
    templateId,
    content.composition,
  );
  const isFlat = composition === "flat";
  const isColorOverlay = composition === "color-overlay";
  const brandColor = getBrandColor(content.flatColor);
  const eventPalette = getEventPalette(content.palette);
  const overlayColor = getBrandColor(content.overlayColor || "red");
  const imageOpacity = normalizeImageOpacity(content.backgroundImageOpacity);
  const underlyingUsesDarkCopy =
    (isFlat && brandColor.ink === "dark") ||
    (!isFlat && !isColorOverlay && eventPalette.ink === "dark");
  const usesDarkCopy =
    underlyingUsesDarkCopy &&
    (!content.backgroundImage || imageOpacity <= 0.45);
  const usesLogoHero = content.heroMode === "logo";
  let backgroundStyle;

  if (isFlat) {
    backgroundStyle = {background: brandColor.hex};
  }

  return (
    <article
      ref={previewRef}
      className={[
        "studio-event-graphic",
        `is-template-${template.variant || "signal-stack"}`,
        `is-${content.format || "square"}`,
        `is-${composition}`,
        `is-${content.palette || "charcoal-red"}`,
        `is-font-${content.fontKey || displayFont.value}`,
        `is-text-${content.textAlignment || "left"}`,
        content.backgroundImage ? "has-background-image" : "",
        content.textShadow ? "has-text-shadow" : "",
        usesLogoHero ? "has-logo-hero" : "",
        usesDarkCopy ? "has-dark-copy" : "",
        editorMode ? "is-editor-canvas" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={editorMode ? () => onSelectField("") : undefined}
      style={{
        ...backgroundStyle,
        "--event-display-font": `"${displayFont.family}"`,
        "--event-logo-scale": Math.min(
          2,
          Math.max(0.5, Number(content.heroLogoScale) || 1),
        ),
        "--event-logo-clear-space": Math.min(
          12,
          Math.max(0, Number(content.heroLogoClearSpace) || 0),
        ),
      }}
    >
      {content.backgroundImage ? (
        <div
          className={[
            "event-background-media",
            isFlat ? "is-flat" : "",
            isColorOverlay ? "is-color-overlay" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={focalMediaStyle(content)}
          aria-hidden="true"
        />
      ) : null}
      {isColorOverlay && content.backgroundImage ? (
        <div
          className="event-color-overlay"
          style={{
            backgroundColor: overlayColor.hex,
            mixBlendMode: content.overlayBlendMode || "multiply",
          }}
          aria-hidden="true"
        />
      ) : null}
      <EventGraphicDecoration composition={composition} />
      <div className="event-graphic-layout">
        <div className="event-graphic-copy">
        <EditableEventText
          as="span"
          className="event-eyebrow"
          editorMode={editorMode}
          field="eyebrow"
          onEditField={onEditField}
          onSelectField={onSelectField}
          selectedField={selectedField}
        >
          {content.eyebrow}
        </EditableEventText>
        {usesLogoHero ? (
          <div className="event-hero-logo-wrap">
            {content.heroLogo ? (
              <EventHeroLogo
                source={content.heroLogo}
                name={content.heroLogoName}
              />
            ) : (
              <span className="event-hero-logo-placeholder">
                Choose a hero logo
              </span>
            )}
          </div>
        ) : (
          <EditableEventText
            as="h2"
            editorMode={editorMode}
            field="title"
            onEditField={onEditField}
            onSelectField={onSelectField}
            selectedField={selectedField}
          >
            {content.title}
          </EditableEventText>
        )}
        <EditableEventText
          as="p"
          editorMode={editorMode}
          field="subtitle"
          onEditField={onEditField}
          onSelectField={onSelectField}
          selectedField={selectedField}
        >
          {content.subtitle}
        </EditableEventText>
        </div>
        <div className="event-graphic-details">
        <EditableEventText
          as="strong"
          editorMode={editorMode}
          field="date"
          onEditField={onEditField}
          onSelectField={onSelectField}
          selectedField={selectedField}
        >
          {content.date}
        </EditableEventText>
        <span className="event-detail-line">
          <EditableEventText
            as="span"
            editorMode={editorMode}
            field="time"
            onEditField={onEditField}
            onSelectField={onSelectField}
            selectedField={selectedField}
          >
            {content.time}
          </EditableEventText>
          {content.time && content.location ? (
            <i aria-hidden="true">·</i>
          ) : null}
          <EditableEventText
            as="span"
            editorMode={editorMode}
            field="location"
            onEditField={onEditField}
            onSelectField={onSelectField}
            selectedField={selectedField}
          >
            {content.location}
          </EditableEventText>
        </span>
        </div>
        <footer className="event-graphic-footer">
          <BrandMark inverse={!usesDarkCopy} />
          <EditableEventText
            as="span"
            editorMode={editorMode}
            field="cta"
            onEditField={onEditField}
            onSelectField={onSelectField}
            selectedField={selectedField}
          >
            {content.cta}
          </EditableEventText>
        </footer>
      </div>
    </article>
  );
}

export function StudioPreview({project, previewRef}) {
  if (!project) return null;

  if (isDocumentProject(project)) {
    const page = project.pages?.[0];
    return page ? (
      <DocumentPagePreview
        page={page}
        previewRef={previewRef}
        pageNumber={1}
        pageCount={project.pages.length}
        showPageNumbers={project.documentSettings?.showPageNumbers !== false}
      />
    ) : null;
  }

  return (
    <EventPreview
      content={project.content}
      previewRef={previewRef}
      templateId={project.templateId}
    />
  );
}
