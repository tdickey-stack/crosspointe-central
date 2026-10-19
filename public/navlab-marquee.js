const SVG_NS = "http://www.w3.org/2000/svg";
const observed = new Set();
let observer;

function draw(svg, width, height) {
  if (width < 40 || height < 40) return;
  const inset = 11;
  const outerRadius = parseFloat(getComputedStyle(svg.parentElement).borderTopLeftRadius) || 0;
  const radius = Math.max(0, Math.min(outerRadius - inset - 2, width / 2 - inset, height / 2 - inset));
  const left = inset, right = width - inset, top = inset, bottom = height - inset;
  const diagonal = radius * (1 - Math.SQRT1_2);
  const corners = [
    [left + diagonal, top + diagonal], [right - diagonal, top + diagonal],
    [right - diagonal, bottom - diagonal], [left + diagonal, bottom - diagonal],
  ];
  const tangents = [
    [[left + radius, top], [right - radius, top]],
    [[right, top + radius], [right, bottom - radius]],
    [[right - radius, bottom], [left + radius, bottom]],
    [[left, bottom - radius], [left, top + radius]],
  ];
  const bulbs = document.createDocumentFragment();
  corners.forEach((start, side) => {
    const end = corners[(side + 1) % 4];
    const [a, b] = tangents[side];
    const path = document.createElementNS(SVG_NS, "path");
    const arc = (point) => radius ? `A ${radius} ${radius} 0 0 1 ${point}` : `L ${point}`;
    path.setAttribute("d", `M ${start} ${arc(a)} L ${b} ${arc(end)}`);
    const length = path.getTotalLength();
    const intervals = Math.max(1, Math.round(length / 28));
    // Each side owns its starting corner only: no overlapping endpoint bulbs.
    for (let index = 0; index < intervals; index++) {
      const point = path.getPointAtLength(length * index / intervals);
      const bulb = document.createElementNS(SVG_NS, "circle");
      bulb.setAttribute("cx", point.x);
      bulb.setAttribute("cy", point.y);
      bulb.setAttribute("r", "2");
      bulbs.append(bulb);
    }
  });
  svg.replaceChildren(bulbs);
}

export function createMarquee() {
  if (!observer) observer = new ResizeObserver((entries) => {
    for (const {target, contentRect} of entries) {
      if (target.isConnected) draw(target, contentRect.width, contentRect.height);
    }
  });
  for (const previous of observed) {
    if (!previous.isConnected) {observer.unobserve(previous); observed.delete(previous);}
  }
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("navlab-marquee");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  observed.add(svg);
  observer.observe(svg);
  return svg;
}
