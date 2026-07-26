export function normalizeFocalValue(value, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, Math.round(number * 10) / 10))
    : fallback;
}

export function normalizeImageZoom(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(2, Math.max(1, Math.round(number * 100) / 100))
    : fallback;
}

export function focalMediaStyle(content) {
  const focalX = normalizeFocalValue(content?.focalX);
  const focalY = normalizeFocalValue(content?.focalY);
  const imageZoom = normalizeImageZoom(content?.imageZoom);
  const maximumPan = ((imageZoom - 1) / (2 * imageZoom)) * 100;
  const panX =
    Math.round(((50 - focalX) / 50) * maximumPan * 10000) / 10000;
  const panY =
    Math.round(((50 - focalY) / 50) * maximumPan * 10000) / 10000;

  return {
    backgroundImage: `url("${content?.backgroundImage || ""}")`,
    backgroundPosition: `${focalX}% ${focalY}%`,
    transform: `scale(${imageZoom}) translate3d(${panX}%, ${panY}%, 0)`,
  };
}
