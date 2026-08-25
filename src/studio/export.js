import {toCanvas} from "html-to-image";
import {jsPDF} from "jspdf";

import {buildCarouselZip} from "./carousel-archive.js";

const EVENT_EXPORT_SIZES = {
  square: {width: 1080, height: 1080, label: "1x1"},
  portrait: {width: 1080, height: 1350, label: "4x5"},
  screen: {width: 1920, height: 1080, label: "16x9"},
};

function safeFilename(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || fallback;
}

async function waitForFonts() {
  if (window.CENTRAL_STUDIO_FONT_CSS_READY) {
    await window.CENTRAL_STUDIO_FONT_CSS_READY;
    if (window.CENTRAL_STUDIO_FONT_CSS_ERROR) {
      throw new Error(
        "Studio could not load the approved fonts. Check your connection and try again.",
      );
    }
  }
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
}

function nextLayoutFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function getLayoutSignature(elements) {
  return elements
    .map((element) => {
      const bounds = element.getBoundingClientRect();
      const checklistSections = Array.from(
        element.querySelectorAll(".checklist-section"),
      )
        .map(
          (section) =>
            `${section.className}:${section.clientWidth}x${section.clientHeight}`,
        )
        .join(",");
      const fittedText = Array.from(
        element.querySelectorAll("[data-auto-fit-lines]"),
      )
        .map((textElement) => {
          const textBounds = textElement.getBoundingClientRect();
          return [
            textElement.dataset.autoFitScale || "pending",
            textBounds.width,
            textBounds.height,
            window.getComputedStyle(textElement).fontSize,
          ].join(":");
        })
        .join(",");
      return [
        bounds.width,
        bounds.height,
        element.scrollWidth,
        element.scrollHeight,
        checklistSections,
        fittedText,
      ].join(":");
    })
    .join("|");
}

async function waitForStableLayout(elements, maxFrames = 8) {
  let previousSignature = "";
  let stableFrames = 0;

  for (let frame = 0; frame < maxFrames; frame += 1) {
    await nextLayoutFrame();
    const signature = getLayoutSignature(elements);
    if (signature === previousSignature) {
      stableFrames += 1;
      if (stableFrames >= 2) return;
    } else {
      previousSignature = signature;
      stableFrames = 0;
    }
  }
}

async function waitForPreparedBrandMarks(element, maxFrames = 120) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (
      !element.querySelector(
        "[data-studio-brand-pending], [data-studio-hero-pending]",
      )
    ) return;
    await nextLayoutFrame();
  }
  throw new Error(
    "The selected CrossPointe logo is still preparing. Please try the export again.",
  );
}

async function waitForRenderedImages(element, timeoutMs = 5000) {
  const images = [...element.querySelectorAll("img")];
  await Promise.all(
    images.map((image) => {
      if (image.complete) {
        return image.naturalWidth
          ? Promise.resolve()
          : Promise.reject(new Error("A Studio image could not be prepared for export."));
      }
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("A Studio image is still loading. Please try the export again."));
        }, timeoutMs);
        const cleanup = () => {
          window.clearTimeout(timeout);
          image.removeEventListener("load", handleLoad);
          image.removeEventListener("error", handleError);
        };
        const handleLoad = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error("A Studio image could not be prepared for export."));
        };
        image.addEventListener("load", handleLoad, {once: true});
        image.addEventListener("error", handleError, {once: true});
      });
    }),
  );
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The rendered preview could not be loaded."));
    image.src = dataUrl;
  });
}

function highResolutionUnsplashUrl(value, width) {
  try {
    const url = new URL(String(value || ""));
    if (url.hostname !== "images.unsplash.com") return "";
    url.searchParams.set("w", String(Math.max(2160, width)));
    url.searchParams.set("q", "90");
    url.searchParams.set("fit", "max");
    return url.toString();
  } catch (error) {
    return "";
  }
}

