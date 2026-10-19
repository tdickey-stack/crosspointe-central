#!/usr/bin/env python3
"""Extract the MOVIES E as a transparent, registration-matched foreground.

Run from any directory: python3 scripts/build-catm-logo-layer.py
The original logo remains untouched. Paths are zero-indexed in document order.
"""

from pathlib import Path
import re
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/CATM_LOGO.svg"
DESTINATION = ROOT / "public/catm-logo-e-overlay.svg"
NS = "{http://www.w3.org/2000/svg}"


def main():
    source = ET.parse(SOURCE).getroot()
    paths = list(source.iter(f"{NS}path"))
    styles = source.find(f"{NS}defs/{NS}style").text
    assert source.get("viewBox") == "0 0 646.95 410.02"
    assert paths[1867].get("d").startswith("M477.3,296.61v-74.26")
    assert paths[1868].get("d").startswith("M526.57,298.11h-49.28")

    # Illustrator united the E and S extrusions into one subpath. Retain the
    # original E contour, removing the S detour. Join its two attachment points
    # with the E's right vertical edge, entirely under its cream outline.
    compound = paths[1858].get("d")
    shared = re.search(r"M473\.54,301\.69[^M]+", compound).group()
    before, detour = shared.split("v-3.03", 1)
    _, after = detour.split("v-12.09", 1)
    shadow = before + "v-18.32" + after
    assert shadow.endswith("v74.26Z")

    def color(index):
        class_name = paths[index].get("class")
        return re.search(r"\." + class_name + r"\{fill:([^;]+);", styles)[1]

    ET.register_namespace("", NS[1:-1])
    overlay = ET.Element(f"{NS}svg", {"viewBox": source.get("viewBox")})
    ET.SubElement(overlay, f"{NS}title").text = "MOVIES E foreground layer"
    ET.SubElement(overlay, f"{NS}desc").text = (
        "Extracted from CATM_LOGO.svg paths 1858 (E-only shadow contour), "
        "1867 (fill), and 1868 (outline). Same viewBox as the original logo."
    )
    ET.SubElement(overlay, f"{NS}path", {
        "id": "e-shadow", "fill": color(1858), "d": shadow,
    })
    for index, name in [(1867, "e-fill"), (1868, "e-outline")]:
        ET.SubElement(overlay, f"{NS}path", {
            "id": name, "fill": color(index), "d": paths[index].get("d"),
        })
    ET.indent(overlay, space="  ")
    ET.ElementTree(overlay).write(DESTINATION, encoding="utf-8", xml_declaration=True)
    print(DESTINATION)


if __name__ == "__main__":
    main()
