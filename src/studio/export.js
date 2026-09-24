import {toCanvas} from "html-to-image";
import {jsPDF} from "jspdf";

import {buildCarouselZip} from "./carousel-archive.js";
import {validateCreativeFilenameForExport} from "./creative-filename.js";

const RESOURCE_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 5000;
const RENDER_TIMEOUT_MS = 20000;

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

export function waitForPromiseWithTimeout(
  promise,
  timeoutMs = RESOURCE_TIMEOUT_MS,
  message = "Studio timed out while preparing an export resource.",
) {
  let timeout;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve, reject) => {
      timeout = globalThis.setTimeout(
        () => reject(new Error(message)),
        timeoutMs,
      );
    }),
  ]).finally(() => globalThis.clearTimeout(timeout));
}

export async function waitForFonts() {
  if (window.CENTRAL_STUDIO_FONT_CSS_ERROR && window.CENTRAL_STUDIO_RELOAD_FONT_CSS) {
    window.CENTRAL_STUDIO_RELOAD_FONT_CSS();
  }
  if (window.CENTRAL_STUDIO_FONT_CSS_READY) {
    await waitForPromiseWithTimeout(
      window.CENTRAL_STUDIO_FONT_CSS_READY,
      RESOURCE_TIMEOUT_MS,
      "Studio timed out while loading the approved fonts. Check your connection and try again.",
    );
    if (window.CENTRAL_STUDIO_FONT_CSS_ERROR) {
      throw new Error(
        "Studio could not load the approved fonts. Check your connection and try again.",
      );
    }
  }
  if (document.fonts && document.fonts.ready) {
    await waitForPromiseWithTimeout(
      document.fonts.ready,
      RESOURCE_TIMEOUT_MS,
      "Studio timed out while preparing the approved fonts. Check your connection and try again.",
    );
  }
}

function nextLayoutFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function waitForLayoutFrame(
  timeoutMs = RESOURCE_TIMEOUT_MS,
  message = "Studio timed out while applying an export image. Please try again.",
) {
  return waitForPromiseWithTimeout(nextLayoutFrame(), timeoutMs, message);
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
        element.querySelectorAll("[data-auto-fit-lines], [data-auto-fit-scale]"),
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
  throw new Error(
    "Studio layout is still changing. Wait a moment and try the export again.",
  );
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

export function waitForImageElement(
  image,
  {
    timeoutMs = IMAGE_TIMEOUT_MS,
    failureMessage = "A Studio image could not be prepared for export.",
    timeoutMessage = "A Studio image is still loading. Please try the export again.",
  } = {},
) {
  if (image.complete) {
    return image.naturalWidth
      ? Promise.resolve(image)
      : Promise.reject(new Error(failureMessage));
  }
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      if (!image.naturalWidth) {
        reject(new Error(failureMessage));
        return;
      }
      resolve(image);
    };
    const handleError = () => {
      cleanup();
      reject(new Error(failureMessage));
    };
    image.addEventListener("load", handleLoad, {once: true});
    image.addEventListener("error", handleError, {once: true});
    if (image.complete) {
      if (image.naturalWidth) handleLoad();
      else handleError();
    }
  });
}

async function waitForRenderedImages(element, timeoutMs = IMAGE_TIMEOUT_MS) {
  const images = [...element.querySelectorAll("img")];
  await Promise.all(
    images.map((image) => waitForImageElement(image, {timeoutMs})),
  );
}

