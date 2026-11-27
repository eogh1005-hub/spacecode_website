(function () {
  var nav = document.querySelector(".oh-top-nav");
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll("a[href*='#']"));
  var ids = ["인사", "제안", "제품", "특허", "활동"];
  var sections = ids
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  function setCurrent(id) {
    links.forEach(function (link) {
      var hash = (link.getAttribute("href") || "").split("#")[1];
      if (hash === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function goHash(hash, smooth) {
    var id = (hash || "").replace(/^#/, "");
    var target = id && document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    setCurrent(id);
    if (history.replaceState) {
      history.replaceState(null, "", "#" + id);
    }
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var href = link.getAttribute("href") || "";
      var hash = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#")) : "";
      var id = hash.replace(/^#/, "");
      if (!id || !document.getElementById(id)) return;
      event.preventDefault();
      goHash(hash, true);
      var mega = document.getElementById("mega-menu");
      if (mega && !mega.hidden && typeof mega.close === "function") mega.close();
      var toggle = document.querySelector(".mega-toggle[aria-expanded='true']");
      if (toggle) toggle.click();
    });
  });

  if (location.hash) {
    requestAnimationFrame(function () {
      goHash(location.hash, false);
    });
  } else {
    setCurrent("인사");
  }

  if (!sections.length || !("IntersectionObserver" in window)) return;

  var observer = new IntersectionObserver(
    function (entries) {
      var visible = entries
        .filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
      if (!visible || !visible.target || !visible.target.id) return;
      setCurrent(visible.target.id);
    },
    { rootMargin: "-35% 0px -45% 0px", threshold: [0.1, 0.35, 0.6] }
  );

  sections.forEach(function (section) { observer.observe(section); });
})();
