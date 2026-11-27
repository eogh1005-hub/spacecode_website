(function () {
  var button = document.querySelector(".mega-toggle");
  var panel = document.getElementById("mega-menu");
  var layout = panel && panel.querySelector(".mega-layout");
  var dismiss = panel && panel.querySelector(".mega-dismiss");
  var bridge = panel && panel.querySelector(".mega-bridge");
  var legal = panel && panel.querySelector(".mega-legal");
  if (!button || !panel) return;
  var hideTimer = 0;
  var frame = 0;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setOpen(open) {
    var opened = panel.classList.contains("is-open");
    if (open && opened) return;
    if (!open && !opened && panel.hidden) return;
    clearTimeout(hideTimer);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.textContent = open ? "닫기" : "메뉴";
    document.body.classList.toggle("mega-open", open);
    if (open) {
      var token = ++frame;
      panel.hidden = false;
      requestAnimationFrame(function () {
        placeBridge();
        requestAnimationFrame(function () {
          if (token !== frame) return;
          placeBridge();
          panel.classList.add("is-open");
        });
      });
      return;
    }
    frame += 1;
    panel.classList.remove("is-open");
    hideTimer = setTimeout(function () {
      if (panel.classList.contains("is-open")) return;
      panel.hidden = true;
    }, reduceMotion ? 0 : 480);
  }

  button.addEventListener("click", function () {
    setOpen(!panel.classList.contains("is-open"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  function placeBridge() {
    if (!bridge || !legal) return;
    var nav = panel.querySelector(".mega-layout nav");
    if (!nav) return;
    var panelBox = panel.getBoundingClientRect();
    var navBox = nav.getBoundingClientRect();
    var legalBox = legal.getBoundingClientRect();
    var left = Math.min(navBox.left, legalBox.left) - panelBox.left - 24;
    var right = Math.max(navBox.right, legalBox.right, panelBox.right) - panelBox.left;
    var top = navBox.bottom - panelBox.top - 16;
    if (left < 0) left = 0;
    bridge.style.left = left + "px";
    bridge.style.top = top + "px";
    bridge.style.width = Math.max(0, right - left) + "px";
    bridge.style.height = Math.max(0, panelBox.height - top) + "px";
  }

  window.addEventListener("resize", placeBridge);

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var closeTimer = 0;
    function holding(node) {
      return node && (button.contains(node) || (layout && layout.contains(node)) || node === bridge || node === legal || (bridge && bridge.contains(node)) || (legal && legal.contains(node)));
    }
    function cancelClose() {
      clearTimeout(closeTimer);
    }
    function scheduleClose() {
      cancelClose();
      closeTimer = setTimeout(function () { setOpen(false); }, 180);
    }
    button.addEventListener("mouseenter", function () {
      cancelClose();
      setOpen(true);
    });
    if (layout) layout.addEventListener("mouseenter", cancelClose);
    if (bridge) bridge.addEventListener("mouseenter", cancelClose);
    if (legal) legal.addEventListener("mouseenter", cancelClose);
    if (dismiss) {
      dismiss.addEventListener("mouseenter", function () {
        cancelClose();
        setOpen(false);
      });
    }
    button.addEventListener("mouseleave", function (event) {
      if (holding(event.relatedTarget)) return;
      scheduleClose();
    });
    panel.addEventListener("mouseleave", function (event) {
      if (holding(event.relatedTarget)) return;
      scheduleClose();
    });
  }
})();