function loadImage(dataUrl, timeoutMs = IMAGE_TIMEOUT_MS) {
  const image = new Image();
  image.src = dataUrl;
  return waitForImageElement(image, {
    timeoutMs,
    failureMessage: "The rendered preview could not be loaded.",
    timeoutMessage: "The rendered preview took too long to load.",
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

function studioLayoutError(element) {
  if (!element) return "";
  const marker = element.dataset?.studioLayoutError ||
    element.querySelector?.("[data-studio-layout-error]")?.dataset
      ?.studioLayoutError || "";
  return marker === "true"
    ? "Page content exceeds the printable area. Shorten the content before exporting."
    : marker;
}

export function assertStudioLayoutReady(elements) {
  const list = Array.isArray(elements) ? elements : [elements];
  for (const element of list) {
    const layoutError = studioLayoutError(element);
    if (layoutError) throw new Error(layoutError);
  }
}

async function prepareElementForExport(
  element,
  {waitForFontResources = true} = {},
) {
  if (!element) {
    throw new Error("The Studio preview is not available for export.");
  }
  if (waitForFontResources) await waitForFonts();
  await waitForPromiseWithTimeout(
    waitForPreparedBrandMarks(element),
    RESOURCE_TIMEOUT_MS,
    "The selected CrossPointe logo took too long to prepare. Please try the export again.",
  );
  await waitForRenderedImages(element);
  await waitForPromiseWithTimeout(
    waitForStableLayout([element]),
    RESOURCE_TIMEOUT_MS,
    "Studio timed out while preparing the export layout. Please try again.",
  );
  assertStudioLayoutReady(element);
}

async function renderExactCanvas(
  element,
  width,
  height,
  {requireNativeSize = false, prepared = false} = {},
) {
  if (!element) {
    throw new Error("The Studio preview is not available for export.");
  }

  if (!prepared) await prepareElementForExport(element);
  else assertStudioLayoutReady(element);
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

  const renderedCanvas = await waitForPromiseWithTimeout(
    toCanvas(element, {
      cacheBust: true,
      includeQueryParams: true,
      pixelRatio: requireNativeSize
        ? 1
        : Math.max(width / bounds.width, height / bounds.height),
      skipAutoScale: true,
    }),
    RENDER_TIMEOUT_MS,
    "Studio timed out while rendering the export. Check the images and try again.",
  );

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
    return renderedCanvas;
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
  return canvas;
}

export function canvasToPngBlob(canvas, timeoutMs = RENDER_TIMEOUT_MS) {
  return waitForPromiseWithTimeout(
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Studio could not create the exported PNG."));
      }, "image/png");
    }),
    timeoutMs,
    "Studio timed out while creating the exported PNG. Please try again.",
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function prepareDirectoryImages(element, resolvePlanningCenterImage) {
  const images = Array.from(
    element?.querySelectorAll("img[data-studio-directory-image]") || [],
  );
  const restorers = [];
  try {
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
      const resolvedSource = await waitForPromiseWithTimeout(
        resolvePlanningCenterImage(originalSource),
        RESOURCE_TIMEOUT_MS,
        "Studio timed out while securely preparing a Planning Center image.",
      );
      await loadImage(resolvedSource);
      image.setAttribute("src", resolvedSource);
      restorers.push(() => image.setAttribute("src", originalSource));
      await waitForImageElement(image, {
        failureMessage:
          "The Planning Center image could not be prepared for export.",
        timeoutMessage:
          "The Planning Center image is still loading. Please try the export again.",
      });
      await waitForLayoutFrame(
        RESOURCE_TIMEOUT_MS,
        "Studio timed out while applying a Planning Center image. Please try again.",
      );
    }
  } catch (error) {
    restorers.reverse().forEach((restore) => restore());
    throw error;
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
  const validatedFilenameBase = filenameBase
    ? validateCreativeFilenameForExport(filenameBase, {extension: "png"})
    : "";
  assertStudioLayoutReady(element);
  const restoreBackground = await useHighResolutionBackground(
    element,
    project?.content,
    size.width,
  );
  try {
    const canvas = await renderExactCanvas(element, size.width, size.height, {
      requireNativeSize: true,
    });
    const png = await canvasToPngBlob(canvas);
    const filename = validatedFilenameBase
      ? `${validatedFilenameBase}.png`
      : `${safeFilename(project?.name, "event-promotion")}-${size.label}.png`;
    downloadBlob(png, filename);
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

  const results = [];
  const archiveFiles = [];
  const validatedFilenameBase = filenameBase
    ? validateCreativeFilenameForExport(filenameBase, {
        extension: "png",
        carousel: true,
        formatLabel:
          (EVENT_EXPORT_SIZES[slides[0]?.format] || EVENT_EXPORT_SIZES.square)
            .label,
      })
    : "";
  if (validatedFilenameBase) {
    slides.forEach((content) => {
      const size =
        EVENT_EXPORT_SIZES[content.format] || EVENT_EXPORT_SIZES.square;
      validateCreativeFilenameForExport(validatedFilenameBase, {
        extension: "png",
        carousel: true,
        formatLabel: size.label,
      });
    });
  }
  const base =
    validatedFilenameBase || safeFilename(project?.name, "social-carousel");
  assertStudioLayoutReady(slideElements);
  await waitForFonts();
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
      await prepareElementForExport(slideElements[index], {
        waitForFontResources: false,
      });
      const canvas = await renderExactCanvas(
        slideElements[index],
        size.width,
        size.height,
        {requireNativeSize: true, prepared: true},
      );
      const png = await canvasToPngBlob(canvas);
      const slideNumber = String(index + 1).padStart(2, "0");
      const filename = `${base}-s${slideNumber}-${size.label}.png`;
      archiveFiles.push({
        filename,
        bytes: new Uint8Array(await png.arrayBuffer()),
      });
      results.push({filename, width: size.width, height: size.height});
    } finally {
      restoreBackground();
    }
  }
  const filename = validatedFilenameBase
    ? `${base}.zip`
    : `${base}-carousel.zip`;
  const archive = buildCarouselZip(archiveFiles);
  downloadBlob(new Blob([archive], {type: "application/zip"}), filename);
  return {filename, files: results, slides: results.length};
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

  const validatedFilenameBase = filenameBase
    ? validateCreativeFilenameForExport(filenameBase, {extension: "pdf"})
    : "";
  assertStudioLayoutReady(pageElements);
  await waitForFonts();
  const filename = validatedFilenameBase
    ? `${validatedFilenameBase}.pdf`
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
      await prepareElementForExport(pageElements[index], {
        waitForFontResources: false,
      });
      const canvas = await renderExactCanvas(pageElements[index], 2040, 2640, {
        prepared: true,
      });
      pdf.addImage(canvas, "PNG", 0, 0, 8.5, 11, undefined, "FAST");
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

function stylesheetLoad(documentTarget, href, timeoutMs = RESOURCE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const link = documentTarget.createElement("link");
    const timeout = globalThis.setTimeout(() => {
      cleanup();
      link.remove();
      reject(new Error("Studio timed out while preparing the print styles."));
    }, timeoutMs);
    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      link.onload = null;
      link.onerror = null;
    };
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => {
      cleanup();
      resolve();
    };
    link.onerror = () => {
      cleanup();
      reject(new Error("Studio could not load the print styles."));
    };
    documentTarget.head.appendChild(link);
  });
}

