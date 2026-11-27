(function (global) {
  var STAGES = [
    ["준비", 2],
    ["인코너", 6],
    ["면 나누기", 30],
    ["판 올리기", 8],
    ["뒷댐재", 11],
    ["띠판 솔리드", 5],
    ["웨지핀 커터", 6],
    ["구멍 잘라내기", 13],
    ["뒷댐재 합치기", 7],
    ["쪽폼 병합", 3],
    ["띠판 합치기", 4],
    ["인코너 겹침 삭제", 4],
    ["곡률 기록", 1]
  ];
  var MARKS = {
    "대기": "대기",
    "진행": "진행 중",
    "완료": "완료",
    "실패": "실패"
  };

  var root = null;
  var list = null;
  var bar = null;
  var percentNode = null;
  var noteNode = null;
  var timer = null;
  var states = [];
  var fractions = [];

  function percent() {
    var total = 0;
    STAGES.forEach(function (stage, index) {
      var weight = stage[1];
      var state = states[index];
      if (state === "완료") total += weight;
      else if (state === "진행" || state === "실패") {
        var fraction = fractions[index];
        if (fraction < 0) fraction = 0;
        if (fraction > 1) fraction = 1;
        total += weight * fraction;
      }
    });
    if (total < 0) return 0;
    if (total > 100) return 100;
    return total;
  }

  function reset() {
    states = STAGES.map(function () { return "대기"; });
    fractions = STAGES.map(function () { return 0; });
  }

  function paint() {
    if (!list) return;
    list.textContent = "";
    STAGES.forEach(function (stage, index) {
      var item = document.createElement("li");
      item.className = "is-" + (states[index] || "대기");
      var mark = document.createElement("span");
      mark.textContent = MARKS[states[index]] || states[index];
      var title = document.createElement("b");
      title.textContent = stage[0];
      item.appendChild(mark);
      item.appendChild(title);
      list.appendChild(item);
    });
    var value = percent();
    if (bar) bar.style.width = value + "%";
    if (percentNode) percentNode.textContent = value.toFixed(1) + "%";
  }

  function ensure() {
    root = document.querySelector("[data-work-progress]");
    if (!root || root.getAttribute("data-progress-ready") === "on") return;
    root.setAttribute("data-progress-ready", "on");
    root.innerHTML = "";
    var heading = document.createElement("h2");
    heading.textContent = "A형 진행";
    list = document.createElement("ol");
    var track = document.createElement("div");
    track.className = "work-progress-track";
    bar = document.createElement("span");
    track.appendChild(bar);
    percentNode = document.createElement("p");
    percentNode.className = "work-progress-percent";
    noteNode = document.createElement("p");
    noteNode.className = "work-progress-note";
    root.appendChild(heading);
    root.appendChild(list);
    root.appendChild(track);
    root.appendChild(percentNode);
    root.appendChild(noteNode);
  }

  function show() {
    ensure();
    if (!root) return;
    reset();
    if (noteNode) noteNode.textContent = "";
    paint();
    root.hidden = false;
    if (timer) return;
    timer = setInterval(pull, 1000);
    pull();
  }

  function hide() {
    if (root) root.hidden = true;
  }

  function apply(body) {
    if (!body || !body.stages) return;
    ensure();
    reset();
    body.stages.forEach(function (stage) {
      var index = -1;
      STAGES.forEach(function (item, itemIndex) {
        if (item[0] === stage.title) index = itemIndex;
      });
      if (index < 0) return;
      states[index] = stage.state || "대기";
      if (states[index] === "완료") fractions[index] = 1;
      else if (states[index] === "진행" || states[index] === "실패") {
        fractions[index] = typeof stage.fraction === "number" ? stage.fraction : 0;
      }
    });
    if (noteNode) noteNode.textContent = body.note || "";
    paint();
    if (root) root.hidden = false;
  }

  function pull() {
    fetch("http://127.0.0.1:8765/progress", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (body) {
        if (body) apply(body);
      })
      .catch(function () {});
  }

  reset();
  global.FormworkProgress = {
    show: show,
    hide: hide,
    apply: apply
  };
})(window);
