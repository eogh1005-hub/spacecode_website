(function () {
  var box = document.querySelector("[data-work-drop]");
  if (!box) return;

  var PRODUCTS = {
    "curved-formwork": {
      label: "거푸집",
      title: "3dm 파일을 여기에 놓으세요",
      hint: "또는 이 칸을 눌러 선택합니다. 3dm 파일만 넣을 수 있습니다.",
      reject: "3dm 파일만 넣을 수 있습니다.",
      login: "카카오 계정으로 로그인한 뒤에 3dm 파일을 넣을 수 있습니다.",
      extensions: ["3dm"]
    },
    "takeoff-automation": {
      label: "적산",
      title: "도면이나 모델링 파일을 여기에 놓으세요",
      hint: "또는 이 칸을 눌러 선택합니다. CAD 도면(dwg, dxf)과 모델링 파일(3dm, ifc, skp, rvt, step)을 넣을 수 있습니다.",
      reject: "적산에는 CAD 도면이나 모델링 파일만 넣을 수 있습니다.",
      login: "카카오 계정으로 로그인한 뒤에 도면이나 모델링 파일을 넣을 수 있습니다.",
      extensions: ["dwg", "dxf", "dgn", "dwf", "3dm", "ifc", "skp", "rvt", "step", "stp", "iges", "igs", "sat", "obj", "stl", "fbx", "3ds"]
    }
  };

  var prepare = box.querySelector("[data-work-prepare]");
  var target = box.querySelector("[data-work-target]");
  var title = box.querySelector("[data-work-title]");
  var hint = box.querySelector("[data-work-hint]");
  var input = box.querySelector("[data-work-input]");
  var note = box.querySelector("[data-work-note]");
  var list = box.querySelector("[data-work-list]");
  var productId = "curved-formwork";
  var user = null;
  var offline = false;

  Array.prototype.forEach.call(box.querySelectorAll("[data-work-product]"), function (button) {
    button.addEventListener("click", function () {
      productId = button.getAttribute("data-work-product") || "curved-formwork";
      applyProduct();
      paint();
    });
  });
  var statusNote = document.querySelector("[data-work-status-note]");
  var statusList = document.querySelector("[data-work-status-list]");
  var resultTimer = null;
  var PLACES = {
    "curved-formwork": { label: "거푸집", href: "거푸집.html#결과" },
    "fire-alarm-helper": { label: "화재 경보", href: "화재경보.html#결과" },
    "takeoff-automation": { label: "물량산출", href: "물량산출.html#결과" },
    "drawing-legal-review": { label: "도면 검토", href: "도면검토.html#결과" },
    "site-feedback-automation": { label: "민원 관리", href: "민원관리.html#결과" }
  };

  applyProduct();
  refresh();

  target.addEventListener("click", function () {
    if (isLocked()) return;
    input.click();
  });
  target.addEventListener("keydown", function (event) {
    if (isLocked()) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    input.click();
  });
  input.addEventListener("change", function () {
    take(input.files);
    input.value = "";
  });

  box.addEventListener("dragenter", over);
  box.addEventListener("dragover", over);
  box.addEventListener("dragleave", function (event) {
    if (box.contains(event.relatedTarget)) return;
    box.classList.remove("is-over");
  });
  box.addEventListener("drop", function (event) {
    event.preventDefault();
    box.classList.remove("is-over");
    if (isLocked()) return;
    take(event.dataTransfer && event.dataTransfer.files);
  });

  function over(event) {
    event.preventDefault();
    if (isLocked()) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
      return;
    }
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    box.classList.add("is-over");
  }

  function isTakeoff() {
    return productId === "takeoff-automation";
  }

  function isLocked() {
    return isTakeoff() || !user;
  }

  function refresh() {
    return loadUser().then(function () {
      return Promise.all([paint(), loadStatus()]);
    });
  }

  function currentProduct() {
    return PRODUCTS[productId] || PRODUCTS["curved-formwork"];
  }

  function applyProduct() {
    var product = currentProduct();
    var takeoff = isTakeoff();
    var locked = isLocked();
    Array.prototype.forEach.call(box.querySelectorAll("[data-work-product]"), function (button) {
      button.classList.toggle("is-on", button.getAttribute("data-work-product") === productId);
    });
    box.classList.toggle("is-closed", takeoff);
    box.classList.toggle("is-locked", locked);
    target.hidden = takeoff;
    if (prepare) prepare.hidden = !takeoff;
    input.disabled = locked;
    if (locked) {
      target.tabIndex = -1;
      target.setAttribute("aria-disabled", "true");
    } else {
      target.tabIndex = 0;
      target.removeAttribute("aria-disabled");
    }
    if (takeoff) {
      box.classList.remove("is-over");
      if (window.FormworkProgress) FormworkProgress.hide();
      if (note) note.hidden = true;
      return;
    }
    if (note) note.hidden = false;
    if (!user) box.classList.remove("is-over");
    title.textContent = product.title;
    hint.textContent = product.hint;
    input.accept = product.extensions.map(function (ext) { return "." + ext; }).join(",");
    if (!user) setNote(offline
      ? "계정 서버에 연결하지 못했습니다. 로그인한 뒤에 다시 놓아 주세요."
      : product.login);
    else if (!list.children.length) setNote("로그인한 계정에만 저장됩니다. 공개 주소로는 열리지 않습니다.");
  }

  function take(fileList) {
    if (isLocked()) return;
    var files = Array.prototype.slice.call(fileList || []);
    var picked = files.filter(allowedFile);
    var rejected = files.length - picked.length;
    var product = currentProduct();
    return loadUser().then(function () {
      if (!user) {
        setNote(offline
          ? "계정 서버에 연결하지 못했습니다. 로그인한 뒤에 다시 놓아 주세요."
          : product.login);
        return;
      }
      if (!picked.length) {
        setNote(rejected ? product.reject : "놓은 파일이 없습니다.");
        return;
      }
      return Promise.all(picked.map(storeFile)).then(function (results) {
        var handed = results.filter(function (item) { return item.handed; }).length;
        var skipped = results.filter(function (item) { return item.skipped; }).length;
        var text = picked.length + "개 파일을 " + product.label + "에 넣었습니다.";
        if (rejected) text += " 받을 수 없는 파일은 빼 두었습니다.";
        if (productId === "curved-formwork") {
          if (handed) text += " 거푸집 관제로 " + handed + "개를 넘겼습니다.";
          if (skipped) text += " 3dm 형식이 아닌 " + skipped + "개는 관제로 넘기지 않았습니다.";
          if (!handed && !skipped) text += " 거푸집 받은 쪽이 꺼져 있어 아직 관제로 넘기지 못했습니다.";
        }
        setNote(text);
        if (handed && window.FormworkProgress) FormworkProgress.show();
        loadStatus();
        return paint();
      });
    }).catch(function () {
      setNote("파일을 넣지 못했습니다. 다시 놓아 주세요.");
    });
  }

  function allowedFile(file) {
    var name = String(file && file.name || "");
    var dot = name.lastIndexOf(".");
    if (dot < 0) return false;
    var ext = name.slice(dot + 1).toLowerCase();
    return currentProduct().extensions.indexOf(ext) !== -1;
  }

  function loadUser() {
    return fetch("/api/me", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        offline = false;
        var next = data && data.user;
        user = next && (next.email || next.name) ? next : null;
        applyProduct();
        return user;
      })
      .catch(function () {
        offline = true;
        user = null;
        applyProduct();
        return null;
      });
  }

  function ownerOf(person) {
    return [person.name || "", person.email || "", person.createdAt || ""].join("|");
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open("bc-work-3dm", 1);
      request.onupgradeneeded = function () {
        var store = request.result.createObjectStore("files", { keyPath: "id" });
        store.createIndex("owner", "owner", { unique: false });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function saveFile(file, handed, id) {
    var record = {
      id: id || crypto.randomUUID(),
      owner: ownerOf(user),
      product: productId,
      role: productId === "curved-formwork" ? "host" : "drawing",
      pipeline: productId === "curved-formwork" ? "aws/관제/실행.py" : "",
      name: file.name,
      size: file.size,
      at: new Date().toISOString(),
      handed: !!handed,
      blob: file
    };
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(record);
        tx.oncomplete = function () { resolve(record); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function isFormwork3dm(file) {
    return file.slice(0, 32).arrayBuffer().then(function (buffer) {
      var text = new TextDecoder("ascii").decode(new Uint8Array(buffer));
      return text.indexOf("3D Geometry File Format") === 0;
    });
  }

  function handToFormwork(file, id) {
    return fetch("http://127.0.0.1:8765/inbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-Job-Id": id
      },
      body: file
    }).then(function (response) {
      return response.ok;
    }).catch(function () {
      return false;
    });
  }

  function storeFile(file) {
    if (productId !== "curved-formwork") {
      return saveFile(file, false).then(function (record) {
        return { record: record, handed: false, skipped: false };
      });
    }
    var id = crypto.randomUUID();
    return isFormwork3dm(file).then(function (real) {
      if (!real) {
        return saveFile(file, false).then(function (record) {
          return { record: record, handed: false, skipped: true };
        });
      }
      return handToFormwork(file, id).then(function (handed) {
        return saveFile(file, handed, id).then(function (record) {
          return { record: record, handed: handed, skipped: false };
        });
      });
    });
  }

  function filesForUser() {
    if (!user) return Promise.resolve([]);
    var owner = ownerOf(user);
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var request = db.transaction("files", "readonly").objectStore("files").index("owner").getAll(owner);
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function removeFile(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function paint() {
    if (!user) {
      list.textContent = "";
      return Promise.resolve();
    }
    return filesForUser().then(function (files) {
      list.textContent = "";
      files = files.filter(function (file) { return (file.product || "curved-formwork") === productId; });
      files.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      files.forEach(function (file) {
        var item = document.createElement("li");
        var name = document.createElement("span");
        name.textContent = file.name + " · " + formatSize(file.size) + (file.handed ? " · 관제로 넘김" : "");
        var remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "빼기";
        remove.addEventListener("click", function () {
          removeFile(file.id).then(function () {
            setNote("파일 하나를 뺐습니다.");
            paint();
          });
        });
        item.appendChild(name);
        item.appendChild(remove);
        list.appendChild(item);
      });
    });
  }

  function formatSize(size) {
    var bytes = Number(size) || 0;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function setNote(text) {
    note.textContent = text;
  }

  function loadStatus() {
    if (!statusNote) return Promise.resolve();
    if (!user) {
      setStatus(offline
        ? "계정 서버에 연결하지 못했습니다. 넣은 파일의 처리 상태는 연결되면 여기에 나옵니다."
        : "로그인한 뒤에 넣은 파일과 처리 상태가 여기에 나옵니다.");
      if (statusList) statusList.textContent = "";
      return Promise.resolve();
    }
    if (!resultTimer) {
      resultTimer = setInterval(function () {
        if (user) loadStatus();
      }, 5000);
    }
    var local = filesForUser().catch(function () { return []; });
    var remote = fetch("/api/work/jobs", { credentials: "same-origin" })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        }).catch(function () {
          return { ok: false, body: {} };
        });
      })
      .catch(function () {
        return { ok: false, body: {} };
      });
    return Promise.all([local, remote]).then(function (pair) {
      paintStatus(pair[0], pair[1].ok ? (pair[1].body.jobs || []) : []);
    });
  }

  function paintStatus(files, jobs) {
    if (!statusList) return;
    statusList.textContent = "";
    var rows = [];
    files.slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).forEach(function (file) {
      var place = PLACES[file.product] || PLACES["curved-formwork"];
      rows.push({
        name: file.name,
        place: place,
        state: file.handed ? "처리 중" : "받음"
      });
    });
    jobs.forEach(function (job) {
      var place = PLACES[job.product];
      if (!place) return;
      rows.push({
        name: job.name || job.id,
        place: place,
        state: jobState(job.status)
      });
    });
    if (!rows.length) {
      setStatus("아직 넣은 파일이 없습니다. 끝나면 각 항목 화면에서 파일을 받습니다.");
      return;
    }
    rows.forEach(function (row) {
      var item = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = row.name;
      var state = document.createElement("span");
      state.className = "work-state is-" + row.state.replace(" ", "");
      state.textContent = row.state;
      item.appendChild(name);
      item.appendChild(state);
      if (row.place) {
        var link = document.createElement("a");
        link.href = row.place.href;
        link.textContent = row.place.label;
        item.appendChild(link);
      }
      statusList.appendChild(item);
    });
    setStatus("처리된 파일은 프로젝트 관리의 해당 항목에서 받습니다.");
  }

  function jobState(status) {
    var value = String(status || "").toLowerCase();
    if (value === "done") return "완료";
    if (value === "failed" || value === "error") return "실패";
    if (value === "running" || value === "processing" || value === "progress") return "처리 중";
    return "대기";
  }

  function setStatus(text) {
    if (statusNote) statusNote.textContent = text;
  }
})();

