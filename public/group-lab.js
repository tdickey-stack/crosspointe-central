import {mountGroupDirectory} from "./group-directory.js";

// Only the standalone lab owns document-wide initialization. Importing the
// reusable directory from another website must never scan that site's DOM.
document.querySelectorAll("[data-group-directory]").forEach((root) => {
  mountGroupDirectory(root);
});
