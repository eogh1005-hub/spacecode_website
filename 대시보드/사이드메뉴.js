(function () {
  var mount = document.querySelector("[data-dash-side]");
  if (!mount) return;

  var active = mount.getAttribute("data-dash-side") || "";
  var boardFiles = {
    "거푸집.html": true,
    "화재경보.html": true
  };

  function mark(href, label) {
    var file = href.split("/").pop();
    var on = active === file || active === label;
    if (href === "프로젝트관리.html" && boardFiles[active]) on = true;
    return ' class="' + (on ? "is-active" : "") + '"';
  }

  function markBoard(href) {
    var file = href.split("/").pop();
    var on = active === file || active.indexOf(file.replace(".html", "")) === 0;
    return ' class="' + (on ? "is-active" : "") + '"';
  }

  function render(badge) {
    mount.innerHTML =
      '<a class="dash-side-title" data-dash-owner href="dashboard.html">대시보드</a>' +
      '<p class="dash-side-label">대시보드</p>' +
      '<nav class="dash-side-menu" aria-label="대시보드 메뉴">' +
        '<a href="작업.html"' + mark("작업.html", "내 작업") + '><span class="dash-ico" aria-hidden="true"></span>내 작업</a>' +
        '<a href="프로젝트관리.html"' + mark("프로젝트관리.html", "프로젝트 관리") + '><span class="dash-ico" aria-hidden="true"></span>프로젝트 관리</a>' +
        '<nav class="dash-side-sub" aria-label="프로젝트 하위 모듈">' +
          '<a href="거푸집.html"' + markBoard("거푸집.html") + ">거푸집</a>" +
          '<a href="화재경보.html"' + markBoard("화재경보.html") + ">화재 경보 알림 도움기</a>" +
        "</nav>" +
        '<a href="분석.html"' + mark("분석.html", "분석") + '><span class="dash-ico" aria-hidden="true"></span>분석</a>' +
        '<a href="캘린더.html"' + mark("캘린더.html", "캘린더") + '><span class="dash-ico" aria-hidden="true"></span>캘린더</a>' +
        '<a href="팀원.html"' + mark("팀원.html", "팀원") + '><span class="dash-ico" aria-hidden="true"></span>팀원</a>' +
        '<a href="보고서.html"' + mark("보고서.html", "보고서") + '><span class="dash-ico" aria-hidden="true"></span>보고서</a>' +
        '<a href="메시지.html"' + mark("메시지.html", "메시지") + '><span class="dash-ico" aria-hidden="true"></span>메시지' +
          (badge ? '<span class="dash-badge">' + badge + "</span>" : "") +
        "</a>" +
      "</nav>" +
      '<p class="dash-side-label">일반</p>' +
      '<nav class="dash-side-menu" aria-label="일반">' +
        '<a href="설정.html"' + mark("설정.html", "설정") + ">설정</a>" +
        '<a href="도움말.html"' + mark("도움말.html", "도움말") + ">도움말</a>" +
        '<a href="dashboard.html" data-dash-logout>로그아웃</a>' +
      "</nav>" +
      (window.DashHub && DashHub.isUser && DashHub.isUser()
        ? ""
        : '<div class="dash-side-promo" id="side-promo">' +
            "<p>개인 대시보드로<br>프로젝트를 연결하세요</p>" +
            '<a href="/계정/로그인.html">로그인하기</a>' +
          "</div>");
  }

  function refresh() {
    if (!window.DashHub) {
      render("");
      return Promise.resolve();
    }
    return DashHub.get().then(function (data) {
      var n = DashHub.unreadCount(data);
      render(n > 0 ? String(n) : "");
      if (window.DashOwnerRefresh) window.DashOwnerRefresh();
    });
  }

  window.DashSideRefresh = refresh;
  refresh();
})();
