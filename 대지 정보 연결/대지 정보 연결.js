(function () {
  var REVIEW = "https://site.spacecode.app/";

  function mount() {
    var form = document.querySelector(".land-search");
    var input = document.getElementById("land-query");
    if (!form || !input || form.getAttribute("data-land-link") === "on") return;
    form.setAttribute("data-land-link", "on");

    var style = document.createElement("style");
    style.textContent = [
      "#land-review {",
      "  width: min(880px, calc(100% - 44px));",
      "  margin: 16px auto 32px;",
      "}",
      "#land-review[hidden] { display: none; }",
      "#land-review iframe {",
      "  display: block;",
      "  width: 100%;",
      "  height: 480px;",
      "  border: 0;",
      "  background: transparent;",
      "}"
    ].join("\n");
    document.head.appendChild(style);

    var panel = document.createElement("div");
    panel.id = "land-review";
    panel.hidden = true;

    var frame = document.createElement("iframe");
    frame.title = "대지 검토";
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    panel.appendChild(frame);

    var slide = form.closest(".home-slide");
    if (slide) slide.insertAdjacentElement("afterend", panel);
    else form.insertAdjacentElement("afterend", panel);

    window.addEventListener("message", function (event) {
      if (event.origin !== "https://site.spacecode.app") return;
      if (!event.data || event.data.source !== "land-review") return;
      if (event.data.action === "download") {
        allowDownload(event);
        return;
      }
      var height = Number(event.data.height);
      if (!height) return;
      frame.style.height = Math.max(240, Math.ceil(height)) + "px";
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var address = input.value;
      if (!address) return;
      var url = new URL(REVIEW);
      url.searchParams.set("embed", "1");
      url.searchParams.set("site", address);
      frame.src = url.toString();
      panel.hidden = false;
      var deck = document.querySelector(".home-deck");
      if (!deck) return;
      var deckTop = deck.getBoundingClientRect().top;
      var barTop = form.getBoundingClientRect().top;
      if (deck.scrollHeight > deck.clientHeight + 2) {
        deck.scrollTop += barTop - deckTop - 12;
        return;
      }
      var top = window.scrollY + panel.getBoundingClientRect().top - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  }

  function allowDownload(event) {
    var requestId = event.data.requestId;
    fetch("/api/me", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (data && data.user) {
          if (event.source) {
            event.source.postMessage({
              source: "spacecode",
              action: "download-result",
              requestId: requestId,
              allowed: true
            }, event.origin);
          }
          return;
        }
        goToLogin();
      })
      .catch(function () { goToLogin(); });
  }

  function goToLogin() {
    var next = location.pathname + location.search;
    location.assign("/계정/로그인.html?next=" + encodeURIComponent(next));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
