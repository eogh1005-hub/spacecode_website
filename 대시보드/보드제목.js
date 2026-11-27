(function () {
  var loggedIn = false;
  var warnTimer = null;
  var warnEl = null;
  var ownerName = "";
  var ownerEmail = "";

  function ensureWarn() {
    if (warnEl) return warnEl;
    warnEl = document.createElement("p");
    warnEl.className = "dash-login-warn";
    warnEl.setAttribute("role", "alert");
    warnEl.setAttribute("aria-live", "assertive");
    warnEl.textContent = "Login is required first.";
    document.body.appendChild(warnEl);
    return warnEl;
  }

  function showLoginWarn() {
    var el = ensureWarn();
    el.classList.add("is-on");
    if (warnTimer) clearTimeout(warnTimer);
    warnTimer = setTimeout(function () {
      el.classList.remove("is-on");
    }, 3200);
  }

  function applyOwner() {
    if (!ownerName) return;
    var sideLabel = "대시보드_" + ownerName + "님";
    Array.prototype.forEach.call(document.querySelectorAll("[data-dash-owner]"), function (node) {
      node.textContent = sideLabel;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-dash-chip]"), function (node) {
      node.textContent = ownerName + "의 대시보드";
    });
  }

  function applyUser(user) {
    if (user && (user.name || user.email)) {
      loggedIn = true;
      ownerName = String(user.name || "").trim();
      ownerEmail = String(user.email || "").trim();
      if (!ownerName) ownerName = ownerEmail ? ownerEmail.split("@")[0] : "";
      applyOwner();
      var link = document.querySelector("[data-account-link]");
      if (link) {
        link.href = "/계정/계정.html";
        link.textContent = "계정";
      }
    } else {
      loggedIn = false;
      ownerName = "";
      ownerEmail = "";
    }
    if (!window.DashHub || !DashHub.setSession) {
      refreshViews();
      return Promise.resolve();
    }
    return DashHub.setSession(user || null).then(refreshViews);
  }

  function refreshViews() {
    if (window.DashHubRepaint) window.DashHubRepaint();
    if (window.DashHomeRepaint) window.DashHomeRepaint();
    if (window.DashSideRefresh) window.DashSideRefresh();
    if (window.DashBoardEmptyRepaint) window.DashBoardEmptyRepaint();
  }

  function isHubMenuLink(href) {
    if (!href) return false;
    if (href.charAt(0) === "#" && href !== "#") return true;
    return /^(작업|프로젝트관리|분석|캘린더|팀원|보고서|메시지|설정|도움말)\.html(?:#.*)?$/.test(href);
  }

  function resetGuestLabels() {
    loggedIn = false;
    ownerName = "";
    ownerEmail = "";
    Array.prototype.forEach.call(document.querySelectorAll("[data-dash-owner]"), function (node) {
      node.textContent = "대시보드";
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-dash-chip]"), function (node) {
      node.textContent = "OOO의 대시보드";
    });
    var link = document.querySelector("[data-account-link]");
    if (link) {
      link.href = "/계정/로그인.html";
      link.textContent = "로그인";
    }
  }

  document.addEventListener("click", function (event) {
    var logout = event.target.closest("[data-dash-logout]");
    if (logout) {
      event.preventDefault();
      if (window.DashHub && DashHub.clearCachedUser) DashHub.clearCachedUser();
      var after = function () {
        resetGuestLabels();
        refreshViews();
        window.location.href = "dashboard.html";
      };
      if (window.DashHub && DashHub.setSession) {
        DashHub.setSession(null).then(after);
      } else {
        after();
      }
      return;
    }
    var link = event.target.closest(".dash-side-menu a, .dash-side-sub a");
    if (!link) return;
    if (!isHubMenuLink(link.getAttribute("href") || "")) return;
    if (!loggedIn) showLoginWarn();
  });

  window.DashOwnerRefresh = applyOwner;

  fetch("/api/me", { credentials: "same-origin" })
    .then(function (response) {
      if (!response.ok) throw new Error("me");
      return response.json();
    })
    .then(function (data) {
      var user = data && data.user ? data.user : null;
      if (!user && window.DashHub && DashHub.clearCachedUser) DashHub.clearCachedUser();
      return applyUser(user);
    })
    .catch(function () {
      var cached = window.DashHub && DashHub.cachedUser ? DashHub.cachedUser() : null;
      return applyUser(cached);
    });
})();