async function useHighResolutionBackground(element, content, width) {
  if (
    !element ||
    content?.backgroundImageSource !== "unsplash" ||
    !content?.backgroundImage
  ) {
    return () => {};
  }
  const upgradedUrl = highResolutionUnsplashUrl(content.backgroundImage, width);
  const backgroundElements = Array.from(
    element.querySelectorAll("[data-studio-background-surface]"),
  );
  if (!backgroundElements.length) {
    const fallbackElement = element.querySelector(".event-background-media");
    if (fallbackElement) backgroundElements.push(fallbackElement);
  }
  const previousBackgrounds = backgroundElements.map((backgroundElement) => ({
    backgroundElement,
    backgroundImage: backgroundElement.style.backgroundImage,
  }));
  const matchingBackgrounds = previousBackgrounds.filter(({backgroundImage}) =>
    backgroundImage.includes(content.backgroundImage),
  );
  if (!upgradedUrl || !matchingBackgrounds.length) {
    return () => {};
  }
  matchingBackgrounds.forEach(({backgroundElement, backgroundImage}) => {
    backgroundElement.style.backgroundImage = backgroundImage.replace(
      content.backgroundImage,
      upgradedUrl,
    );
  });
  try {
    await loadImage(upgradedUrl);
  } catch (error) {
    matchingBackgrounds.forEach(({backgroundElement, backgroundImage}) => {
      backgroundElement.style.backgroundImage = backgroundImage;
    });
    return () => {};
  }
  return () => {
    matchingBackgrounds.forEach(({backgroundElement, backgroundImage}) => {
      backgroundElement.style.backgroundImage = backgroundImage;
    });
  };
}

