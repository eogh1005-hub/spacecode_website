(function () {
  var section = document.querySelector("[data-hero-zoom]");
  if (!section || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  var layer = section.querySelector(".oh-hero-zoom-layer");
  var copy = section.querySelector(".oh-hero-copy");
  var shade = section.querySelector(".oh-hero-shade");
  if (!layer) return;

  var root = getComputedStyle(document.documentElement);
  var maxScale = parseFloat(root.getPropertyValue("--zoom-max")) || 1.85;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    gsap.set(layer, { scale: 1 });
    if (copy) gsap.set(copy, { opacity: 0 });
    return;
  }

  gsap.set(layer, { scale: 1, transformOrigin: "var(--zoom-x) var(--zoom-y)" });
  if (copy) gsap.set(copy, { opacity: 1, y: 0 });

  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: "+=85%",
      scrub: 0.18,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });

  // 1→2: 글 먼저 지우고 사진만 확대
  if (copy) {
    tl.to(copy, { opacity: 0, y: -24, ease: "none", duration: 0.28 }, 0);
  }

  tl.to(layer, { scale: maxScale, ease: "none", duration: 1 }, 0);

  if (shade) {
    tl.to(shade, { opacity: 0.42, ease: "none", duration: 0.35 }, 0.12);
  }

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
