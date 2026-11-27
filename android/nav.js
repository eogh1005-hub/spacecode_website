(function () {
  var button = document.querySelector(".nav-toggle");
  var header = document.querySelector("header");
  if (!button || !header) return;
  button.addEventListener("click", function () {
    var open = header.classList.toggle("nav-open");
    button.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
