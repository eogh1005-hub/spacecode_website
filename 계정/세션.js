(function () {
  var nav = document.querySelector(".account-nav");
  if (!nav || nav.querySelector("[data-account-link]")) return;
  var link = document.createElement("a");
  link.setAttribute("data-account-link", "");
  link.href = "/계정/로그인.html";
  link.textContent = "로그인";
  nav.appendChild(link);
  fetch("/api/me", { credentials: "same-origin" })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (!data || !data.user) return;
      link.href = "/계정/계정.html";
      link.textContent = "계정";
    })
    .catch(function () {});
})();
