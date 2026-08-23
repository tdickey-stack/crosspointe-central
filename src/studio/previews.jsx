import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {focalMediaStyle, normalizeImageOpacity} from "./focal.js";
import {
  GRAPHIC_FONT_WEIGHT_OPTIONS,
  getBrandColor,
  getEventPalette,
  getEventFont,
  getTemplateById,
  isDocumentProject,
  normalizeEventComposition,
  textToLines,
} from "./templates.js";

const BRAND_MARK_COLOR_HEX = {
  white: "#ffffff",
  charcoal: "#27272a",
  red: "#ef3b2d",
};

function BrandMark({type = "central", color = "auto", usesDarkCopy = false}) {
  const resolvedColor =
    color === "auto" ? (usesDarkCopy ? "charcoal" : "white") : color;
  const colorHex = BRAND_MARK_COLOR_HEX[resolvedColor] || BRAND_MARK_COLOR_HEX.white;

  if (["heart", "full"].includes(type)) {
    const source =
      type === "full" && resolvedColor === "white"
        ? "/studio-assets/crosspointe-full-white.png"
        : type === "full"
          ? "/studio-assets/crosspointe-full-grey.png"
          : "/studio-assets/crosspointe-heart-grey.png";
    return (
      <div
        className={`studio-preview-brand is-official is-${type}`}
        aria-label={
          type === "heart" ? "CrossPointe heart logo" : "CrossPointe full logo"
        }
      >
        <PreparedBrandImage source={source} color={colorHex} />
      </div>
    );
  }

  return (
    <div
      className="studio-preview-brand is-central"
      style={{color: colorHex}}
      aria-label="CrossPointe Central"
    >
      <img src="/favicon.svg" alt="" />
      <span>
        CROSSPOINTE <b>CENTRAL</b>
      </span>
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
const preparedBrandSourceCache = new Map();

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

async function prepareBrandSource(source, color) {
  const cacheKey = `${source}|${color}`;
  if (preparedBrandSourceCache.has(cacheKey)) {
    return preparedBrandSourceCache.get(cacheKey);
  }
  const preparedSource = (async () => {
    try {
      const trimmedSource = await trimTransparentLogoSource(source);
      const image = await loadLogoImage(trimmedSource || source);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", {alpha: true});
      if (!context) return trimmedSource || source;
      context.drawImage(image, 0, 0);
      context.globalCompositeOperation = "source-in";
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } catch (error) {
      return source;
    }
  })();
  preparedBrandSourceCache.set(cacheKey, preparedSource);
  return preparedSource;
}

function PreparedBrandImage({source, color}) {
  const [renderedSource, setRenderedSource] = useState("");

  useEffect(() => {
    let isCurrent = true;
    setRenderedSource("");
    prepareBrandSource(source, color).then((preparedSource) => {
      if (isCurrent) setRenderedSource(preparedSource || source);
    });
    return () => {
      isCurrent = false;
    };
  }, [source, color]);

  return renderedSource ? (
    <img
      src={renderedSource}
      alt=""
      data-studio-brand-ready="true"
      data-studio-brand-color={color}
    />
  ) : (
    <span className="studio-preview-brand-loading" data-studio-brand-pending="true" />
  );
}

function EventHeroLogo({source, name}) {
  const [renderedSource, setRenderedSource] = useState("");

  useEffect(() => {
    let isCurrent = true;
    setRenderedSource("");
    trimTransparentLogoSource(source).then((trimmedSource) => {
      if (isCurrent) setRenderedSource(trimmedSource || source);
    });
    return () => {
      isCurrent = false;
    };
  }, [source]);

  return renderedSource ? (
    <img
      className="event-hero-logo"
      src={renderedSource}
      alt={name || "Hero logo"}
      data-studio-hero-ready="true"
    />
  ) : (
    <span className="event-hero-logo-placeholder" data-studio-hero-pending="true">
      Preparing logo…
    </span>
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

function pointeGlassEdgeMask(clipRects) {
  const rectMarkup = clipRects
    .map(
      (rect) => `
        <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${rect.rx}" ry="${rect.ry}" fill="#fff" />
        <rect x="${rect.x + rect.edgeInsetX}" y="${rect.y + rect.edgeInsetY}" width="${Math.max(0, rect.width - rect.edgeInsetX * 2)}" height="${Math.max(0, rect.height - rect.edgeInsetY * 2)}" rx="${Math.max(0, rect.rx - rect.edgeInsetX)}" ry="${Math.max(0, rect.ry - rect.edgeInsetY)}" fill="#000" filter="url(#edge-soft)" />`,
    )
    .join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">
      <defs>
        <filter id="edge-soft" x="-20%" y="-20%" width="140%" height="140%" primitiveUnits="objectBoundingBox">
          <feGaussianBlur stdDeviation="0.014" />
        </filter>
        <mask id="edge-mask" x="0" y="0" width="1" height="1" maskContentUnits="objectBoundingBox" maskUnits="objectBoundingBox" style="mask-type:luminance">
          <rect x="0" y="0" width="1" height="1" fill="#000" />
          ${rectMarkup}
        </mask>
      </defs>
      <rect x="0" y="0" width="1" height="1" fill="#fff" mask="url(#edge-mask)" />
    </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function PointeGlassRefraction({clipId, clipRects, content}) {
  if (!content.backgroundImage || !clipRects.length) return null;
  const edgeMask = pointeGlassEdgeMask(clipRects);
  const primaryRect = clipRects[0];
  const lensOrigin = `${(primaryRect.x + primaryRect.width / 2) * 100}% ${
    (primaryRect.y + primaryRect.height / 2) * 100
  }%`;

  return (
    <>
      <svg
        className="pointe-glass-clip-defs"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            {clipRects.map((rect, index) => (
              <rect
                key={`${index}-${rect.x}-${rect.y}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={rect.rx}
                ry={rect.ry}
              />
            ))}
          </clipPath>
        </defs>
      </svg>
      <div
        className="pointe-glass-refraction"
        style={{
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
        }}
        aria-hidden="true"
      >
        <div
          className="pointe-glass-refraction-lens is-core"
        >
          <div
            className="pointe-glass-refraction-scale"
            style={{transformOrigin: lensOrigin}}
          >
            <div
              className="pointe-glass-refraction-media"
              data-studio-background-surface
              style={focalMediaStyle(content)}
            />
          </div>
        </div>
        <div
          className="pointe-glass-refraction-lens is-edge"
          style={{
            maskImage: edgeMask,
            WebkitMaskImage: edgeMask,
          }}
        >
          <div
            className="pointe-glass-refraction-scale"
            style={{transformOrigin: lensOrigin}}
          >
            <div
              className="pointe-glass-refraction-media"
              data-studio-background-surface
              style={focalMediaStyle(content)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function measuredGlassRects(root, isSocial) {
  if (!root) return [];
  const rootRect = root.getBoundingClientRect();
  if (!rootRect.width || !rootRect.height) return [];
  const selectors = isSocial
    ? [".social-post-copy"]
    : [
        ".event-graphic-copy",
        ".event-graphic-details",
        ".event-graphic-footer .studio-preview-brand",
        ".event-graphic-footer > span",
      ];

  return selectors
    .map((selector) => root.querySelector(selector))
    .filter(Boolean)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const edgeInset = Math.min(rect.width, rect.height) * 0.115;
      const radius = Number.parseFloat(
        window.getComputedStyle(element).borderTopLeftRadius,
      );
      const round = (value) => Math.round(value * 1000000) / 1000000;
      return {
        x: round((rect.left - rootRect.left) / rootRect.width),
        y: round((rect.top - rootRect.top) / rootRect.height),
        width: round(rect.width / rootRect.width),
        height: round(rect.height / rootRect.height),
        rx: round(Math.min(rect.width / 2, radius || 0) / rootRect.width),
        ry: round(Math.min(rect.height / 2, radius || 0) / rootRect.height),
        edgeInsetX: round(edgeInset / rootRect.width),
        edgeInsetY: round(edgeInset / rootRect.height),
      };
    })
    .filter(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= 1.001 &&
        rect.y + rect.height <= 1.001,
    );
}

function usePointeGlassRefraction({
  enabled,
  isSocial,
  rootRef,
  measurementKey,
}) {
  const [clipRects, setClipRects] = useState([]);

  useLayoutEffect(() => {
    if (!enabled || !rootRef.current) {
      setClipRects([]);
      return undefined;
    }
    const root = rootRef.current;
    let animationFrame = 0;
    const measure = () => {
      const nextRects = measuredGlassRects(root, isSocial);
      setClipRects((currentRects) =>
        JSON.stringify(currentRects) === JSON.stringify(nextRects)
          ? currentRects
          : nextRects,
      );
    };
    animationFrame = window.requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);
    root
      .querySelectorAll(
        isSocial
          ? ".social-post-copy"
          : ".event-graphic-copy, .event-graphic-details, .event-graphic-footer .studio-preview-brand, .event-graphic-footer > span",
      )
      .forEach((element) => resizeObserver.observe(element));
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [enabled, isSocial, measurementKey, rootRef]);

  return clipRects;
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

const SOCIAL_EDITABLE_FIELDS = {
  eyebrow: {label: "Context label", maximum: 30},
  title: {label: "Main text", maximum: 220, multiline: true},
  subtitle: {
    label: "Reference, attribution, or supporting text",
    maximum: 110,
    multiline: true,
  },
  cta: {label: "Footer text", maximum: 44},
};

function VisibilityEyeIcon({hidden}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      {hidden ? <path d="m4 4 16 16" /> : null}
    </svg>
  );
}

function textFitsLineLimit(element, maximumLines) {
  const style = window.getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return true;
  return (
    element.getBoundingClientRect().height <=
    lineHeight * (maximumLines + 0.08)
  );
}

function fitTextToLineLimit(element, maximumLines, minimumScale) {
  element.style.removeProperty("font-size");
  element.style.removeProperty("width");
  element.style.removeProperty("max-width");
  element.dataset.autoFitScale = "1";
  if (!maximumLines || textFitsLineLimit(element, maximumLines)) return;

  const baseStyle = window.getComputedStyle(element);
  const baseSize = Number.parseFloat(baseStyle.fontSize);
  const baseWidth = element.getBoundingClientRect().width;
  if (
    !Number.isFinite(baseSize) ||
    baseSize <= 0 ||
    !Number.isFinite(baseWidth) ||
    baseWidth <= 0
  ) {
    return;
  }

  // Several templates size their title box in em. Freeze the box before
  // scaling so reducing the type actually creates room for fewer lines.
  element.style.width = `${baseWidth}px`;
  element.style.maxWidth = `${baseWidth}px`;

  const floor = Math.min(1, Math.max(0.4, Number(minimumScale) || 0.56));
  const fitsAt = (scale) => {
    element.style.fontSize = `${baseSize * scale}px`;
    return textFitsLineLimit(element, maximumLines);
  };
  if (!fitsAt(floor)) {
    element.dataset.autoFitScale = String(floor);
    return;
  }

  let lower = floor;
  let upper = 1;
  for (let step = 0; step < 9; step += 1) {
    const candidate = (lower + upper) / 2;
    if (fitsAt(candidate)) lower = candidate;
    else upper = candidate;
  }
  const fittedScale = Math.floor(lower * 1000) / 1000;
  element.style.fontSize = `${baseSize * fittedScale}px`;
  element.dataset.autoFitScale = String(fittedScale);
}

function EditableEventText({
  as: Tag,
  children,
  editorMode,
  field,
  onEditField,
  onSelectField,
  selectedField,
  className = "",
  fieldOptions = EVENT_EDITABLE_FIELDS,
  visible = true,
  autoFitLines = 0,
  autoFitMinScale = 0.56,
  autoFitKey = "",
}) {
  const textRef = React.useRef(null);
  const isOptional = ["eyebrow", "subtitle"].includes(field);
  const isOptionalEmpty = isOptional && !hasText(children);
  const isOptionalHidden = isOptional && visible === false;

  React.useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || !autoFitLines) {
      element?.style.removeProperty("font-size");
      element?.style.removeProperty("width");
      element?.style.removeProperty("max-width");
      if (element) delete element.dataset.autoFitScale;
      return undefined;
    }

    let frame = 0;
    let disposed = false;
    const fit = () => {
      frame = 0;
      if (!disposed) {
        fitTextToLineLimit(element, autoFitLines, autoFitMinScale);
      }
    };
    const scheduleFit = () => {
      if (disposed) return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fit);
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleFit);
    if (element.parentElement) observer?.observe(element.parentElement);
    element.addEventListener("input", scheduleFit);
    fit();
    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleFit).catch(() => {});
    }
    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      element.removeEventListener("input", scheduleFit);
    };
  }, [
    autoFitKey,
    autoFitLines,
    autoFitMinScale,
    children,
    editorMode,
  ]);

  if (!editorMode) {
    if (isOptionalEmpty || isOptionalHidden) return null;
    return (
      <Tag
        ref={textRef}
        className={className || undefined}
        data-auto-fit-lines={autoFitLines || undefined}
      >
        {children}
      </Tag>
    );
  }

  const config = fieldOptions[field];
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

  const editableText = (
    <span
      className={[
        "event-editable-field",
        selectedField === field ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      contentEditable={!isOptionalHidden}
      suppressContentEditableWarning
      spellCheck={!isOptionalHidden}
      role={isOptionalHidden ? undefined : "textbox"}
      aria-hidden={isOptionalHidden || undefined}
      aria-label={isOptionalHidden ? undefined : `Edit ${config.label}`}
      aria-multiline={
        !isOptionalHidden && config.multiline ? true : undefined
      }
      data-event-field={field}
      data-placeholder={config.label}
      onClick={(event) => {
        event.stopPropagation();
        if (!isOptionalHidden) onSelectField(field);
      }}
      onFocus={() => {
        if (!isOptionalHidden) onSelectField(field);
      }}
      onBlur={isOptionalHidden ? undefined : commitValue}
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
    </span>
  );

  if (isOptional) {
    return (
      <Tag
        className={[
          className,
          "event-optional-field",
          isOptionalEmpty ? "is-optional-empty" : "",
          isOptionalHidden ? "is-optional-hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-event-field={field}
        data-field-visible={!isOptionalHidden ? "true" : "false"}
      >
        {editableText}
        <button
          className="event-field-visibility-toggle"
          type="button"
          aria-label={`${isOptionalHidden ? "Show" : "Hide"} ${config.label}`}
          aria-pressed={!isOptionalHidden}
          title={`${isOptionalHidden ? "Show" : "Hide"} ${config.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onEditField(`${field}Visible`, isOptionalHidden);
            onSelectField(isOptionalHidden ? field : "");
          }}
        >
          <VisibilityEyeIcon hidden={isOptionalHidden} />
        </button>
      </Tag>
    );
  }

  return (
    <Tag
      ref={textRef}
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
      data-auto-fit-lines={autoFitLines || undefined}
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

function SocialPostContent({
  content,
  editorMode,
  selectedField,
  onSelectField,
  onEditField,
  usesDarkCopy,
  usesLogoHero,
}) {
  const editableProps = {
    editorMode,
    fieldOptions: SOCIAL_EDITABLE_FIELDS,
    onEditField,
    onSelectField,
    selectedField,
  };
  return (
    <div className="event-graphic-layout social-post-layout">
      <div className="event-graphic-copy social-post-copy">
        <EditableEventText
          as="span"
          className="event-eyebrow social-post-eyebrow"
          field="eyebrow"
          visible={content.eyebrowVisible !== false}
          {...editableProps}
        >
          {content.eyebrow}
        </EditableEventText>
        {usesLogoHero ? (
          <div className="event-hero-logo-wrap social-post-hero-logo-wrap">
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
            className="social-post-title"
            field="title"
            {...editableProps}
          >
            {content.title}
          </EditableEventText>
        )}
        <EditableEventText
          as="p"
          className="social-post-attribution"
          field="subtitle"
          visible={content.subtitleVisible !== false}
          {...editableProps}
        >
          {content.subtitle}
        </EditableEventText>
      </div>
      <footer className="event-graphic-footer social-post-footer">
        <BrandMark
          type={content.brandMark}
          color={content.brandColor}
          usesDarkCopy={usesDarkCopy}
        />
        {content.cta ? (
          <EditableEventText
            as="span"
            field="cta"
            {...editableProps}
          >
            {content.cta}
          </EditableEventText>
        ) : null}
      </footer>
    </div>
  );
}

const SMALL_GROUP_EDITABLE_FIELDS = {
  eyebrow: {label: "Ministry label", maximum: 30},
  title: {label: "Group name", maximum: 52},
  subtitle: {label: "Leader names", maximum: 110},
  date: {label: "Meeting day", maximum: 28},
  time: {label: "Meeting time", maximum: 24},
  location: {label: "Meeting location", maximum: 34},
  cta: {label: "Directory prompt", maximum: 44},
};

function PointeGroupsMark() {
  return (
    <div className="pointe-groups-default-mark" aria-label="Pointe Groups">
      <span className="pointe-groups-mark-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="pointe-groups-mark-copy">
        <b>POINTE</b>
        <strong>GROUPS</strong>
      </span>
    </div>
  );
}

function SmallGroupLeaderContent({
  content,
  editorMode,
  selectedField,
  onSelectField,
  onEditField,
  usesDarkCopy,
}) {
  const editableProps = {
    editorMode,
    onEditField,
    onSelectField,
    selectedField,
    fieldOptions: SMALL_GROUP_EDITABLE_FIELDS,
  };
  return (
    <div className="small-group-leader-layout">
      {!content.backgroundImage ? <PointeGroupsMark /> : null}
      <div className="small-group-leader-info">
        <EditableEventText
          as="span"
          className="small-group-leader-eyebrow"
          field="eyebrow"
          visible={content.eyebrowVisible !== false}
          {...editableProps}
        >
          {content.eyebrow}
        </EditableEventText>
        <EditableEventText
          as="h2"
          className="small-group-leader-title"
          field="title"
          {...editableProps}
        >
          {content.title}
        </EditableEventText>
        <EditableEventText
          as="p"
          className="small-group-leader-names"
          field="subtitle"
          visible={content.subtitleVisible !== false}
          {...editableProps}
        >
          {content.subtitle}
        </EditableEventText>
        <div className="small-group-leader-meeting">
          <EditableEventText as="strong" field="date" {...editableProps}>
            {content.date}
          </EditableEventText>
          <span>
            <EditableEventText as="b" field="time" {...editableProps}>
              {content.time}
            </EditableEventText>
            {content.time && content.location ? <i aria-hidden="true">·</i> : null}
            <EditableEventText as="b" field="location" {...editableProps}>
              {content.location}
            </EditableEventText>
          </span>
        </div>
      </div>
      <footer className="small-group-leader-footer">
        <BrandMark
          type={content.brandMark}
          color={content.brandColor}
          usesDarkCopy={usesDarkCopy}
        />
        <EditableEventText as="span" field="cta" {...editableProps}>
          {content.cta}
        </EditableEventText>
      </footer>
    </div>
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
  const isSocial = template.kind === "social";
  const isSmallGroupLeader = template.variant === "small-group-leader";
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
  const selectedFontWeight = GRAPHIC_FONT_WEIGHT_OPTIONS.find(
    (option) => option.value === content.fontWeight,
  );
  let backgroundStyle;
  const localPreviewRef = useRef(null);
  const refractionClipId = `pointe-glass-${useId().replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  )}`;
  const isPointeGlass = composition === "pointe-glass";
  const combinedPreviewRef = useCallback(
    (node) => {
      localPreviewRef.current = node;
      if (typeof previewRef === "function") {
        previewRef(node);
      } else if (previewRef) {
        previewRef.current = node;
      }
    },
    [previewRef],
  );
  const refractionClipRects = usePointeGlassRefraction({
    enabled: isPointeGlass && Boolean(content.backgroundImage),
    isSocial,
    rootRef: localPreviewRef,
    measurementKey: [
      content.format,
      content.textAlignment,
      content.title,
      content.subtitle,
      content.date,
      content.time,
      content.location,
      content.cta,
      content.brandMark,
      content.heroMode,
    ].join("|"),
  });

  if (isFlat) {
    backgroundStyle = {background: brandColor.hex};
  }

  return (
    <article
      ref={combinedPreviewRef}
      className={[
        "studio-event-graphic",
        isSocial ? "is-social-post" : "",
        `is-template-${template.variant || "signal-stack"}`,
        `is-${content.format || "square"}`,
        `is-${composition}`,
        `is-${content.palette || "charcoal-red"}`,
        `is-font-${content.fontKey || displayFont.value}`,
        selectedFontWeight?.weight ? "has-global-font-weight" : "",
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
        "--event-global-font-weight": selectedFontWeight?.weight || undefined,
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
          data-studio-background-surface
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
      {!isSmallGroupLeader ? (
        <EventGraphicDecoration composition={composition} />
      ) : null}
      {isPointeGlass ? (
        <PointeGlassRefraction
          clipId={refractionClipId}
          clipRects={refractionClipRects}
          content={content}
        />
      ) : null}
      {isSmallGroupLeader ? (
        <SmallGroupLeaderContent
          content={content}
          editorMode={editorMode}
          selectedField={selectedField}
          onSelectField={onSelectField}
          onEditField={onEditField}
          usesDarkCopy={usesDarkCopy}
        />
      ) : isSocial ? (
        <SocialPostContent
          content={content}
          editorMode={editorMode}
          selectedField={selectedField}
          onSelectField={onSelectField}
          onEditField={onEditField}
          usesDarkCopy={usesDarkCopy}
          usesLogoHero={usesLogoHero}
        />
      ) : (
      <div className="event-graphic-layout">
        <div className="event-graphic-copy">
        <EditableEventText
          as="span"
          className="event-eyebrow"
          editorMode={editorMode}
          field="eyebrow"
          visible={content.eyebrowVisible !== false}
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
            autoFitLines={template.titleFitLines}
            autoFitMinScale={template.titleFitMinScale}
            autoFitKey={[
              content.fontKey,
              content.fontWeight,
              content.format,
              composition,
              content.textAlignment,
            ].join("|")}
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
          visible={content.subtitleVisible !== false}
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
          <BrandMark
            type={content.brandMark}
            color={content.brandColor}
            usesDarkCopy={usesDarkCopy}
          />
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
      )}
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
