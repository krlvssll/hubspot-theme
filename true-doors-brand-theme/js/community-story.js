(function () {
  function addImageCaptions(root, generated) {
    root.querySelectorAll("img").forEach(function (image) {
      var alt = (image.getAttribute("alt") || "").trim() || "Image description not provided.";
      var caption = generated.get(image);
      if (caption && root.contains(caption)) {
        if (caption.textContent !== alt) caption.textContent = alt;
        return;
      }
      var figure = image.closest("figure");
      var existing = figure && figure.querySelector("figcaption");
      var anchor = image.closest("a");
      var target = image.closest("picture") || image;
      if (anchor && root.contains(anchor) && anchor.querySelectorAll("img").length === 1) {
        target = anchor;
      }
      if (existing && existing.textContent.trim()) return;
      if (figure && figure.querySelectorAll("img").length === 1) {
        caption = existing || document.createElement("figcaption");
        caption.textContent = alt;
        if (!existing) figure.appendChild(caption);
      } else {
        caption = document.createElement("span");
        caption.textContent = alt;
        target.insertAdjacentElement("afterend", caption);
      }
      caption.classList.add("story-image-caption");
      generated.set(image, caption);
    });
  }

  function initialize() {
    document.querySelectorAll(".body-container--community-story").forEach(function (root) {
      var generated = new WeakMap();
      addImageCaptions(root, generated);
      var observer = new MutationObserver(function () {
        addImageCaptions(root, generated);
      });
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["alt", "src"] });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