async function renderExactPng(
  element,
  width,
  height,
  {requireNativeSize = false} = {},
) {
  if (!element) {
    throw new Error("The Studio preview is not available for export.");
  }

  await waitForFonts();
  await waitForPreparedBrandMarks(element);
  await waitForRenderedImages(element);
  await waitForStableLayout([element]);
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    throw new Error("The Studio preview has no measurable export size.");
  }

  if (
    requireNativeSize &&
    (Math.abs(bounds.width - width) > 0.5 ||
      Math.abs(bounds.height - height) > 0.5)
  ) {
    throw new Error(
      `Studio prepared a ${Math.round(bounds.width)} × ${Math.round(bounds.height)}px preview instead of ${width} × ${height}px. Please reload Studio and try again.`,
    );
  }

  const renderedCanvas = await toCanvas(element, {
    cacheBust: true,
    includeQueryParams: true,
    pixelRatio: requireNativeSize
      ? 1
      : Math.max(width / bounds.width, height / bounds.height),
    skipAutoScale: true,
  });

  if (
    requireNativeSize &&
    (renderedCanvas.width !== width || renderedCanvas.height !== height)
  ) {
    throw new Error(
      `Studio rendered ${renderedCanvas.width} × ${renderedCanvas.height}px instead of ${width} × ${height}px. Please reload Studio and try again.`,
    );
  }

  if (
    requireNativeSize &&
    renderedCanvas.width === width &&
    renderedCanvas.height === height
  ) {
    return renderedCanvas.toDataURL("image/png");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", {alpha: false});
  if (!context) {
    throw new Error("This browser could not create the export canvas.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(renderedCanvas, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function prepareDirectoryImages(element, resolvePlanningCenterImage) {
  const images = Array.from(
    element?.querySelectorAll("img[data-studio-directory-image]") || [],
  );
  const restorers = [];
  for (const image of images) {
    const originalSource = image.getAttribute("src") || "";
    if (
      !originalSource ||
      originalSource.startsWith("data:") ||
      !originalSource.includes("groups-production.s3.amazonaws.com")
    ) {
      continue;
    }
    if (typeof resolvePlanningCenterImage !== "function") {
      throw new Error(
        "Studio could not securely prepare a Planning Center image for export.",
      );
    }
    const resolvedSource = await resolvePlanningCenterImage(originalSource);
    await loadImage(resolvedSource);
    image.setAttribute("src", resolvedSource);
    restorers.push(() => image.setAttribute("src", originalSource));
    await nextLayoutFrame();
    if (!image.complete || !image.naturalWidth) {
      throw new Error("The Planning Center image could not be prepared for export.");
    }
  }
  return () => restorers.reverse().forEach((restore) => restore());
}

export async function exportEventPng(
  project,
  element,
  {filenameBase = ""} = {},
) {
  const format = project?.content?.format || "square";
  const size = EVENT_EXPORT_SIZES[format] || EVENT_EXPORT_SIZES.square;
  const restoreBackground = await useHighResolutionBackground(
    element,
    project?.content,
    size.width,
  );
  try {
    const png = await renderExactPng(element, size.width, size.height, {
      requireNativeSize: true,
    });
    const filename = filenameBase
      ? `${filenameBase}.png`
      : `${safeFilename(project?.name, "event-promotion")}-${size.label}.png`;
    downloadDataUrl(png, filename);
    return {filename, width: size.width, height: size.height};
  } finally {
    restoreBackground();
  }
}

export async function exportCarouselZip(
  project,
  elements,
  {filenameBase = ""} = {},
) {
  const slides = [
    project?.content,
    ...(Array.isArray(project?.carouselSlides)
      ? project.carouselSlides.map((slide) => slide.content)
      : []),
  ].filter(Boolean);
  const slideElements = Array.isArray(elements) ? elements : [];
  if (
    !slides.length ||
    slideElements.length !== slides.length ||
    slideElements.some((element) => !element)
  ) {
    throw new Error(
      "Every carousel slide must finish rendering before Studio can export it.",
    );
  }

  await waitForFonts();
  await waitForStableLayout(slideElements);
  const results = [];
  const archiveFiles = [];
  const base = filenameBase || safeFilename(project?.name, "social-carousel");
  for (let index = 0; index < slides.length; index += 1) {
    const content = slides[index];
    const format = content.format || "square";
    const size = EVENT_EXPORT_SIZES[format] || EVENT_EXPORT_SIZES.square;
    const restoreBackground = await useHighResolutionBackground(
      slideElements[index],
      content,
      size.width,
    );
    try {
      const png = await renderExactPng(
        slideElements[index],
        size.width,
        size.height,
        {requireNativeSize: true},
      );
      const slideNumber = String(index + 1).padStart(2, "0");
      const filename = `${base}-s${slideNumber}-${size.label}.png`;
      archiveFiles.push({filename, dataUrl: png});
      results.push({filename, width: size.width, height: size.height});
    } finally {
      restoreBackground();
    }
  }
  const filename = filenameBase ? `${base}.zip` : `${base}-carousel.zip`;
  const archive = buildCarouselZip(archiveFiles);
  downloadBlob(new Blob([archive], {type: "application/zip"}), filename);
  return {filename, files: results, slides: results.length};
}

export async function exportPolicyPdf(
  project,
  element,
  {filenameBase = ""} = {},
) {
  const png = await renderExactPng(element, 2040, 2640);
  const filename = filenameBase
    ? `${filenameBase}.pdf`
    : `${safeFilename(project?.name, "policy-document")}.pdf`;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
    compress: true,
  });
  pdf.addImage(png, "PNG", 0, 0, 8.5, 11, undefined, "FAST");
  pdf.setProperties({
    title: project?.content?.title || project?.name || "Central Studio Policy",
    subject: "Exported from Central Studio",
    creator: "CrossPointe Central Studio",
  });
  pdf.save(filename);
  return {filename, width: 8.5, height: 11};
}

