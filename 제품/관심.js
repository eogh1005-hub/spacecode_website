(function () {
  var API = "/api/interest";
  var STORE_KEY = "bc_interest_visitor";
  var LIKED_KEY = "bc_interest_liked";
  var grid = document.querySelector("[data-interest-grid]");
  var modal = document.querySelector("[data-interest-modal]");
  var form = document.querySelector("[data-interest-form]");
  var message = document.querySelector("[data-interest-message]");
  var nameNode = document.querySelector("[data-interest-item-name]");
  var activeItemId = "";

  if (!grid) return;

  var visitorKey = loadVisitorKey();
  var liked = loadLiked();
  var utmSource = new URLSearchParams(location.search).get("utm_source") || "";

  markLikedButtons();
  markSoon();
  loadItems();
  recordVisit("products");

  grid.addEventListener("click", function (event) {
    var button = event.target.closest("[data-interest-heart]");
    var card = event.target.closest("[data-item-id]");
    if (!card || !grid.contains(card)) return;
    var itemId = card.getAttribute("data-item-id");
    if (button) {
      if (!itemId || liked[itemId]) {
        openModal(itemId, card);
        return;
      }
      sendHeart(itemId, button).then(function (ok) {
        if (!ok) return;
        liked[itemId] = true;
        saveLiked(liked);
        setLiked(button, true);
        openModal(itemId, card);
      });
      return;
    }
    var href = productHref(itemId);
    if (!href) return;
    location.href = href;
  });

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal || event.target.closest("[data-interest-close]")) closeModal();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setMessage("");
      var email = value(form, "email");
      var consent = form.querySelector("[name='consent']");
      if (!consent || !consent.checked) {
        setMessage("개인정보 수집·이용에 동의해 주세요.");
        return;
      }
      fetch(API + "/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: activeItemId,
          email: email,
          consent: true,
          utmSource: utmSource
        })
      }).then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        });
      }).then(function (result) {
        if (!result.ok) {
          setMessage(result.body.error || "신청을 마치지 못했습니다.");
          return;
        }
        setMessage("알림 신청을 받아 두었습니다.");
        form.reset();
      }).catch(function () {
        setMessage("서버에 연결하지 못했습니다.");
      });
    });
  }

  function loadItems() {
    fetch(API + "/items", { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (body) {
        var allowed = {
          "curved-formwork": true,
          "fire-alarm-helper": true
        };
        var items = (body.items || []).filter(function (item) {
          return allowed[item.id];
        });
        grid.querySelectorAll("[data-item-id]").forEach(function (card) {
          if (!allowed[card.getAttribute("data-item-id")]) card.remove();
        });
        items.forEach(function (item) {
          var card = cardById(item.id) || appendCard(item);
          if (item.name) {
            var title = card.querySelector("h3");
            if (title) title.textContent = item.name;
          }
          if (item.summary) {
            var summary = card.querySelector(".interest-body > p");
            if (summary) summary.textContent = item.summary;
          }
          recordVisit(item.id);
        });
        markSoon();
        markLikedButtons();
      })
      .catch(function () {});
  }

  function sendHeart(itemId, button) {
    return fetch(API + "/heart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: itemId, visitorKey: visitorKey })
    }).then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, body: body };
      });
    }).then(function (result) {
      return Boolean(result.ok);
    }).catch(function () {
      return false;
    });
  }

  function recordVisit(itemId) {
    fetch(API + "/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: itemId,
        visitorKey: visitorKey,
        utmSource: utmSource
      })
    }).catch(function () {});
  }

  function productHref(itemId) {
    if (itemId === "curved-formwork") return "거푸집.html";
    if (itemId === "fire-alarm-helper") return "화재경보.html";
    return "";
  }

  function markSoon() {
    grid.querySelectorAll("[data-item-id]").forEach(function (card) {
      var itemId = card.getAttribute("data-item-id");
      card.classList.toggle("is-soon", !productHref(itemId));
    });
  }

  function cardById(itemId) {
    var cards = grid.querySelectorAll("[data-item-id]");
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].getAttribute("data-item-id") === itemId) return cards[i];
    }
    return null;
  }

  function appendCard(item) {
    var card = document.createElement("article");
    card.className = "interest-card";
    card.setAttribute("data-item-id", item.id || "");
    if (item.id) card.id = item.id;

    var media = document.createElement("div");
    media.className = "interest-media";
    if (item.imagePath) {
      var image = document.createElement("img");
      image.src = item.imagePath;
      image.alt = item.name || "";
      media.appendChild(image);
    }
    var badge = document.createElement("span");
    badge.className = badgeClass(item.badge);
    badge.textContent = item.badge || "출시 예정";
    media.appendChild(badge);

    var body = document.createElement("div");
    body.className = "interest-body";
    var title = document.createElement("h3");
    title.textContent = item.name || "";
    var summary = document.createElement("p");
    summary.textContent = item.summary || "";
    var heart = document.createElement("button");
    heart.className = "interest-heart";
    heart.type = "button";
    heart.setAttribute("data-interest-heart", "");
    heart.setAttribute("aria-pressed", "false");
    heart.setAttribute("aria-label", "관심");
    var icon = document.createElement("span");
    icon.className = "interest-heart-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "♡";
    heart.appendChild(icon);
    body.appendChild(title);
    body.appendChild(summary);
    body.appendChild(heart);

    card.appendChild(media);
    card.appendChild(body);
    grid.appendChild(card);
    return card;
  }

  function badgeClass(badge) {
    if (badge === "출시 완료") return "interest-badge interest-badge-done";
    if (badge === "진행중") return "interest-badge interest-badge-progress";
    return "interest-badge";
  }

  function openModal(itemId, card) {
    activeItemId = itemId || "";
    if (!modal) return;
    if (nameNode && card) {
      var title = card.querySelector("h3");
      nameNode.textContent = title
        ? title.textContent + " 출시 알림을 받아 보세요."
        : "이 제품이 나오면 알려 드립니다.";
    }
    setMessage("");
    modal.hidden = false;
    var email = form && form.querySelector("[name='email']");
    if (email) email.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    activeItemId = "";
  }

  function markLikedButtons() {
    grid.querySelectorAll("[data-item-id]").forEach(function (card) {
      var itemId = card.getAttribute("data-item-id");
      var button = card.querySelector("[data-interest-heart]");
      if (!button || !itemId) return;
      setLiked(button, Boolean(liked[itemId]));
    });
  }

  function setLiked(button, on) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("is-liked", on);
    var icon = button.querySelector(".interest-heart-icon");
    if (icon) icon.textContent = on ? "♥" : "♡";
  }

  function loadVisitorKey() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved) return saved;
      var key = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORE_KEY, key);
      return key;
    } catch (error) {
      return "v_temp";
    }
  }

  function loadLiked() {
    try {
      return JSON.parse(localStorage.getItem(LIKED_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function saveLiked(map) {
    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify(map));
    } catch (error) {}
  }

  function value(node, name) {
    var field = node.querySelector("[name='" + name + "']");
    return field ? field.value.trim() : "";
  }

  function setMessage(text) {
    if (message) message.textContent = text || "";
  }
})();
