(function () {
  var section = document.querySelector("[data-hero-zoom]");
  if (!section || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  var intro = section.querySelector("[data-oh-intro]");
  var layer = section.querySelector(".oh-hero-zoom-layer");
  var copy = section.querySelector(".oh-hero .oh-hero-copy");
  var shade = section.querySelector(".oh-hero-shade");
  if (!layer) return;

  var root = getComputedStyle(document.documentElement);
  var maxScale = parseFloat(root.getPropertyValue("--zoom-max")) || 1.85;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    if (intro) gsap.set(intro, { opacity: 0 });
    gsap.set(layer, { scale: 1 });
    if (copy) gsap.set(copy, { opacity: 0 });
    return;
  }

  gsap.set(layer, { scale: 1, transformOrigin: "var(--zoom-x) var(--zoom-y)" });
  if (copy) gsap.set(copy, { opacity: 1, y: 0 });
  if (intro) gsap.set(intro, { opacity: 1 });

  var tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: "+=160%",
      scrub: 0.35,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });

  // 1: 검정 베일만 걷히고 글은 그대로 — 사진이 드러남
  if (intro) {
    tl.to(intro, { opacity: 0, ease: "none", duration: 0.55 }, 0);
  }

  // 2: 글 사라지고 사진 확대 (기존 줌)
  if (copy) {
    tl.to(copy, { opacity: 0, y: -24, ease: "none", duration: 0.35 }, 0.5);
  }
  tl.to(layer, { scale: maxScale, ease: "none", duration: 1 }, 0.5);
  if (shade) {
    tl.to(shade, { opacity: 0.42, ease: "none", duration: 0.4 }, 0.58);
  }

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
