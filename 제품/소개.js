(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bands = Array.prototype.slice.call(document.querySelectorAll(".course-rise"));
  if (!bands.length) return;
  if (reduce || !("IntersectionObserver" in window)) {
    bands.forEach(function (band) {
      band.classList.add("is-shown");
    });
    return;
  }
  var watch = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add("is-shown");
      });
    },
    { threshold: 0.22, rootMargin: "0px 0px -8% 0px" }
  );
  bands.forEach(function (band) {
    watch.observe(band);
  });
})();
