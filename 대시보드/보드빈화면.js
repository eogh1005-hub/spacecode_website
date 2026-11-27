(function () {
  var body = document.querySelector(".dash-board-body");
  if (!body) return;
  var sample = body.innerHTML;

  function emptyHtml() {
    return (
      '<div class="hub-empty" role="status">' +
        '<div class="hub-empty-robot" aria-hidden="true">' +
          '<svg viewBox="0 0 160 160" width="140" height="140">' +
            '<rect x="40" y="54" width="80" height="70" rx="18" fill="#e8eef7" stroke="#98a2b3" stroke-width="3"/>' +
            '<circle cx="80" cy="38" r="18" fill="#d0d5dd" stroke="#98a2b3" stroke-width="3"/>' +
            '<circle cx="80" cy="38" r="6" fill="#667085"/>' +
            '<circle cx="62" cy="84" r="8" fill="#ffffff" stroke="#667085" stroke-width="3"/>' +
            '<circle cx="98" cy="84" r="8" fill="#ffffff" stroke="#667085" stroke-width="3"/>' +
            '<path d="M68 108h24" stroke="#667085" stroke-width="4" stroke-linecap="round"/>' +
            '<rect x="28" y="74" width="12" height="28" rx="6" fill="#d0d5dd" stroke="#98a2b3" stroke-width="3"/>' +
            '<rect x="120" y="74" width="12" height="28" rx="6" fill="#d0d5dd" stroke="#98a2b3" stroke-width="3"/>' +
            '<text x="80" y="148" text-anchor="middle" fill="#98a2b3" font-size="22" font-weight="800" font-family="Montserrat, Pretendard, sans-serif">404</text>' +
          "</svg>" +
        "</div>" +
        '<p class="hub-empty-title">데이터가 없습니다</p>' +
        '<p class="hub-empty-detail">로그인 계정에 연결된 보드 데이터가 아직 없습니다.</p>' +
      "</div>"
    );
  }

  function paint() {
    if (window.DashHub && DashHub.isUser && DashHub.isUser()) {
      body.innerHTML = emptyHtml();
    } else {
      body.innerHTML = sample;
    }
  }

  window.DashBoardEmptyRepaint = paint;
  paint();
})();