export function waitForDocumentImages(
  documentTarget,
  timeoutMs = IMAGE_TIMEOUT_MS,
) {
  return Promise.all(
    Array.from(documentTarget.images).map((image) =>
      waitForImageElement(image, {
        timeoutMs,
        failureMessage: "A directory image could not be prepared for printing.",
        timeoutMessage:
          "A directory image is still loading. Please try System Print again.",
      }),
    ),
  );
}

export async function openDocumentSystemPrint(
  project,
  container,
  {resolvePlanningCenterImage, printWindow: providedPrintWindow} = {},
) {
  if (!container) {
    providedPrintWindow?.close();
    throw new Error("The printable document pages are not available yet.");
  }
  const printWindow = providedPrintWindow || window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Allow pop-ups for Central Studio to use System Print.");
  }
  const sourcePages = Array.from(container.children);
  if (!sourcePages.length) {
    printWindow.close();
    throw new Error("Every document page must finish rendering before Studio can print it.");
  }
  try {
    assertStudioLayoutReady(sourcePages);
  } catch (error) {
    printWindow.close();
    throw error;
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
    await waitForPromiseWithTimeout(
      waitForStableLayout(sourcePages),
      RESOURCE_TIMEOUT_MS,
      "Studio timed out while preparing the print layout. Please try again.",
    );
    assertStudioLayoutReady(sourcePages);
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
    if (printDocument.fonts?.ready) {
      await waitForPromiseWithTimeout(
        printDocument.fonts.ready,
        RESOURCE_TIMEOUT_MS,
        "Studio timed out while preparing the approved fonts for printing.",
      );
    }
    await waitForDocumentImages(printDocument);
    await waitForPromiseWithTimeout(
      new Promise((resolve) =>
        printWindow.requestAnimationFrame(() =>
          printWindow.requestAnimationFrame(resolve),
        ),
      ),
      RESOURCE_TIMEOUT_MS,
      "Studio timed out while preparing the print layout. Please try again.",
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
