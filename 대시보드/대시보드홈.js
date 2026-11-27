(function () {
  var mount = document.querySelector("[data-dash-home]");
  if (!mount || !window.DashHub) return;

  var query = "";
  var statusFilter = "전체";
  var formOpen = false;

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function emptyState() {
    return (
      "<div class=\"hub-empty\" role=\"status\">" +
        "<div class=\"hub-empty-robot\" aria-hidden=\"true\">" +
          "<svg viewBox=\"0 0 160 160\" width=\"140\" height=\"140\">" +
            "<rect x=\"40\" y=\"54\" width=\"80\" height=\"70\" rx=\"18\" fill=\"#e8eef7\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<circle cx=\"80\" cy=\"38\" r=\"18\" fill=\"#d0d5dd\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<circle cx=\"80\" cy=\"38\" r=\"6\" fill=\"#667085\"/>" +
            "<circle cx=\"62\" cy=\"84\" r=\"8\" fill=\"#ffffff\" stroke=\"#667085\" stroke-width=\"3\"/>" +
            "<circle cx=\"98\" cy=\"84\" r=\"8\" fill=\"#ffffff\" stroke=\"#667085\" stroke-width=\"3\"/>" +
            "<path d=\"M68 108h24\" stroke=\"#667085\" stroke-width=\"4\" stroke-linecap=\"round\"/>" +
            "<rect x=\"28\" y=\"74\" width=\"12\" height=\"28\" rx=\"6\" fill=\"#d0d5dd\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<rect x=\"120\" y=\"74\" width=\"12\" height=\"28\" rx=\"6\" fill=\"#d0d5dd\" stroke=\"#98a2b3\" stroke-width=\"3\"/>" +
            "<text x=\"80\" y=\"148\" text-anchor=\"middle\" fill=\"#98a2b3\" font-size=\"22\" font-weight=\"800\" font-family=\"Montserrat, Pretendard, sans-serif\">404</text>" +
          "</svg>" +
        "</div>" +
        "<p class=\"hub-empty-title\">데이터가 없습니다</p>" +
        "<p class=\"hub-empty-detail\">로그인 계정에 연결된 프로젝트·작업이 아직 없습니다.</p>" +
      "</div>"
    );
  }

  function ensureSearch(logged) {
    var node = document.querySelector(".dash-search-wide");
    if (!node) return;
    if (!logged) {
      if (node.tagName === "INPUT") {
        var span = document.createElement("span");
        span.className = "dash-search dash-search-wide";
        span.textContent = "프로젝트, 팀, 메시지 검색";
        node.replaceWith(span);
      }
      return;
    }
    if (node.tagName === "INPUT") return;
    var input = document.createElement("input");
    input.className = "dash-search dash-search-wide";
    input.type = "search";
    input.placeholder = "프로젝트, 팀, 메시지 검색";
    input.value = query;
    input.setAttribute("aria-label", "프로젝트, 팀, 메시지 검색");
    node.replaceWith(input);
    input.addEventListener("input", function () {
      query = input.value;
      paint();
    });
  }

  function matches(text) {
    if (!query) return true;
    return String(text || "").toLowerCase().indexOf(query.trim().toLowerCase()) !== -1;
  }

  function paint() {
    DashHub.get().then(function (data) {
      var logged = DashHub.isUser();
      var main = mount.closest(".dash-main");
      if (main) {
        main.classList.toggle("is-preview", !logged);
        var topbar = main.querySelector(".dash-topbar");
        if (topbar) topbar.inert = !logged;
      }
      mount.inert = !logged;
      ensureSearch(logged);

      var stats = DashHub.stats(data);
      var projects = (data.projects || []).filter(function (project) {
        var statusOk = statusFilter === "전체" || project.status === statusFilter;
        return statusOk && (matches(project.name) || matches(project.status));
      });
      var team = (data.team || []).filter(function (member) {
        return matches(member.name) || matches(member.role);
      });
      var messages = (data.messages || []).filter(function (msg) {
        return matches(msg.from) || matches(msg.body);
      });
      var empty = DashHub.isEmpty(data);
      var statuses = ["전체"].concat((data.projects || []).map(function (project) {
        return project.status;
      }).filter(function (status, index, list) {
        return status && list.indexOf(status) === index;
      }));

      var projectHtml = projects.length
        ? "<div class=\"dash-projects\">" + projects.map(function (project) {
            var tag = logged ? "a" : "div";
            var href = logged ? " href=\"" + esc(project.href) + "\"" : "";
            return (
              "<" + tag + " class=\"dash-project\"" + href + ">" +
                "<div class=\"dash-project-top\"><h3>" + esc(project.name) + "</h3>" +
                  "<div class=\"dash-project-tags\">" +
                    "<span class=\"dash-tag " + (project.status === "완료" ? "done" : "work") + "\">" + esc(project.status) + "</span>" +
                    "<span class=\"dash-tag mid\">" + esc(project.priority) + "</span>" +
                  "</div></div>" +
                "<p>보드에서 일정과 상태를 관리합니다.</p>" +
                "<div class=\"dash-progress\"><span style=\"width:" + Number(project.progress) + "%\"></span></div>" +
                "<div class=\"dash-project-foot\"><span>" + project.done + "/" + project.total + " 작업</span><span>마감 " + esc(String(project.due).slice(5).replace("-", "/")) + "</span></div>" +
              "</" + tag + ">"
            );
          }).join("") + "</div>"
        : (logged ? emptyState() : "<div class=\"dash-projects\"></div>");

      var tools = logged
        ? "<div class=\"dash-projects-tools\">" +
            "<select class=\"dash-chip\" data-status>" +
              statuses.map(function (status) {
                return "<option" + (status === statusFilter ? " selected" : "") + ">" + esc(status) + "</option>";
              }).join("") +
            "</select>" +
            "<button class=\"dash-chip dash-chip-primary\" type=\"button\" data-new>+ 새 프로젝트</button>" +
          "</div>"
        : "<div class=\"dash-projects-tools\">" +
            "<span class=\"dash-chip\">필터</span>" +
            "<span class=\"dash-chip dash-chip-primary\">+ 새 프로젝트</span>" +
          "</div>";

      var form = logged && formOpen
        ? "<form class=\"hub-form hub-create\" data-create>" +
            "<input name=\"name\" placeholder=\"프로젝트 이름\" required>" +
            "<select name=\"board\"><option>거푸집</option><option>화재경보</option></select>" +
            "<input name=\"due\" type=\"date\" required>" +
            "<button type=\"submit\">만들기</button>" +
          "</form>"
        : "";

      mount.innerHTML =
        "<div class=\"dash-stats\">" +
          "<article class=\"dash-stat dash-stat-blue\"><strong>" + stats.activeProjects + "</strong><span>활성 프로젝트</span></article>" +
          "<article class=\"dash-stat dash-stat-violet\"><strong>" + stats.openTasks + "</strong><span>진행 중</span></article>" +
          "<article class=\"dash-stat dash-stat-green\"><strong>" + stats.doneTasks + "</strong><span>완료</span></article>" +
          "<article class=\"dash-stat dash-stat-rose\"><strong>" + stats.riskTasks + "</strong><span>위험 · 지연</span></article>" +
        "</div>" +
        "<div class=\"dash-projects-head\" id=\"projects\">" +
          "<h2>프로젝트 관리</h2>" +
          tools +
        "</div>" +
        form +
        projectHtml +
        (empty
          ? ""
          : "<section class=\"dash-panels\" id=\"team\">" +
              "<article class=\"dash-panel\"><h3>" + (logged ? "<a href=\"팀원.html\">팀원</a>" : "팀원") + "</h3><ul>" +
                (team.map(function (member) {
                  return "<li><strong>" + esc(member.name) + "</strong><span>" + esc(member.role) + "</span></li>";
                }).join("") || "<li>데이터가 없습니다</li>") +
              "</ul></article>" +
              "<article class=\"dash-panel\" id=\"messages\"><h3>" + (logged ? "<a href=\"메시지.html\">메시지</a>" : "메시지") + "</h3><ul>" +
                (messages.slice(0, 3).map(function (msg) {
                  return "<li><strong>" + esc(msg.from) + "</strong><span>" + esc(msg.body) + "</span></li>";
                }).join("") || "<li>데이터가 없습니다</li>") +
              "</ul></article>" +
              "<article class=\"dash-panel\" id=\"analytics\"><h3>" + (logged ? "<a href=\"분석.html\">분석</a> · <a href=\"보고서.html\">보고서</a>" : "분석 · 보고서") + "</h3><ul>" +
                "<li><strong>주간 진행률</strong><span>" + stats.weekProgress + "%</span></li>" +
                "<li><strong>지연 리스크</strong><span>" + stats.riskTasks + "건</span></li>" +
                "<li><strong>완료 작업</strong><span>" + stats.doneTasks + "건</span></li>" +
              "</ul></article>" +
            "</section>");

      var status = mount.querySelector("[data-status]");
      if (status) {
        status.addEventListener("change", function () {
          statusFilter = status.value;
          paint();
        });
      }
      var newer = mount.querySelector("[data-new]");
      if (newer) {
        newer.addEventListener("click", function () {
          formOpen = !formOpen;
          paint();
        });
      }
      var create = mount.querySelector("[data-create]");
      if (create) {
        create.addEventListener("submit", function (event) {
          event.preventDefault();
          DashHub.addProject({
            name: create.name.value.trim(),
            board: create.board.value,
            due: create.due.value
          }).then(function () {
            formOpen = false;
            query = "";
            statusFilter = "전체";
            var field = document.querySelector("input.dash-search-wide");
            if (field) field.value = "";
            paint();
          });
        });
      }
    });
  }

  window.DashHomeRepaint = paint;
  paint();
})();
