# Groups embed fonts

These browser-ready Latin variable fonts are self-hosted for the public Groups
embed. They were resolved from the official Google Fonts CSS API on
2026-09-16 and downloaded from `fonts.gstatic.com` without modification.

| Asset | Google Fonts family | Style | Weight range | Stretch | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `google-sans-flex-v22-latin-wght-400-800.woff2` | Google Sans Flex | normal | 400 800 | 100% | `b0b46b4937ac6d9117c2a840ad8044b32e7bd3ca9bde00ba0bc5495278a0ba9d` |
| `league-spartan-v15-latin-wght-600-800.woff2` | League Spartan | normal | 600 800 | normal | `bf980237df2699b573fb9360bf10ee5d3adc2a3c90bc20a8115b6b344a4769ae` |

Source CSS request:

`https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@400..800&family=League+Spartan:wght@600..800&display=swap`

The resolved upstream files were Google Sans Flex v22 and League Spartan v15.
Both families use the SIL Open Font License 1.1. The corresponding
license texts are stored beside the fonts.

Resolved asset URLs:

- Google Sans Flex: `https://fonts.gstatic.com/s/googlesansflex/v22/t5sEIQcYNIWbFgDgAAzZ34auoVyXkJCOvp3SFWJbN5hF8Ju1x6sKCyp0l9sI40swNJwInycYAJzz0m7kJ4qFQOJBOjLvDSndo0SKMpKSTzwliVdHAy4bxTDHg_ugnAakp8ubq8BIo1pdkkXZj4j1dvKMDV-NG2sP.woff2`
- League Spartan: `https://fonts.gstatic.com/s/leaguespartan/v15/kJEqBuEW6A0lliaV_m88ja5TwvZwLZmXD4Zh.woff2`

For `FontFace` loading, use unique embed-local family names so a customer site's
fonts cannot satisfy or override these faces. The source descriptors are:

```js
new FontFace("Central Groups Google Sans Flex", fontUrl, {
  style: "normal",
  weight: "400 800",
  stretch: "100%",
  display: "swap",
  unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
});

new FontFace("Central Groups League Spartan", fontUrl, {
  style: "normal",
  weight: "600 800",
  display: "swap",
  unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
});
```

Fonts loaded from Central into a page on another origin require these response
headers:

```text
Access-Control-Allow-Origin: *
Content-Type: font/woff2
Cross-Origin-Resource-Policy: cross-origin
Cache-Control: public, max-age=31536000, immutable
```

`Access-Control-Allow-Origin` and the WOFF2 content type are required for the
cross-origin font load. `Cross-Origin-Resource-Policy` also permits use by pages
that enable cross-origin isolation. The versioned filenames make the immutable
cache policy safe; replace the filename when updating an asset.

License wording is preserved; line endings and trailing whitespace are normalized.
