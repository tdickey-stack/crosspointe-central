# qrcode-generator 2.0.4

This directory vendors the JavaScript distribution of Kazuhiko Arase's
`qrcode-generator` release `js2.0.4` for deterministic offline Print Mode QR
generation.

- Project: https://github.com/kazuhikoarase/qrcode-generator
- Release: https://github.com/kazuhikoarase/qrcode-generator/releases/tag/js2.0.4
- Encoder source: https://github.com/kazuhikoarase/qrcode-generator/blob/js2.0.4/js/dist/qrcode.js
- UTF-8 adapter: https://github.com/kazuhikoarase/qrcode-generator/blob/js2.0.4/js/dist/qrcode_UTF8.js
- License: MIT; see `LICENSE`

`public/print-mode-qr.js` bundles the unmodified encoder and UTF-8 adapter,
followed by CrossPointe's URL validation, bounded cache, and inline SVG wrapper.
The browser therefore loads only `/print-mode-qr.js` before `/admin.js`.
