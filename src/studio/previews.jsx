import React from "react";
import {focalMediaStyle} from "./focal.js";
import {
  getBrandColor,
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
  const filteredItems = visibleItems(items);
  if (!hasText(title) && !filteredItems.length) return null;
  return (
    <section className="checklist-section">
      {hasText(title) ? <h3>{title}</h3> : null}
      {filteredItems.length ? (
        <ul>
          {filteredItems.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span aria-hidden="true" />
              <p>{item}</p>
            </li>
          ))}
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

export function EventPreview({content, previewRef, templateId}) {
  const template = getTemplateById(templateId);
  const displayFont = getEventFont(templateId, content.fontKey);
  const composition = normalizeEventComposition(
    templateId,
    content.composition,
  );
  const isFlat = composition === "flat";
  const isColorOverlay = composition === "color-overlay";
  const brandColor = getBrandColor(content.flatColor);
  const overlayColor = getBrandColor(content.overlayColor || "red");
  const usesDarkCopy = isFlat && !content.backgroundImage && brandColor.ink === "dark";
  let backgroundStyle;

  if (isFlat && !content.backgroundImage) {
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
        `is-text-${content.textAlignment || "left"}`,
        content.backgroundImage ? "has-background-image" : "",
        content.textShadow ? "has-text-shadow" : "",
        usesDarkCopy ? "has-dark-copy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...backgroundStyle,
        "--event-display-font": `"${displayFont.family}"`,
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
      <div className="event-graphic-copy">
        <span className="event-eyebrow">{content.eyebrow}</span>
        <h2>{content.title}</h2>
        <p>{content.subtitle}</p>
      </div>
      <div className="event-graphic-details">
        <strong>{content.date}</strong>
        <span>
          {[content.time, content.location].filter(Boolean).join(" · ")}
        </span>
      </div>
      <footer className="event-graphic-footer">
        <BrandMark inverse={!usesDarkCopy} />
        <span>{content.cta}</span>
      </footer>
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
