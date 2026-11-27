(function () {
  var data = navigator.userAgentData;
  var phone = false;
  var ua = navigator.userAgent || "";
  if (data && typeof data.mobile === "boolean") {
    phone = data.mobile === true;
  } else {
    phone = /iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));
  }

  if (phone) {
    document.documentElement.classList.add("phone");
    var markPhone = function () {
      if (document.body) document.body.classList.add("phone");
    };
    if (document.body) markPhone();
    else document.addEventListener("DOMContentLoaded", markPhone);
  }

  var path = location.pathname.replace(/\/+$/, "") || "/";
  var onPhone = /\/android\/phone(?:\.html)?$/i.test(path);
  var onDesktop = /\/desktop(?:\/index\.html)?$/i.test(path);
  if (onPhone) {
    if (!phone) location.replace("/desktop/index.html");
    return;
  }
  if (onDesktop) {
    if (phone) location.replace("/android/phone.html");
    return;
  }
  if (path === "/" || /\/index\.html$/i.test(path)) {
    location.replace(phone ? "/android/phone.html" : "/desktop/index.html");
  }
})();
