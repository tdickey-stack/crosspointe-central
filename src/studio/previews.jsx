import React from "react";
import {focalMediaStyle} from "./focal.js";
import {
  getBrandColor,
  getEventFont,
  getTemplateById,
  normalizeEventComposition,
} from "./templates.js";

function BrandMark({inverse = false}) {
  return (
    <div className={`studio-preview-brand${inverse ? " is-inverse" : ""}`}>
      <img src="/favicon.svg" alt="" />
      <span>CROSSPOINTE</span>
    </div>
  );
}

function ListBlock({label, title, items}) {
  return (
    <section className="policy-card policy-list-card">
      <span className="policy-card-label">{label}</span>
      <h3>{title}</h3>
      <ul>
        {(items || []).map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PolicyPreview({content, previewRef}) {
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
        <section className="policy-card policy-operating-rule">
          <span className="policy-card-label">
            {content.operatingRuleLabel || "OPERATING RULE"}
          </span>
          <p>{content.operatingRule}</p>
        </section>

        <div className="policy-two-column">
          <ListBlock
            label={content.primarySectionLabel}
            title={content.primarySectionTitle}
            items={content.primaryItems}
          />
          <ListBlock
            label={content.secondarySectionLabel}
            title={content.secondarySectionTitle}
            items={content.secondaryItems}
          />
        </div>

        <section className="policy-card policy-owner-card">
          <span className="policy-card-label">{content.ownerLabel}</span>
          <h3>{content.ownerTitle}</h3>
          <div className="policy-owner-grid">
            {(content.ownerItems || []).map((item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ))}
          </div>
        </section>

        <footer className="policy-footer">
          <div className="policy-footer-label">{content.processLabel}</div>
          <div className="policy-process-row">
            {(content.processSteps || []).map((step, index) => (
              <React.Fragment key={`${step}-${index}`}>
                <span>{step}</span>
                {index < content.processSteps.length - 1 ? (
                  <i aria-hidden="true">•</i>
                ) : null}
              </React.Fragment>
            ))}
          </div>
          <div className="policy-footer-note">
            <span>{content.footerNote}</span>
            <strong>{content.footerReference}</strong>
          </div>
        </footer>
      </div>
    </article>
  );
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

  return project.templateId === "policy-document" ? (
    <PolicyPreview content={project.content} previewRef={previewRef} />
  ) : (
    <EventPreview
      content={project.content}
      previewRef={previewRef}
      templateId={project.templateId}
    />
  );
}
