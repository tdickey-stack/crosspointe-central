import {toPng} from "html-to-image";
import {jsPDF} from "jspdf";

const EVENT_EXPORT_SIZES = {
  square: {width: 2160, height: 2160, label: "1x1"},
  portrait: {width: 2160, height: 2700, label: "4x5"},
  screen: {width: 3840, height: 2160, label: "16x9"},
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
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
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
  const backgroundElement =
    element.querySelector(".event-background-media") || element;
  const previousBackground = backgroundElement.style.backgroundImage;
  if (!upgradedUrl || !previousBackground.includes(content.backgroundImage)) {
    return () => {};
  }
  backgroundElement.style.backgroundImage = previousBackground.replace(
    content.backgroundImage,
    upgradedUrl,
  );
  try {
    await loadImage(upgradedUrl);
  } catch (error) {
    backgroundElement.style.backgroundImage = previousBackground;
    return () => {};
  }
  return () => {
    backgroundElement.style.backgroundImage = previousBackground;
  };
}

async function renderExactPng(element, width, height) {
  if (!element) {
    throw new Error("The Studio preview is not available for export.");
  }

  await waitForFonts();
  const bounds = element.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    throw new Error("The Studio preview has no measurable export size.");
  }

  const renderedDataUrl = await toPng(element, {
    cacheBust: true,
    includeQueryParams: true,
    pixelRatio: Math.max(width / bounds.width, height / bounds.height),
    skipAutoScale: true,
  });
  const renderedImage = await loadImage(renderedDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", {alpha: false});
  if (!context) {
    throw new Error("This browser could not create the export canvas.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(renderedImage, 0, 0, width, height);
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

export async function exportEventPng(project, element) {
  const format = project?.content?.format || "square";
  const size = EVENT_EXPORT_SIZES[format] || EVENT_EXPORT_SIZES.square;
  const restoreBackground = await useHighResolutionBackground(
    element,
    project?.content,
    size.width,
  );
  try {
    const png = await renderExactPng(element, size.width, size.height);
    const filename = `${safeFilename(project?.name, "event-promotion")}-${size.label}.png`;
    downloadDataUrl(png, filename);
    return {filename, width: size.width, height: size.height};
  } finally {
    restoreBackground();
  }
}

export async function exportPolicyPdf(project, element) {
  const png = await renderExactPng(element, 2040, 2640);
  const filename = `${safeFilename(project?.name, "policy-document")}.pdf`;
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
