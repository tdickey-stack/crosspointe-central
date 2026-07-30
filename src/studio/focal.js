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

export function normalizeImageOpacity(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(1, Math.max(0, Math.round(number * 100) / 100))
    : fallback;
}

export function normalizeImageRotation(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(360, Math.max(0, Math.round(number)))
    : fallback;
}

export function imageRotationCoverScale(format, rotation) {
  const [width, height] =
    {
      portrait: [4, 5],
      screen: [16, 9],
      square: [1, 1],
    }[format] || [1, 1];
  const radians = (normalizeImageRotation(rotation) * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const scale = Math.max(
    cosine + (height / width) * sine,
    cosine + (width / height) * sine,
  );
  return Math.round(scale * 1000000) / 1000000;
}

export function focalMediaStyle(content) {
  const focalX = normalizeFocalValue(content?.focalX);
  const focalY = normalizeFocalValue(content?.focalY);
  const imageZoom = normalizeImageZoom(content?.imageZoom);
  const imageRotation = normalizeImageRotation(
    content?.backgroundImageRotation,
  );
  const rotationCoverScale = imageRotationCoverScale(
    content?.format,
    imageRotation,
  );
  const renderedScale =
    Math.round(imageZoom * rotationCoverScale * 1000000) / 1000000;
  const maximumPan = ((imageZoom - 1) / (2 * imageZoom)) * 100;
  const panX =
    Math.round(((50 - focalX) / 50) * maximumPan * 10000) / 10000;
  const panY =
    Math.round(((50 - focalY) / 50) * maximumPan * 10000) / 10000;

  return {
    backgroundImage: `url("${content?.backgroundImage || ""}")`,
    backgroundPosition: `${focalX}% ${focalY}%`,
    opacity: normalizeImageOpacity(content?.backgroundImageOpacity),
    transform: `rotate(${imageRotation}deg) scale(${renderedScale}) translate3d(${panX}%, ${panY}%, 0)`,
  };
}
