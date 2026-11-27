(function () {
  var section = document.querySelector("[data-hero-zoom]");
  if (!section || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  var layer = section.querySelector(".oh-hero-zoom-layer");
  var schematic = section.querySelector(".oh-hero-schematic");
  var copy = section.querySelector(".oh-hero-copy");
  var shade = section.querySelector(".oh-hero-shade");
  if (!layer) return;

  var root = getComputedStyle(document.documentElement);
  var maxScale = parseFloat(root.getPropertyValue("--zoom-max")) || 2.4;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    gsap.set(layer, { scale: 1 });
    if (schematic) gsap.set(schematic, { opacity: 0 });
    return;
  }

  gsap.set(layer, { scale: 1, transformOrigin: "var(--zoom-x) var(--zoom-y)" });
  if (schematic) gsap.set(schematic, { opacity: 0 });
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

  tl.to(layer, { scale: maxScale, ease: "none", duration: 1 }, 0);

  if (copy) {
    tl.to(copy, { opacity: 0, y: -28, ease: "none", duration: 0.22 }, 0);
  }

  if (shade) {
    tl.to(shade, { opacity: 0.7, ease: "none", duration: 0.28 }, 0.18);
  }

  if (schematic) {
    tl.to(schematic, { opacity: 1, ease: "none", duration: 0.2 }, 0.42);

    var nodes = schematic.querySelectorAll(".sch-fade");
    if (nodes.length) {
      gsap.set(nodes, { opacity: 0 });
      tl.to(nodes, { opacity: 1, stagger: 0.02, ease: "none", duration: 0.14 }, 0.48);
    }
  }

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
