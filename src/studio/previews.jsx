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

const CHECKLIST_DENSITY_CLASSES = [
  "",
  "is-density-compact",
  "is-density-tight",
  "is-density-maximum",
];

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
        `is-font-${content.fontKey || displayFont.value}`,
        `is-text-${content.textAlignment || "left"}`,
        content.backgroundImage ? "has-background-image" : "",
        content.textShadow ? "has-text-shadow" : "",
        usesDarkCopy ? "has-dark-copy" : "",
        editorMode ? "is-editor-canvas" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={editorMode ? () => onSelectField("") : undefined}
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
