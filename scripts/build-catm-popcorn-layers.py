#!/usr/bin/env python3
"""Extract editable layers from the canonical flattened SVG, without changing paths.

Coordinates and source path order inside each layer remain canonical. The optional
interior is an inferred surface behind the unchanged front rim; it is invisible
in the completed art. No image generation or raster asset conversion is used.
"""
from pathlib import Path
import copy
import colorsys
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
def tag(name): return '{'+NS+'}'+name

def bounds(d):
    """Conservative bounds including control points for this trace's commands."""
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', d)
    i = 0; x = y = 0; start = (0, 0); points = []
    while i < len(tokens):
        if tokens[i].isalpha(): command = tokens[i]; i += 1
        if command == 'Z':
            x, y = start; points.append((x, y)); continue
        count = {'M':2, 'l':2, 'h':1, 'v':1, 'c':6, 's':4, 'q':4}[command]
        values = list(map(float, tokens[i:i+count])); i += count
        if command == 'M': x, y = values; start = (x, y)
        elif command == 'l': x += values[0]; y += values[1]
        elif command == 'h': x += values[0]
        elif command == 'v': y += values[0]
        elif command == 'c':
            points += [(x+values[0], y+values[1]), (x+values[2], y+values[3])]
            x += values[4]; y += values[5]
        elif command in ('s', 'q'):
            points.append((x+values[0], y+values[1])); x += values[2]; y += values[3]
        points.append((x, y))
    xs, ys = zip(*points)
    return min(xs), min(ys), max(xs), max(ys)

source = ET.parse(ROOT/'public/LoaderPopcornBucket.svg').getroot()
art = ET.Element(tag('svg'), {'id':'catm-popcorn-art', 'viewBox':source.get('viewBox'),
    'data-pile-bounds':'30.4 38.66 342.37 164.33', 'data-rim-y':'202',
    'data-foliage-pivot':'103 235', 'data-ticket-center':'289.15 63.03'})
defs = copy.deepcopy(source.find(tag('defs'))); art.append(defs)
style = defs.find(tag('style'))
# Prefix classes so inlining this SVG cannot restyle neighboring page SVGs.
style.text = re.sub(r'\.cls-(\d+)', r'.catm-art-\1', style.text)
fills = {}
for selectors, declarations in re.findall(r'([^{}]+)\{([^}]+)\}', style.text):
    fill = re.search(r'fill:(#[0-9a-f]+)', declarations)
    if fill:
        for selector in selectors.split(','): fills[selector.lstrip('.')] = fill.group(1)
paths = list(source.find(tag('g')))
for index, path in enumerate(paths):
    path.set('class', path.get('class').replace('cls-', 'catm-art-'))
    path.set('data-source-index', str(index))

# Ticket outline, paper, border, type, and fine trace details.
TICKET = {3, 201, 505, 737, *range(828, 841), *range(868, 872)}
# Canonical rim and bow details that cross the pile's coordinate bounds.
FOREGROUND = {0, 7, 16, 21, 27, 28, 49, 53, 72, 76, 88, 96, 102,
              115, 117, 125, 135, 231, 232, 233, 281, 284, 301, 302,
              303, 304, 305, 306, 308, 309, 378, 407, 408}
# Berry bodies, outlines and highlights are spatially interleaved with leaves.
# Explicit source indices keep bucket stripes and red ribbon tails stationary.
BERRIES = {8, 9, 149, 150, 234, 235, 242, 243, 244, 249, 250, 251,
    328, 340, 344, 356, 425, 447, 448, 455, 457, 465, 562, 569,
    *range(583, 596), 656, 658, 659, 704, 708, 710, 803, 804, 811, 813, 865}
groups = {name:ET.Element(tag('g'), {'id':'catm-'+name}) for name in ('ticket', 'pile', 'bucket')}
layer_by_index = {}
for index, path in enumerate(paths):
    x, y, right, bottom = bounds(path.get('d'))
    fill = fills.get(path.get('class'), '#000000')
    if len(fill) == 4: fill = '#' + ''.join(c*2 for c in fill[1:])
    red, green, blue = (int(fill[n:n+2], 16) for n in (1,3,5))
    ribbon = red > green*1.7 and green < blue*1.55 and red > 40
    name = 'ticket' if index in TICKET else 'bucket' if (
        index in FOREGROUND or bottom > 206 or ribbon
    ) else 'pile'
    hue, saturation, _ = colorsys.rgb_to_hsv(red/255, green/255, blue/255)
    foliage_color = (45 <= hue*360 <= 175 and saturation > .22)
    foliage_region = (x >= 0 and y >= 232 and right <= 187 and bottom <= 475)
    if index in BERRIES or (foliage_region and foliage_color and index != 147):
        path.set('data-catm-detail', 'foliage')
    groups[name].append(path)
    layer_by_index[index] = name

interior = ET.SubElement(art, tag('g'), {'id':'catm-interior', 'opacity':'0'})
ET.SubElement(interior, tag('path'), {'d':'M42 177 C42 142 366 142 366 177 C359 213 63 213 42 177Z',
    'fill':'#5b3018', 'stroke':'#4a2310', 'stroke-width':'3'})
