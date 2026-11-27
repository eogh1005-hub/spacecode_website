(function () {
  var page = document.body.getAttribute("data-hub-page");
  if (!page || !window.DashHub) return;

  var root = document.querySelector("[data-hub-root]");
  if (!root) return;

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function emptyState(detail) {
    return (
      "<div class=\"hub-empty\" role=\"status\">" +
        "<div class=\"hub-empty-robot\" aria-hidden=\"true\">" +
          "<svg viewBox=\"0 0 160 160\" width=\"140\" height=\"140\">" +
            "<rect x=\"40\" y=\"54\" width=\"80\" height=\"70\" rx=\"18\" fill=\"#e8eef7\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<circle cx=\"80\" cy=\"38\" r=\"18\" fill=\"#d0d5dd\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<circle cx=\"80\" cy=\"38\" r=\"6\" fill=\"#667085\"/>" +
            "<line x1=\"80\" y1=\"56\" x2=\"80\" y2=\"54\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<circle cx=\"62\" cy=\"84\" r=\"8\" fill=\"#ffffff\" stroke=\"#667085\" stroke-width=\"3\"/>" +
            "<circle cx=\"98\" cy=\"84\" r=\"8\" fill=\"#ffffff\" stroke=\"#667085\" stroke-width=\"3\"/>" +
            "<path d=\"M68 108h24\" stroke=\"#667085\" stroke-width=\"4\" stroke-linecap=\"round\"/>" +
            "<rect x=\"28\" y=\"74\" width=\"12\" height=\"28\" rx=\"6\" fill=\"#d0d5dd\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<rect x=\"120\" y=\"74\" width=\"12\" height=\"28\" rx=\"6\" fill=\"#d0d5dd\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<text x=\"80\" y=\"148\" text-anchor=\"middle\" fill=\"#98a2b3\" font-size=\"22\" font-weight=\"800\" font-family=\"Montserrat, Pretendard, sans-serif\">404</text>" +
          "</svg>" +
        "</div>" +
        "<p class=\"hub-empty-title\">데이터가 없습니다</p>" +
        (detail ? "<p class=\"hub-empty-detail\">" + esc(detail) + "</p>" : "") +
      "</div>"
    );
  }

  function boardHref(name) {
    var map = {
      "거푸집": "거푸집.html",
      "화재경보": "화재경보.html"
    };
    return map[name] || "거푸집.html";
  }

  function boardOptions(extra) {
    var html = extra || "";
    return html + "<option>거푸집</option><option>화재경보</option>";
  }

  var CHART_COLORS = ["#2e90fa", "#7a5af8", "#12b76a", "#f04438", "#f79009", "#667085"];

  function countBy(list, keyFn) {
    var map = {};
    (list || []).forEach(function (item) {
      var key = keyFn(item) || "기타";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function pieSlices(map) {
    var total = 0;
    var keys = Object.keys(map);
    keys.forEach(function (key) { total += map[key]; });
    if (!total) return { total: 0, parts: [], gradient: "#eef2f6 0 100%" };
    var cursor = 0;
    var parts = keys.map(function (key, index) {
      var value = map[key];
      var start = cursor;
      var end = cursor + (value / total) * 100;
      cursor = end;
      return {
        key: key,
        value: value,
        pct: Math.round((value / total) * 100),
        color: CHART_COLORS[index % CHART_COLORS.length],
        start: start,
        end: end
      };
    });
    var gradient = parts.map(function (part) {
      return part.color + " " + part.start.toFixed(2) + "% " + part.end.toFixed(2) + "%";
    }).join(", ");
    return { total: total, parts: parts, gradient: gradient };
  }

  function renderPieCard(title, map, centerLabel) {
    var pie = pieSlices(map);
    var legend = pie.parts.map(function (part) {
      return (
        "<li><span class=\"hub-pie-dot\" style=\"background:" + part.color + "\"></span>" +
          "<span>" + esc(part.key) + "</span>" +
          "<strong>" + part.value + " · " + part.pct + "%</strong></li>"
      );
    }).join("");
    return (
      "<article class=\"hub-pie-card\">" +
        "<h3>" + esc(title) + "</h3>" +
        "<div class=\"hub-pie-wrap\">" +
          "<div class=\"hub-pie\" style=\"background:conic-gradient(" + pie.gradient + ")\" aria-hidden=\"true\">" +
            "<span>" + esc(centerLabel || String(pie.total)) + "</span>" +
          "</div>" +
          "<ul class=\"hub-pie-legend\">" + (legend || "<li>데이터 없음</li>") + "</ul>" +
        "</div>" +
      "</article>"
    );
  }

  function tableFromMap(headers, map, linkBoard) {
    var rows = Object.keys(map).map(function (key) {
      var label = linkBoard
        ? "<a href=\"" + boardHref(key) + "\">" + esc(key) + "</a>"
        : esc(key);
      return "<tr><td>" + label + "</td><td>" + map[key] + "</td></tr>";
    }).join("");
    return (
      "<table class=\"dash-table\"><thead><tr>" +
        headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
        (rows || "<tr><td colspan=\"2\">데이터가 없습니다.</td></tr>") +
      "</tbody></table>"
    );
  }

  function renderTasks(data) {
    var tasks = data.tasks || [];
    var rows = tasks.map(function (task) {
      return (
        "<tr data-id=\"" + esc(task.id) + "\">" +
          "<td><label class=\"hub-check\"><input type=\"checkbox\" data-toggle " + (task.done ? "checked" : "") + "> " + esc(task.title) + "</label></td>" +
          "<td><a href=\"" + boardHref(task.board) + "\">" + esc(task.board) + "</a></td>" +
          "<td>" + esc(task.assignee) + "</td>" +
          "<td>" + esc(task.status) + "</td>" +
          "<td>" + esc(task.priority) + "</td>" +
          "<td>" + esc(task.due) + "</td>" +
          "<td><button type=\"button\" data-remove>삭제</button></td>" +
        "</tr>"
      );
    }).join("");

    root.innerHTML =
      "<div class=\"dash-toolbar\">" +
        "<form class=\"hub-form hub-form-inline\" data-add-task>" +
          "<input name=\"title\" placeholder=\"새 작업 제목\" required>" +
          "<select name=\"board\">" +
            boardOptions() +
          "</select>" +
          "<input name=\"assignee\" placeholder=\"담당\" required>" +
          "<input name=\"due\" type=\"date\" required>" +
          "<button type=\"submit\">추가</button>" +
        "</form>" +
      "</div>" +
      (tasks.length
        ? "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>작업 목록</h2></div>" +
            "<table class=\"dash-table\"><thead><tr>" +
              "<th>항목</th><th>보드</th><th>담당</th><th>상태</th><th>우선순위</th><th>마감</th><th></th>" +
            "</tr></thead><tbody>" + rows + "</tbody></table></section>"
        : emptyState("아직 등록된 작업이 없습니다."));

    root.querySelector("[data-add-task]").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!DashHub.isUser()) return;
      var form = event.target;
      DashHub.addTask({
        title: form.title.value.trim(),
        board: form.board.value,
        assignee: form.assignee.value.trim(),
        status: "진행",
        priority: "보통",
        due: form.due.value,
        done: false
      }).then(paint);
    });

    Array.prototype.forEach.call(root.querySelectorAll("[data-toggle]"), function (input) {
      input.addEventListener("change", function () {
        if (!DashHub.isUser()) return;
        var id = input.closest("tr").getAttribute("data-id");
        DashHub.toggleTask(id).then(paint);
      });
    });

    Array.prototype.forEach.call(root.querySelectorAll("[data-remove]"), function (btn) {
      btn.addEventListener("click", function () {
        if (!DashHub.isUser()) return;
        var id = btn.closest("tr").getAttribute("data-id");
        DashHub.removeTask(id).then(paint);
      });
    });
  }

  function renderProjects(data) {
    var projects = data.projects || [];
    var cards = projects.map(function (project) {
      return (
        "<a class=\"dash-project\" href=\"" + esc(project.href) + "\">" +
          "<div class=\"dash-project-top\"><h3>" + esc(project.name) + "</h3>" +
            "<div class=\"dash-project-tags\">" +
              "<span class=\"dash-tag " + (project.status === "완료" ? "done" : "work") + "\">" + esc(project.status) + "</span>" +
              "<span class=\"dash-tag mid\">" + esc(project.priority) + "</span>" +
            "</div></div>" +
          "<p>보드에서 일정과 상태를 관리합니다.</p>" +
          "<div class=\"dash-progress\"><span style=\"width:" + Number(project.progress) + "%\"></span></div>" +
          "<div class=\"dash-project-foot\"><span>" + project.done + "/" + project.total + " 작업</span><span>마감 " + esc(String(project.due).slice(5).replace("-", "/")) + "</span></div>" +
        "</a>"
      );
    }).join("");

    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>프로젝트 관리</h1></div>" +
      "<p class=\"hub-note\" style=\"margin:0 0 14px\">하위 모듈: 거푸집 · 화재 경보 알림 도움기</p>" +
      (projects.length
        ? "<div class=\"dash-projects\">" + cards + "</div>"
        : emptyState("연결된 프로젝트가 없습니다."));
  }

  function renderAnalytics(data) {
    var stats = DashHub.stats(data);
    var tasks = data.tasks || [];
    if (!tasks.length && !(data.projects || []).length) {
      root.innerHTML = "<div class=\"dash-toolbar\"><h1>분석</h1></div>" + emptyState("분석할 데이터가 없습니다.");
      return;
    }
    var byBoard = {};
    tasks.forEach(function (task) {
      byBoard[task.board] = byBoard[task.board] || { total: 0, done: 0 };
      byBoard[task.board].total += 1;
      if (task.done) byBoard[task.board].done += 1;
    });
    var boardRows = Object.keys(byBoard).map(function (board) {
      var item = byBoard[board];
      var pct = item.total ? Math.round((item.done / item.total) * 100) : 0;
      return "<tr><td><a href=\"" + boardHref(board) + "\">" + esc(board) + "</a></td><td>" + item.done + "/" + item.total + "</td><td>" + pct + "%</td><td><div class=\"hub-bar\"><span style=\"width:" + pct + "%\"></span></div></td></tr>";
    }).join("");

    var statusMap = countBy(tasks, function (task) { return task.done ? "완료" : task.status; });
    var boardMap = countBy(tasks, function (task) { return task.board; });
    var priorityMap = countBy(tasks, function (task) { return task.priority; });

    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>분석</h1></div>" +
      "<div class=\"dash-stats\">" +
        "<article class=\"dash-stat dash-stat-blue\"><strong>" + stats.activeProjects + "</strong><span>프로젝트</span></article>" +
        "<article class=\"dash-stat dash-stat-violet\"><strong>" + stats.openTasks + "</strong><span>진행 작업</span></article>" +
        "<article class=\"dash-stat dash-stat-green\"><strong>" + stats.doneTasks + "</strong><span>완료</span></article>" +
        "<article class=\"dash-stat dash-stat-rose\"><strong>" + stats.riskTasks + "</strong><span>위험 · 지연</span></article>" +
      "</div>" +
      "<div class=\"hub-chart-grid\">" +
        renderPieCard("작업 상태 비중", statusMap, stats.weekProgress + "%") +
        renderPieCard("보드별 작업 비중", boardMap, String(tasks.length)) +
        renderPieCard("우선순위 비중", priorityMap, "우선") +
      "</div>" +
      "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>보드별 진행률 표</h2></div>" +
        "<table class=\"dash-table\"><thead><tr><th>보드</th><th>완료/전체</th><th>진행률</th><th>그래프</th></tr></thead>" +
        "<tbody>" + (boardRows || "<tr><td colspan=\"4\">데이터가 없습니다.</td></tr>") + "</tbody></table></section>" +
      "<div class=\"hub-table-grid\">" +
        "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>상태 표</h2></div>" +
          tableFromMap(["상태", "건수"], statusMap, false) + "</section>" +
        "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>우선순위 표</h2></div>" +
          tableFromMap(["우선순위", "건수"], priorityMap, false) + "</section>" +
      "</div>";
  }

  function renderCalendar(data) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var first = new Date(year, month, 1);
    var start = (first.getDay() + 6) % 7;
    var days = new Date(year, month + 1, 0).getDate();
    var events = data.events || [];
    var cells = [];
    var i;
    for (i = 0; i < start; i += 1) cells.push("<div class=\"hub-cal-cell is-empty\"></div>");
    for (i = 1; i <= days; i += 1) {
      var mm = month + 1 < 10 ? "0" + (month + 1) : String(month + 1);
      var dd = i < 10 ? "0" + i : String(i);
      var key = year + "-" + mm + "-" + dd;
      var dayEvents = events.filter(function (event) { return event.date === key; });
      cells.push(
        "<div class=\"hub-cal-cell\">" +
          "<strong>" + i + "</strong>" +
          dayEvents.map(function (event) {
            return "<a href=\"" + boardHref(event.board) + "\">" + esc(event.title) + "</a>";
          }).join("") +
        "</div>"
      );
    }

    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>캘린더</h1>" +
        "<form class=\"hub-form hub-form-inline\" data-add-event>" +
          "<input name=\"title\" placeholder=\"일정 제목\" required>" +
          "<input name=\"date\" type=\"date\" required>" +
          "<select name=\"board\">" + boardOptions() + "</select>" +
          "<button type=\"submit\">일정 추가</button>" +
        "</form></div>" +
      "<section class=\"hub-cal\">" +
        "<div class=\"hub-cal-head\"><h2>" + year + "년 " + (month + 1) + "월</h2></div>" +
        "<div class=\"hub-cal-week\"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span></div>" +
        "<div class=\"hub-cal-grid\">" + cells.join("") + "</div>" +
      "</section>";

    root.querySelector("[data-add-event]").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!DashHub.isUser()) return;
      var form = event.target;
      DashHub.addEvent({
        title: form.title.value.trim(),
        date: form.date.value,
        board: form.board.value
      }).then(paint);
    });
  }

  function renderTeam(data) {
    var team = data.team || [];
    var rows = team.map(function (member) {
      return (
        "<tr data-id=\"" + esc(member.id) + "\">" +
          "<td>" + esc(member.name) + "</td>" +
          "<td>" + esc(member.role) + "</td>" +
          "<td>" + esc(member.board) + "</td>" +
          "<td><button type=\"button\" data-remove>삭제</button></td>" +
        "</tr>"
      );
    }).join("");

    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>팀원</h1>" +
        "<form class=\"hub-form hub-form-inline\" data-add-team>" +
          "<input name=\"name\" placeholder=\"이름\" required>" +
          "<input name=\"role\" placeholder=\"역할\" required>" +
          "<select name=\"board\">" + boardOptions("<option>전체</option>") + "</select>" +
          "<button type=\"submit\">추가</button>" +
        "</form></div>" +
      (team.length
        ? "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>팀 구성</h2></div>" +
            "<table class=\"dash-table\"><thead><tr><th>이름</th><th>역할</th><th>보드</th><th></th></tr></thead>" +
            "<tbody>" + rows + "</tbody></table></section>"
        : emptyState("등록된 팀원이 없습니다."));

    root.querySelector("[data-add-team]").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!DashHub.isUser()) return;
      var form = event.target;
      DashHub.addTeam({
        name: form.name.value.trim(),
        role: form.role.value.trim(),
        board: form.board.value
      }).then(paint);
    });

    Array.prototype.forEach.call(root.querySelectorAll("[data-remove]"), function (btn) {
      btn.addEventListener("click", function () {
        if (!DashHub.isUser()) return;
        DashHub.removeTeam(btn.closest("tr").getAttribute("data-id")).then(paint);
      });
    });
  }

  function renderReports(data) {
    var stats = DashHub.stats(data);
    var tasks = data.tasks || [];
    var projects = data.projects || [];
    var messages = data.messages || [];
    if (!tasks.length && !projects.length && !messages.length) {
      root.innerHTML =
        "<div class=\"dash-toolbar\"><h1>보고서</h1>" +
          "<button type=\"button\" class=\"dash-chip\" data-reset>데이터 초기화</button></div>" +
        emptyState("보고할 데이터가 없습니다.");
      root.querySelector("[data-reset]").addEventListener("click", function () {
        if (!DashHub.isUser()) return;
        DashHub.reset().then(paint);
      });
      return;
    }
    var boardMap = countBy(tasks, function (task) { return task.board; });
    var statusMap = countBy(tasks, function (task) { return task.done ? "완료" : "미완료"; });
    var messageMap = {
      "읽지 않음": messages.filter(function (msg) { return !msg.read; }).length,
      "읽음": messages.filter(function (msg) { return msg.read; }).length
    };
    var projectRows = projects.map(function (project) {
      return (
        "<tr>" +
          "<td><a href=\"" + esc(project.href) + "\">" + esc(project.name) + "</a></td>" +
          "<td>" + esc(project.status) + "</td>" +
          "<td>" + project.done + "/" + project.total + "</td>" +
          "<td>" + project.progress + "%</td>" +
          "<td>" + esc(project.due) + "</td>" +
        "</tr>"
      );
    }).join("");
    var taskRows = tasks.map(function (task) {
      return (
        "<tr>" +
          "<td>" + esc(task.title) + "</td>" +
          "<td><a href=\"" + boardHref(task.board) + "\">" + esc(task.board) + "</a></td>" +
          "<td>" + esc(task.assignee) + "</td>" +
          "<td>" + esc(task.status) + "</td>" +
          "<td>" + esc(task.due) + "</td>" +
        "</tr>"
      );
    }).join("");
    var lines = [
      "주간 진행률: " + stats.weekProgress + "%",
      "진행 작업: " + stats.openTasks + "건",
      "완료 작업: " + stats.doneTasks + "건",
      "위험 · 지연: " + stats.riskTasks + "건",
      "읽지 않은 메시지: " + stats.unread + "건"
    ];

    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>보고서</h1>" +
        "<button type=\"button\" class=\"dash-chip dash-chip-primary\" data-copy>요약 복사</button>" +
        "<button type=\"button\" class=\"dash-chip\" data-reset>데이터 초기화</button>" +
      "</div>" +
      "<section class=\"dash-panel hub-report\"><h3>주간 요약</h3><ul>" +
        lines.map(function (line) { return "<li>" + esc(line) + "</li>"; }).join("") +
      "</ul><p class=\"hub-note\">거푸집·화재 경보 보드 작업 기준으로 집계됩니다.</p></section>" +
      "<div class=\"hub-chart-grid\">" +
        renderPieCard("완료 비율", statusMap, stats.weekProgress + "%") +
        renderPieCard("보드 분포", boardMap, String(tasks.length)) +
        renderPieCard("메시지 상태", messageMap, String(messages.length)) +
      "</div>" +
      "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>프로젝트 현황 표</h2></div>" +
        "<table class=\"dash-table\"><thead><tr><th>프로젝트</th><th>상태</th><th>작업</th><th>진행률</th><th>마감</th></tr></thead>" +
        "<tbody>" + (projectRows || "<tr><td colspan=\"5\">데이터가 없습니다.</td></tr>") + "</tbody></table></section>" +
      "<section class=\"dash-group\"><div class=\"dash-group-head\"><h2>작업 상세 표</h2></div>" +
        "<table class=\"dash-table\"><thead><tr><th>항목</th><th>보드</th><th>담당</th><th>상태</th><th>마감</th></tr></thead>" +
        "<tbody>" + (taskRows || "<tr><td colspan=\"5\">데이터가 없습니다.</td></tr>") + "</tbody></table></section>";

    root.querySelector("[data-copy]").addEventListener("click", function () {
      if (!DashHub.isUser()) return;
      var text = lines.join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
    });
    root.querySelector("[data-reset]").addEventListener("click", function () {
      if (!DashHub.isUser()) return;
      DashHub.reset().then(paint);
    });
  }

  function renderMessages(data) {
    var messages = data.messages || [];
    var rows = messages.map(function (msg) {
      return (
        "<article class=\"hub-msg" + (msg.read ? " is-read" : "") + "\" data-id=\"" + esc(msg.id) + "\">" +
          "<div><strong>" + esc(msg.from) + "</strong><span>" + esc(msg.at.replace("T", " ").slice(0, 16)) + "</span></div>" +
          "<p>" + esc(msg.body) + "</p>" +
          "<div class=\"hub-msg-actions\">" +
            "<a href=\"" + boardHref(msg.board) + "\">" + esc(msg.board) + "</a>" +
            "<button type=\"button\" data-read>" + (msg.read ? "안 읽음" : "읽음") + "</button>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>메시지</h1>" +
        (messages.length ? "<button type=\"button\" class=\"dash-chip\" data-read-all>모두 읽음</button>" : "") +
      "</div>" +
      (messages.length
        ? "<div class=\"hub-msg-list\">" + rows + "</div>"
        : emptyState("받은 메시지가 없습니다."));

    var readAll = root.querySelector("[data-read-all]");
    if (readAll) {
      readAll.addEventListener("click", function () {
        if (!DashHub.isUser()) return;
        DashHub.markAllMessages(true).then(paint);
      });
    }
    Array.prototype.forEach.call(root.querySelectorAll("[data-read]"), function (btn) {
      btn.addEventListener("click", function () {
        if (!DashHub.isUser()) return;
        var card = btn.closest(".hub-msg");
        var id = card.getAttribute("data-id");
        var read = !card.classList.contains("is-read");
        DashHub.markMessage(id, read).then(paint);
      });
    });
  }

  function renderSettings(data) {
    var settings = data.settings || {};
    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>설정</h1></div>" +
      "<form class=\"hub-form dash-panel\" data-settings>" +
        "<label class=\"hub-switch\"><input type=\"checkbox\" name=\"notifyMail\" " + (settings.notifyMail ? "checked" : "") + "> 이메일 알림</label>" +
        "<label class=\"hub-switch\"><input type=\"checkbox\" name=\"notifyPush\" " + (settings.notifyPush ? "checked" : "") + "> 브라우저 알림</label>" +
        "<label>주 시작일<select name=\"weekStart\">" +
          "<option value=\"mon\"" + (settings.weekStart === "mon" ? " selected" : "") + ">월요일</option>" +
          "<option value=\"sun\"" + (settings.weekStart === "sun" ? " selected" : "") + ">일요일</option>" +
        "</select></label>" +
        "<label>언어<select name=\"language\">" +
          "<option value=\"ko\"" + (settings.language === "ko" ? " selected" : "") + ">한국어</option>" +
          "<option value=\"en\"" + (settings.language === "en" ? " selected" : "") + ">English</option>" +
        "</select></label>" +
        "<button type=\"submit\" class=\"dash-chip dash-chip-primary\">저장</button>" +
        "<p class=\"hub-note\" data-saved hidden>설정을 저장했습니다.</p>" +
      "</form>";

    root.querySelector("[data-settings]").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!DashHub.isUser()) return;
      var form = event.target;
      DashHub.saveSettings({
        notifyMail: form.notifyMail.checked,
        notifyPush: form.notifyPush.checked,
        weekStart: form.weekStart.value,
        language: form.language.value
      }).then(function () {
        var note = root.querySelector("[data-saved]");
        note.hidden = false;
      });
    });
  }

  function renderHelp() {
    root.innerHTML =
      "<div class=\"dash-toolbar\"><h1>도움말</h1></div>" +
      "<section class=\"dash-panel hub-help\">" +
        "<h3>대시보드 폴더</h3>" +
        "<p>왼쪽 <strong>대시보드</strong> 칸의 내 작업·프로젝트·분석·캘린더·팀원·보고서·메시지·설정은 이 폴더(<code>대시보드/</code>)에 저장된 데이터로 동작합니다.</p>" +
        "<h3>프로젝트 관리 하위 모듈</h3>" +
        "<p>거푸집·화재 경보 알림 도움기는 프로젝트 관리 아래 하위 모듈입니다. 작업·일정·메시지도 이 모듈들과 연결되어 있습니다.</p>" +
        "<h3>저장 방식</h3>" +
        "<p>기본 값은 <code>data.json</code>에서 읽고, 추가·수정한 내용은 브라우저에 저장됩니다. 보고서의 데이터 초기화로 처음 상태로 되돌릴 수 있습니다.</p>" +
      "</section>";
  }

  function paint() {
    DashHub.get().then(function (data) {
      var logged = DashHub.isUser();
      var main = root.closest(".dash-main");
      if (main) {
        main.classList.toggle("is-preview", !logged);
        var topbar = main.querySelector(".dash-topbar");
        if (topbar) topbar.inert = !logged;
      }
      if (page === "tasks") renderTasks(data);
      else if (page === "projects") renderProjects(data);
      else if (page === "analytics") renderAnalytics(data);
      else if (page === "calendar") renderCalendar(data);
      else if (page === "team") renderTeam(data);
      else if (page === "reports") renderReports(data);
      else if (page === "messages") renderMessages(data);
      else if (page === "settings") renderSettings(data);
      else if (page === "help") renderHelp();

      root.inert = !logged;

      if (window.DashSideRefresh) window.DashSideRefresh();
    });
  }

  window.DashHubRepaint = paint;
  paint();
})();
