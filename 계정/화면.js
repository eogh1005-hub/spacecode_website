(function () {
  var form = document.querySelector("[data-account-form]");
  var account = document.querySelector("[data-account-view]");
  if (form) bindForm(form);
  if (account) showAccount(account);
  showNaverResult(form);
  showKakaoResult(form);
  keepReturnPath();

  function keepReturnPath() {
    var next = returnPath();
    if (!next) return;
    var naver = document.querySelector(".account-naver");
    var kakao = document.querySelector(".account-kakao");
    if (naver) naver.href = "https://spacecode.co.kr/api/auth/naver/login?next=" + encodeURIComponent(next);
    if (kakao) kakao.href = "https://spacecode.co.kr/api/auth/kakao/login?next=" + encodeURIComponent(next);
  }

  function returnPath() {
    var next = new URLSearchParams(location.search).get("next") || "";
    if (!next || next.length > 200) return "";
    if (next.charAt(0) !== "/" || next.charAt(1) === "/" || next.indexOf("\\") !== -1 || next.indexOf("://") !== -1) return "";
    return next;
  }

  function showNaverResult(node) {
    if (!node) return;
    var reason = new URLSearchParams(location.search).get("naver");
    if (!reason) return;
    var messages = {
      config: "네이버 로그인 설정이 아직 없습니다.",
      state: "로그인 확인값이 맞지 않습니다. 다시 시도해 주세요.",
      token: "네이버 로그인 토큰을 받지 못했습니다.",
      profile: "네이버 프로필을 받지 못했습니다.",
      email: "네이버 계정에 이메일이 없습니다. 이메일 제공에 동의해 주세요."
    };
    setMessage(node.querySelector("[data-account-message]"), messages[reason] || "네이버 로그인을 마치지 못했습니다.");
  }

  function showKakaoResult(node) {
    if (!node) return;
    var reason = new URLSearchParams(location.search).get("kakao");
    if (!reason) return;
    var messages = {
      config: "카카오 로그인 설정이 아직 없습니다.",
      state: "로그인 확인값이 맞지 않습니다. 다시 시도해 주세요.",
      token: "카카오 로그인 토큰을 받지 못했습니다.",
      profile: "카카오 프로필을 받지 못했습니다.",
      nickname: "카카오 닉네임 제공에 동의해 주세요."
    };
    setMessage(node.querySelector("[data-account-message]"), messages[reason] || "카카오 로그인을 마치지 못했습니다.");
  }

  function bindForm(node) {
    var message = node.querySelector("[data-account-message]");
    node.addEventListener("submit", function (event) {
      event.preventDefault();
      var mode = node.getAttribute("data-account-form");
      var payload = {
        email: value(node, "email"),
        password: value(node, "password"),
        name: value(node, "name")
      };
      setMessage(message, "");
      fetch(mode === "signup" ? "/api/signup" : "/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        });
      }).then(function (result) {
        if (!result.ok) {
          setMessage(message, result.body.error || "처리하지 못했습니다.");
          return;
        }
        location.href = returnPath() || "/계정/계정.html";
      }).catch(function () {
        setMessage(message, "계정 서버에 연결하지 못했습니다.");
      });
    });
  }

  function showAccount(node) {
    var message = node.querySelector("[data-account-message]");
    fetch("/api/me", { credentials: "same-origin" })
      .then(function (response) { return response.json().then(function (body) { return { ok: response.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok || !result.body.user) {
          location.href = "/계정/로그인.html";
          return;
        }
        var user = result.body.user;
        var email = document.querySelector("[data-account-email]");
        var name = document.querySelector("[data-account-name]");
        if (email) email.textContent = user.email;
        if (name) name.textContent = user.name || "이름 없음";
        var list = node.querySelector("[data-account-rights]");
        var rights = result.body.entitlements || [];
        list.innerHTML = rights.length ? rights.map(function (item) {
          var state = item.allowed ? "이용할 수 있습니다" : "권한이 없습니다";
          var until = item.until ? " · " + item.until.slice(0, 10) + "까지" : "";
          return "<li><b>" + escapeHtml(item.product) + "</b><span>" + state + until + "</span></li>";
        }).join("") : "<li><b>이용 중인 제품 없음</b><span>가입 기록은 남았습니다. 구독 권한은 따로 열립니다.</span></li>";
      }).catch(function () {
        setMessage(message, "계정 서버에 연결하지 못했습니다.");
      });

    var logout = node.querySelector("[data-account-logout]");
    if (logout) {
      logout.addEventListener("click", function () {
        fetch("/api/logout", { method: "POST", credentials: "same-origin" }).finally(function () {
          location.href = "/계정/로그인.html";
        });
      });
    }
  }

  function value(node, name) {
    var field = node.querySelector("[name='" + name + "']");
    return field ? field.value : "";
  }

  function setMessage(node, text) {
    if (!node) return;
    node.textContent = text;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char];
    });
  }
})();
