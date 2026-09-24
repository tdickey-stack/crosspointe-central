// A source choice invalidates every older completion, including local previews.
export function createLatestRequest() {
  let revision = 0;
  return {
    begin() { const current = ++revision; return () => current === revision; },
    cancel() { revision += 1; },
  };
}

export function readStudioImage(file, maximumMb = 8) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error("Use a JPG, PNG, or WebP image."));
  }
  if (file.size >= maximumMb * 1024 * 1024) {
    return Promise.reject(new Error(`Use an image smaller than ${maximumMb} MB.`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reader.onabort = () => reject(new Error("Studio could not read that image. Please select it again."));
    reader.readAsDataURL(file);
  });
}
