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
  var maxScale = parseFloat(root.getPropertyValue("--zoom-max")) || 3.15;
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
      end: "+=220%",
      scrub: 0.5,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });

  tl.to(layer, { scale: maxScale, ease: "none", duration: 1 }, 0);

  if (copy) {
    tl.to(copy, { opacity: 0, y: -40, ease: "none", duration: 0.32 }, 0.05);
  }

  if (shade) {
    tl.to(shade, { opacity: 0.62, ease: "none", duration: 0.45 }, 0.4);
  }

  if (schematic) {
    tl.to(schematic, { opacity: 1, ease: "power1.out", duration: 0.28 }, 0.72);

    var drawLines = schematic.querySelectorAll(".sch-draw");
    drawLines.forEach(function (line) {
      var length = 120;
      try {
        length = line.getTotalLength();
      } catch (err) {}
      gsap.set(line, {
        strokeDasharray: length,
        strokeDashoffset: length
      });
      tl.to(line, { strokeDashoffset: 0, ease: "none", duration: 0.22 }, 0.74);
    });

    var nodes = schematic.querySelectorAll(".sch-fade");
    if (nodes.length) {
      gsap.set(nodes, { opacity: 0 });
      tl.to(nodes, { opacity: 1, stagger: 0.04, ease: "none", duration: 0.18 }, 0.8);
    }
  }

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