(function () {
  var root = document.querySelector("[data-work-files]");
  if (!root) return;

  var productId = root.getAttribute("data-product") || "";
  var note = root.querySelector("[data-work-results-note]");
  var list = root.querySelector("[data-work-results-list]");
  var user = null;
  var timer = null;
  var FORMWORK = [
    { kind: "model", label: "3dm" },
    { kind: "quantity", label: "생산 개수표" },
    { kind: "cnc", label: "CNC" }
  ];

  root.addEventListener("click", function (event) {
    var button = event.target.closest("[data-work-download]");
    if (!button || button.disabled) return;
    saveDownload(button.getAttribute("data-job-id"), button.getAttribute("data-work-download"), button.textContent);
  });

  load();

  function load() {
    return fetch("/api/me", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        var next = data && data.user;
        user = next && (next.email || next.name) ? next : null;
        return refreshFiles();
      })
      .catch(function () {
        user = null;
        setNote("계정 서버에 연결하지 못했습니다. 연결되면 이 항목의 파일을 받습니다.");
        if (list) list.textContent = "";
      });
  }

  function refreshFiles() {
    if (!user) {
      setNote("로그인한 뒤에 이 항목의 파일을 받습니다.");
      if (list) list.textContent = "";
      return Promise.resolve();
    }
    if (!timer) {
      timer = setInterval(function () {
        if (user) refreshFiles();
      }, 5000);
    }
    return fetch("/api/work/jobs", { credentials: "same-origin" })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          setNote(result.body.error || "결과를 가져오지 못했습니다.");
          if (list) list.textContent = "";
          return;
        }
        paintFiles((result.body.jobs || []).filter(function (job) {
          return job.product === productId;
        }));
      })
      .catch(function () {
        setNote("계정 서버에 연결하지 못했습니다. 연결되면 이 항목의 파일을 받습니다.");
      });
  }

  function paintFiles(jobs) {
    if (list) list.textContent = "";
    var done = jobs.filter(function (job) { return String(job.status || "").toLowerCase() === "done"; });
    if (!done.length) {
      setNote(jobs.length
        ? "처리가 끝나면 이 항목에서 파일을 받습니다."
        : "이 항목에서 받을 파일이 아직 없습니다.");
      return;
    }
    setNote("이 계정의 파일만 받습니다. 공개 주소로는 열리지 않습니다.");
    done.forEach(function (job) {
      var row = document.createElement("div");
      row.className = "work-file-row";
      var name = document.createElement("span");
      name.textContent = job.name || job.id;
      row.appendChild(name);
      kindsFor(job).forEach(function (item) {
        var output = (job.outputs || {})[item.kind] || {};
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-work-download", item.kind);
        button.setAttribute("data-job-id", job.id);
        button.textContent = item.label;
        button.disabled = !output.ready;
        row.appendChild(button);
      });
      if (list) list.appendChild(row);
    });
  }

  function kindsFor(job) {
    if (productId === "curved-formwork") return FORMWORK;
    return ["model", "quantity", "cnc"].map(function (kind) {
      var output = (job.outputs || {})[kind];
      if (!output || !output.ready) return null;
      return { kind: kind, label: output.name || "파일" };
    }).filter(Boolean);
  }

  function saveDownload(jobId, kind, label) {
    if (!jobId || !kind) return;
    setNote(label + " 받는 중");
    fetch("/api/work/jobs/" + encodeURIComponent(jobId) + "/" + kind, { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("download");
        var match = /filename\*=UTF-8''([^;]+)/.exec(response.headers.get("Content-Disposition") || "");
        var name = match ? decodeURIComponent(match[1]) : label;
        return response.blob().then(function (blob) {
          return { blob: blob, name: name };
        });
      })
      .then(function (file) {
        var url = URL.createObjectURL(file.blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setNote("이 계정의 파일만 받습니다. 공개 주소로는 열리지 않습니다.");
      })
      .catch(function () {
        setNote("파일을 받지 못했습니다.");
      });
  }

  function setNote(text) {
    if (note) note.textContent = text;
  }
})();
