(function () {
  var APP = "https://dashboard.spacecode.app/";
  var ORIGIN = "https://dashboard.spacecode.app";
  var PRODUCT_BOARDS = {
    "curved-formwork": "거푸집",
    "fire-alarm-helper": "화재경보"
  };
  var PRODUCT_BOARD_NAMES = {
    "거푸집": true,
    "화재경보": true
  };

  var accessReady = false;
  var access = { user: null, entitlements: [], boards: {} };
  var hooksReady = false;

  function pageName() {
    var named = document.body.getAttribute("data-hub-page");
    if (named) return named;
    var side = document.querySelector("[data-dash-side]");
    var file = side ? side.getAttribute("data-dash-side") || "" : "";
    if (!file || file === "dashboard.html") return "home";
    return file.replace(/\.html$/, "");
  }

  function hashProduct() {
    var hash = decodeURIComponent((location.hash || "").replace(/^#/, "")).trim();
    if (!hash || hash.length > 80) return "";
    if (!/^[A-Za-z0-9_-]+$/.test(hash)) return "";
    return hash;
  }

  function boardFor(productId) {
    if (!productId) return "";
    if (Object.prototype.hasOwnProperty.call(PRODUCT_BOARDS, productId)) return PRODUCT_BOARDS[productId];
    return productId;
  }

  function boardFromHref(href) {
    var file = String(href || "").split("?")[0].split("#")[0].split("/").pop();
    file = file.replace(/\.html$/, "").replace(/-상세$/, "");
    if (PRODUCT_BOARD_NAMES[file]) return file;
    return "";
  }

  function currentBoard() {
    var side = document.querySelector("[data-dash-side]");
    var file = side ? side.getAttribute("data-dash-side") || "" : "";
    return boardFromHref(file);
  }

  function allowedBoards(entitlements) {
    var boards = {};
    (entitlements || []).forEach(function (item) {
      if (!item || item.allowed !== true) return;
      var board = boardFor(item.product);
      if (board) boards[board] = item.product;
    });
    return boards;
  }

  function loadMe() {
    return fetch("/api/me", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        var user = data && data.user;
        if (user && (user.email || user.name)) {
          return {
            user: { name: user.name || "", email: user.email || "" },
            entitlements: data.entitlements || []
          };
        }
        if (window.DashHub && DashHub.cachedUser) {
          var cached = DashHub.cachedUser();
          if (cached) return { user: cached, entitlements: null };
        }
        return { user: null, entitlements: data ? [] : null };
      })
      .catch(function () {
        if (window.DashHub && DashHub.cachedUser) {
          var cached = DashHub.cachedUser();
          if (cached) return { user: cached, entitlements: null };
        }
        return { user: null, entitlements: null };
      });
  }

  function keepItem(item, boards) {
    var board = item && item.board;
    if (!board || board === "전체") return true;
    return !!boards[board];
  }

  function filterData(data, boards) {
    data = data || {};
    return {
      tasks: (data.tasks || []).filter(function (item) { return keepItem(item, boards); }),
      projects: (data.projects || []).filter(function (item) {
        var board = item.board || boardFromHref(item.href);
        return !!boards[board];
      }),
      team: (data.team || []).filter(function (item) { return keepItem(item, boards); }),
      messages: (data.messages || []).filter(function (item) { return keepItem(item, boards); }),
      events: (data.events || []).filter(function (item) { return keepItem(item, boards); }),
      settings: data.settings || {}
    };
  }

  function installDataFilter() {
    if (!window.DashHub || DashHub.get._productFilter) return;
    var rawGet = DashHub.get;
    var rawAdd = DashHub.addProject;
    DashHub.get = function () {
      return rawGet.call(DashHub).then(function (data) {
        if (!accessReady || !DashHub.isUser || !DashHub.isUser()) return data;
        return filterData(data, access.boards);
      });
    };
    DashHub.get._productFilter = true;
    if (rawAdd) {
      DashHub.addProject = function (project) {
        var board = project && (project.board || boardFromHref(project.href));
        if (accessReady && DashHub.isUser && DashHub.isUser() && !access.boards[board]) {
          return rawGet.call(DashHub);
        }
        return rawAdd.call(DashHub, project);
      };
    }
  }

  function refreshLocal() {
    if (window.DashHomeRepaint) window.DashHomeRepaint();
    if (window.DashHubRepaint) window.DashHubRepaint();
    if (window.DashBoardEmptyRepaint) window.DashBoardEmptyRepaint();
    if (window.DashSideRefresh) window.DashSideRefresh();
  }

  function trimBoardChoices() {
    if (!accessReady || !window.DashHub || !DashHub.isUser || !DashHub.isUser()) return;
    var select = document.querySelector("[data-dash-home] select[name='board']");
    if (!select) return;
    Array.prototype.forEach.call(Array.prototype.slice.call(select.options), function (option) {
      var board = option.value || option.text;
      if (!access.boards[board]) option.remove();
    });
  }

  function watchHome() {
    var home = document.querySelector("[data-dash-home]");
    if (!home || home.getAttribute("data-sub-watch") === "on") return;
    home.setAttribute("data-sub-watch", "on");
    var trimming = false;
    var observer = new MutationObserver(function () {
      if (trimming) return;
      trimming = true;
      trimBoardChoices();
      trimming = false;
    });
    observer.observe(home, { childList: true, subtree: true });
  }

  function markUnsubscribed() {
    if (!accessReady || !window.DashHub || !DashHub.isUser || !DashHub.isUser()) return;
    Array.prototype.forEach.call(document.querySelectorAll(".dash-side-sub a"), function (link) {
      var board = boardFromHref(link.getAttribute("href"));
      if (!board) return;
      link.classList.toggle("is-unsubscribed", !access.boards[board]);
    });
  }

  function installHooks() {
    if (hooksReady) return;
    hooksReady = true;
    watchHome();
    if (window.DashSideRefresh && !window.DashSideRefresh._productHook) {
      var prevSide = window.DashSideRefresh;
      var wrappedSide = function () {
        var result = prevSide();
        if (result && result.then) return result.then(function () { markUnsubscribed(); });
        markUnsubscribed();
        return result;
      };
      wrappedSide._productHook = true;
      window.DashSideRefresh = wrappedSide;
    }
    if (window.DashBoardEmptyRepaint && !window.DashBoardEmptyRepaint._productHook) {
      var prevEmpty = window.DashBoardEmptyRepaint;
      var wrappedEmpty = function () {
        if (!accessReady || !window.DashHub || !DashHub.isUser || !DashHub.isUser()) {
          prevEmpty();
          return;
        }
        if (!paintProductBoard()) prevEmpty();
      };
      wrappedEmpty._productHook = true;
      window.DashBoardEmptyRepaint = wrappedEmpty;
    }
  }

  function text(value) {
    return String(value == null ? "" : value);
  }

  function appendText(tag, className, value, parent) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text(value);
    parent.appendChild(node);
    return node;
  }

  function lockedBoard(body, board) {
    body.textContent = "";
    var wrap = document.createElement("div");
    wrap.className = "hub-empty";
    wrap.setAttribute("role", "status");
    appendText("p", "hub-empty-title", "구독이 없습니다", wrap);
    appendText("p", "hub-empty-detail", board + " 제품은 구독이 열린 계정에서 데이터를 관리할 수 있습니다.", wrap);
    body.appendChild(wrap);
  }

  function paintProductBoard() {
    var body = document.querySelector(".dash-board-body");
    var board = currentBoard();
    if (!body || !board || !PRODUCT_BOARD_NAMES[board]) return false;
    if (!access.boards[board]) {
      lockedBoard(body, board);
      return true;
    }
    if (!window.DashHub) return false;
    DashHub.get().then(function (data) {
      if (currentBoard() !== board) return;
      renderManager(body, board, data || {});
    });
    return true;
  }

  function renderManager(body, board, data) {
    var tasks = (data.tasks || []).filter(function (item) { return item.board === board; });
    var projects = (data.projects || []).filter(function (item) {
      return (item.board || boardFromHref(item.href)) === board;
    });
    body.textContent = "";

    var form = document.createElement("form");
    form.className = "hub-form hub-form-inline";
    form.setAttribute("data-product-add", board);
    var title = document.createElement("input");
    title.name = "title";
    title.required = true;
    title.placeholder = "항목";
    title.setAttribute("aria-label", "항목");
    var status = document.createElement("select");
    status.name = "status";
    status.setAttribute("aria-label", "상태");
    ["진행", "대기", "검토", "완료"].forEach(function (name) {
      var option = document.createElement("option");
      option.textContent = name;
      status.appendChild(option);
    });
    var due = document.createElement("input");
    due.name = "due";
    due.type = "date";
    due.setAttribute("aria-label", "마감");
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "추가";
    form.appendChild(title);
    form.appendChild(status);
    form.appendChild(due);
    form.appendChild(submit);
    body.appendChild(form);

    if (!tasks.length && !projects.length) {
      var empty = document.createElement("p");
      empty.className = "hub-empty-detail";
      empty.textContent = "아직 항목이 없습니다. 추가하면 이 계정의 " + board + " 데이터로 저장됩니다.";
      body.appendChild(empty);
    }

    if (projects.length) renderRows(body, "프로젝트", projects.map(function (item) {
      return [item.name, item.status || "", item.due || ""];
    }), ["이름", "상태", "마감"]);
    renderTaskTable(body, board, tasks);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = title.value.trim();
      if (!name || !window.DashHub || !DashHub.addTask) return;
      DashHub.addTask({
        title: name,
        board: board,
        assignee: access.user && access.user.name ? access.user.name : "",
        status: status.value,
        priority: "보통",
        due: due.value,
        done: status.value === "완료"
      }).then(function () {
        title.value = "";
        paintProductBoard();
      });
    });
  }

  function renderRows(body, heading, rows, headers) {
    appendText("h2", "", heading, body);
    var table = document.createElement("table");
    table.className = "dash-table";
    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    headers.forEach(function (header) { appendText("th", "", header, headRow); });
    head.appendChild(headRow);
    table.appendChild(head);
    var tableBody = document.createElement("tbody");
    rows.forEach(function (row) {
      var line = document.createElement("tr");
      row.forEach(function (cell) { appendText("td", "", cell, line); });
      tableBody.appendChild(line);
    });
    table.appendChild(tableBody);
    body.appendChild(table);
  }

  function renderTaskTable(body, board, tasks) {
    appendText("h2", "", "항목", body);
    var table = document.createElement("table");
    table.className = "dash-table";
    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    ["항목", "상태", "마감", ""].forEach(function (header) { appendText("th", "", header, headRow); });
    head.appendChild(headRow);
    table.appendChild(head);
    var tableBody = document.createElement("tbody");
    tasks.forEach(function (task) {
      var line = document.createElement("tr");
      appendText("td", "", task.title, line);
      appendText("td", "", task.status || "", line);
      appendText("td", "", task.due || "", line);
      var actions = document.createElement("td");
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = task.done ? "되돌리기" : "완료";
      toggle.addEventListener("click", function () {
        if (!window.DashHub || !DashHub.toggleTask) return;
        DashHub.toggleTask(task.id).then(function () { paintProductBoard(); });
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.addEventListener("click", function () {
        if (!window.DashHub || !DashHub.removeTask) return;
        DashHub.removeTask(task.id).then(function () { paintProductBoard(); });
      });
      actions.appendChild(toggle);
      actions.appendChild(remove);
      line.appendChild(actions);
      tableBody.appendChild(line);
    });
    table.appendChild(tableBody);
    body.appendChild(table);
  }

  function openSubscribedBoard(product) {
    if (pageName() !== "home" || !product) return false;
    var board = access.boards[boardFor(product)] ? boardFor(product) : "";
    if (!board || !PRODUCT_BOARD_NAMES[board]) return false;
    location.replace(board + ".html#" + encodeURIComponent(product));
    return true;
  }

  function mount() {
    var main = document.querySelector(".dash-main");
    if (!main || main.getAttribute("data-dash-link") === "on") return;
    main.setAttribute("data-dash-link", "on");
    installHooks();

    var style = document.createElement("style");
    style.textContent = [
      ".dash-app {",
      "  display: block;",
      "  width: 100%;",
      "  min-height: 720px;",
      "  border: 0;",
      "  background: transparent;",
      "}",
      ".dash-app[hidden] { display: none; }",
      ".dash-side-sub a.is-unsubscribed { opacity: 0.45; }",
      ".dash-board-body > h2 { margin: 22px 0 10px; font-size: 1rem; }",
      ".dash-board-body .hub-form-inline { margin: 0 0 16px; }"
    ].join("\n");
    document.head.appendChild(style);

    var frame = document.createElement("iframe");
    frame.className = "dash-app";
    frame.hidden = true;
    frame.title = "대시보드";
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    main.appendChild(frame);

    var product = hashProduct();
    var page = pageName();
    var url = new URL(APP);
    url.searchParams.set("embed", "1");
    url.searchParams.set("page", page);
    if (product) url.searchParams.set("product", product);
    frame.src = url.toString();

    function sendSession() {
      if (!frame.contentWindow) return;
      var user = access.user;
      if (!user && window.DashHub && DashHub.cachedUser) user = DashHub.cachedUser();
      frame.contentWindow.postMessage({
        source: "spacecode",
        action: "session",
        page: pageName(),
        product: hashProduct(),
        user: user,
        entitlements: access.entitlements || []
      }, ORIGIN);
    }

    function showApp(height) {
      frame.hidden = false;
      Array.prototype.forEach.call(main.children, function (child) {
        if (child === frame) return;
        if (child.classList.contains("dash-topbar") || child.classList.contains("dash-toolbar")) return;
        if (child.hasAttribute("data-work-drop") || child.hasAttribute("data-work-files")) return;
        child.hidden = true;
      });
      if (height) frame.style.height = Math.max(480, Math.ceil(height)) + "px";
    }

    window.addEventListener("message", function (event) {
      if (event.origin !== ORIGIN) return;
      if (!event.data || event.data.source !== "spacecode-dashboard") return;
      if (event.data.action === "ready") {
        showApp(Number(event.data.height));
        sendSession();
      }
      if (event.data.action === "resize") {
        var height = Number(event.data.height);
        if (height) frame.style.height = Math.max(480, Math.ceil(height)) + "px";
      }
    });

    loadMe().then(function (session) {
      if (session.entitlements) {
        accessReady = true;
        access = {
          user: session.user,
          entitlements: session.entitlements,
          boards: allowedBoards(session.entitlements)
        };
        installDataFilter();
        if (session.user && openSubscribedBoard(product)) return;
      } else if (session.user) {
        access.user = session.user;
      }
      refreshLocal();
      sendSession();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