ET.SubElement(interior, tag('path'), {'d':'M42 177 C42 142 366 142 366 177',
    'fill':'none', 'stroke':'#fcefc5', 'stroke-width':'8'})
ET.SubElement(interior, tag('path'), {'d':'M46 178 C50 150 359 150 362 178',
    'fill':'none', 'stroke':'#bf7b2a', 'stroke-width':'2'})
# Consecutive runs retain painter order, including antialiased touching edges.
seen = set(); previous = None
for index, path in enumerate(paths):
    name = layer_by_index[index]
    if name != previous:
        attrs = {'data-catm-layer':name}
        if name not in seen: attrs['id'] = 'catm-'+name; seen.add(name)
        run = ET.SubElement(art, tag('g'), attrs)
        previous = name
    run.append(path)

# A detached ticket can emerge, grow and land without changing canonical paths.
ticket_sprite = ET.SubElement(defs, tag('symbol'), {
    'id':'catm-ticket-sprite', 'viewBox':source.get('viewBox'),
    'data-bounds':'222.89 -0.22 132.51 126.5', 'data-center':'289.15 63.03'})
# Rebuild only paper concealed by the popcorn in the source. Upper source
# artwork remains above this extension. An open outline avoids an artificial
# seam along the old occlusion boundary.
extension = ET.SubElement(ticket_sprite, tag('g'), {
    'data-catm-ticket-part':'concealed-paper', 'transform':'translate(249 -3) rotate(20)'})
left = ['M0 68']
for y in range(68, 132, 8):
    left.append(f'L0 {y+1} C2 {y+2} 2 {y+4} 0 {y+5} L0 {y+8}')
left.append('C10 136 18 144 18 154')
for x in range(18, 98, 10):
    left.append(f'L{x+2} 154 C{x+4} 152 {x+6} 152 {x+8} 154')
left.append('L101 154 C101 144 109 136 119 136')
for y in range(136, 96, -8):
    left.append(f'L119 {y-1} C117 {y-2} 117 {y-4} 119 {y-5} L119 {y-8}')
outline = ' '.join(left)
# Continue the two traced side edges without duplicating their cut endpoints.
# The source outline is retained above this construction seam.
extension.set('transform', 'translate(249 -3) rotate(20) translate(2 0) scale(.96 1)')
upper_ticket_clip = ET.SubElement(defs, tag('clipPath'), {'id':'catm-ticket-upper-clip'})
ET.SubElement(upper_ticket_clip, tag('path'), {
    'd':'M-20 -20H140V98H60V70H-20Z', 'transform':'translate(249 -3) rotate(20)'})
ET.SubElement(extension, tag('path'), {'d':outline+' L119 68Z', 'fill':'#f0b54f'})
ET.SubElement(extension, tag('path'), {'d':outline, 'fill':'none',
    'stroke':'#4a250f', 'stroke-width':'2', 'stroke-linecap':'round', 'stroke-linejoin':'round'})
# Match the original inset paper tone and continue its lower inset border.
ET.SubElement(ticket_sprite, tag('path'), {
    'data-catm-ticket-part':'concealed-inset',
    'd':'M240 71 L318 99 L300.4 152.7 C296.1 152.4 292.6 153.8 289.6 157.3 '
        'L227.6 135.4 C227.2 131 225.4 128 221.2 126.3Z', 'fill':'#eeb24d'})
ET.SubElement(ticket_sprite, tag('path'), {
    'data-catm-ticket-part':'concealed-frame',
    'd':'M237.1 79.55 L221.2 126.3 C225.4 128 227.2 131 227.6 135.4 '
        'L289.6 157.3 C292.6 153.8 296.1 152.4 300.4 152.7 L311.45 118.48',
    'fill':'none', 'stroke':'#2d160d', 'stroke-width':'1.8', 'stroke-linejoin':'round'})
ticket_sprite.set('data-bounds', '204 -0.22 152 178')
for index in sorted(TICKET):
    sprite_path = copy.deepcopy(paths[index]); sprite_path.attrib.pop('data-source-index', None)
    if index in (3, 201): sprite_path.set('clip-path', 'url(#catm-ticket-upper-clip)')
    ticket_sprite.append(sprite_path)

# Kernel sprites use extracted canonical contour, shading, and highlight paths.
# Their local viewBoxes allow use width/height without a coordinate transform.
kernels = [
    ((154, 38, 72, 57), [208, 209, 210, 213, 245, 550, 551, 582]),
    ((137, 76, 62, 63), [612, 623, 798, 799, 800]),
    ((188, 156, 70, 49), [614, 680, 788]),
]
for number, (box, indices) in enumerate(kernels, 1):
    symbol = ET.SubElement(defs, tag('symbol'), {'id':f'catm-kernel-{number}',
        'viewBox':' '.join(map(str, box)), 'data-width':str(box[2]), 'data-height':str(box[3])})
    for index in indices:
        sprite_path = copy.deepcopy(paths[index]); sprite_path.attrib.pop('data-source-index', None)
        symbol.append(sprite_path)

ET.indent(art, space='  ')
ET.ElementTree(art).write(ROOT/'public/catm-popcorn-layered.svg', encoding='utf-8', xml_declaration=True)
print({name:len(group) for name,group in groups.items()})
