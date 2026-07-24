module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2018,
    "sourceType": "module",
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
  },
  overrides: [
    {
      files: [
        "wayfinder/**/*.js",
        "scripts/wayfinder-bundles.js",
        "studio/**/*.js",
        "scripts/generate-studio-image.mjs",
        "scripts/refine-studio-image.mjs",
      ],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      rules: {
        "require-jsdoc": "off",
      },
    },
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