export async function exportDocumentPdf(
  project,
  elements,
  {resolvePlanningCenterImage, filenameBase = ""} = {},
) {
  const pageElements = Array.isArray(elements) ? elements : [];
  if (
    !pageElements.length ||
    pageElements.some((element) => !element)
  ) {
    throw new Error(
      "Every document page must finish rendering before Studio can export it.",
    );
  }

  await waitForFonts();
  await waitForStableLayout(pageElements);
  const filename = filenameBase
    ? `${filenameBase}.pdf`
    : `${safeFilename(project?.name, "studio-document")}.pdf`;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
    compress: true,
  });

  for (let index = 0; index < pageElements.length; index += 1) {
    if (index > 0) pdf.addPage("letter", "portrait");
    const restoreImages = await prepareDirectoryImages(
      pageElements[index],
      resolvePlanningCenterImage,
    );
    try {
      const png = await renderExactPng(pageElements[index], 2040, 2640);
      pdf.addImage(png, "PNG", 0, 0, 8.5, 11, undefined, "FAST");
    } finally {
      restoreImages();
    }
  }

  pdf.setProperties({
    title: project?.name || "Central Studio Document",
    subject: "Multi-page document exported from Central Studio",
    creator: "CrossPointe Central Studio",
  });
  pdf.save(filename);
  return {
    filename,
    width: 8.5,
    height: 11,
    pages: pageElements.length,
  };
}

function stylesheetLoad(documentTarget, href) {
  return new Promise((resolve) => {
    const link = documentTarget.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = resolve;
    documentTarget.head.appendChild(link);
  });
}

function waitForDocumentImages(documentTarget) {
  return Promise.all(
    Array.from(documentTarget.images).map((image) => {
      if (image.complete && image.naturalWidth) return Promise.resolve();
      return new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () =>
          reject(new Error("A directory image could not be prepared for printing."));
      });
    }),
  );
}

export async function openDocumentSystemPrint(
  project,
  container,
  {resolvePlanningCenterImage} = {},
) {
  if (!container) {
    throw new Error("The printable document pages are not available yet.");
  }
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Allow pop-ups for Central Studio to use System Print.");
  }
  const restoreImages = await prepareDirectoryImages(
    container,
    resolvePlanningCenterImage,
  ).catch((error) => {
    printWindow.close();
    throw error;
  });
  try {
    await waitForFonts();
    const printDocument = printWindow.document;
    printDocument.open();
    printDocument.write(
      "<!doctype html><html><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
        "</head><body class=\"studio-system-print-window\"></body></html>",
    );
    printDocument.close();
    printDocument.title = project?.name || "Central Studio Document";

    const style = printDocument.createElement("style");
    style.textContent = `
      @page { size: letter; margin: 0; }
      html, body {
        width: 8.5in !important;
        min-height: 11in !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      [data-studio-document-print] {
        position: static !important;
        display: block !important;
        width: 8.5in !important;
        gap: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      [data-studio-document-print] > article {
        width: 8.5in !important;
        height: 11in !important;
        margin: 0 !important;
        break-after: page;
        page-break-after: always;
        box-shadow: none !important;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      [data-studio-document-print] > article:last-child {
        break-after: auto;
        page-break-after: auto;
      }
    `;
    printDocument.head.appendChild(style);

    const studioFontCss = document.getElementById(
      "studio-web-fonts",
    )?.textContent;
    if (studioFontCss) {
      const fontStyle = printDocument.createElement("style");
      fontStyle.textContent = studioFontCss;
      printDocument.head.appendChild(fontStyle);
    }

    const stylesheetUrls = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]'),
    ).map((link) => link.href);
    const stylesheetReady = Promise.all(
      stylesheetUrls.map((href) => stylesheetLoad(printDocument, href)),
    );
    const printablePages = container.cloneNode(true);
    printablePages.removeAttribute("aria-hidden");
    printDocument.body.appendChild(printablePages);

    await stylesheetReady;
    if (printDocument.fonts?.ready) await printDocument.fonts.ready;
    await waitForDocumentImages(printDocument);
    await new Promise((resolve) =>
      printWindow.requestAnimationFrame(() =>
        printWindow.requestAnimationFrame(resolve),
      ),
    );
    printWindow.addEventListener("afterprint", () => printWindow.close(), {
      once: true,
    });
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    printWindow.close();
    throw error;
  } finally {
    restoreImages();
  }
}
