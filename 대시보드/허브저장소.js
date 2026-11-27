(function (global) {
  var GUEST_KEY = "spacecode-dash-hub-v5";
  var seed = null;
  var ready = null;
  var mode = "guest";
  var storageKey = GUEST_KEY;
  var sessionWaiters = [];

  function emptyData() {
    return {
      tasks: [],
      projects: [],
      team: [],
      messages: [],
      events: [],
      settings: {
        notifyMail: true,
        notifyPush: false,
        weekStart: "mon",
        language: "ko"
      }
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadLocal(key) {
    try {
      var raw = localStorage.getItem(key || storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveLocal(data) {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function loadSeed() {
    return fetch("data.json?v=fire1", { credentials: "same-origin" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        seed = json || emptyData();
        return seed;
      })
      .catch(function () {
        seed = emptyData();
        return seed;
      });
  }

  function boot() {
    if (ready) return ready;
    ready = loadSeed().then(function () {
      var local = loadLocal();
      if (!local) {
        local = mode === "user" ? emptyData() : clone(seed);
        saveLocal(local);
      }
      return local;
    });
    return ready;
  }

  function mutate(fn) {
    return boot().then(function (data) {
      fn(data);
      saveLocal(data);
      return clone(data);
    });
  }

  function readCachedUser() {
    try {
      return JSON.parse(sessionStorage.getItem("bc-dash-user") || "null");
    } catch (err) {
      return null;
    }
  }

  function writeCachedUser(user) {
    if (user && (user.email || user.name)) {
      sessionStorage.setItem("bc-dash-user", JSON.stringify({
        name: String(user.name || "").trim(),
        email: String(user.email || "").trim()
      }));
      return;
    }
    sessionStorage.removeItem("bc-dash-user");
  }

  function setSession(user) {
    var nextMode = user && (user.email || user.name) ? "user" : "guest";
    var nextKey = nextMode === "user"
      ? "spacecode-dash-hub-user-" + String(user.email || user.name).toLowerCase()
      : GUEST_KEY;

    writeCachedUser(nextMode === "user" ? user : null);

    if (nextMode === mode && nextKey === storageKey && ready) {
      return ready.then(function (data) { return clone(data); });
    }

    mode = nextMode;
    storageKey = nextKey;
    ready = loadSeed().then(function () {
      var local = loadLocal();
      if (!local) {
        local = mode === "user" ? emptyData() : clone(seed);
        saveLocal(local);
      }
      sessionWaiters.splice(0).forEach(function (fn) { fn(clone(local)); });
      return local;
    });
    return ready.then(function (data) { return clone(data); });
  }

  (function restoreCachedSession() {
    var cached = readCachedUser();
    if (!cached || !(cached.email || cached.name)) return;
    mode = "user";
    storageKey = "spacecode-dash-hub-user-" + String(cached.email || cached.name).toLowerCase();
  })();

  global.DashHub = {
    ready: boot,
    setSession: setSession,
    cachedUser: readCachedUser,
    clearCachedUser: function () { writeCachedUser(null); },
    isUser: function () { return mode === "user"; },
    get: function () {
      return boot().then(function (data) { return clone(data); });
    },
    reset: function () {
      return boot().then(function () {
        var data = mode === "user" ? emptyData() : clone(seed);
        saveLocal(data);
        return clone(data);
      });
    },
    isEmpty: function (data) {
      data = data || {};
      return !(data.tasks && data.tasks.length) &&
        !(data.projects && data.projects.length) &&
        !(data.team && data.team.length) &&
        !(data.messages && data.messages.length) &&
        !(data.events && data.events.length);
    },
    addProject: function (project) {
      return mutate(function (data) {
        var boards = {
          "거푸집": "거푸집.html",
          "화재경보": "화재경보.html"
        };
        project.id = "p" + Date.now();
        project.href = boards[project.board] || "프로젝트관리.html";
        project.status = project.status || "진행중";
        project.priority = project.priority || "보통";
        project.progress = 0;
        project.done = 0;
        project.total = 0;
        data.projects.unshift(project);
      });
    },
    addTask: function (task) {
      return mutate(function (data) {
        task.id = "t" + Date.now();
        task.done = !!task.done;
        data.tasks.unshift(task);
      });
    },
    toggleTask: function (id) {
      return mutate(function (data) {
        data.tasks.forEach(function (task) {
          if (task.id === id) {
            task.done = !task.done;
            task.status = task.done ? "완료" : (task.status === "완료" ? "진행" : task.status);
          }
        });
      });
    },
    removeTask: function (id) {
      return mutate(function (data) {
        data.tasks = data.tasks.filter(function (task) { return task.id !== id; });
      });
    },
    addTeam: function (member) {
      return mutate(function (data) {
        member.id = "m" + Date.now();
        data.team.push(member);
      });
    },
    removeTeam: function (id) {
      return mutate(function (data) {
        data.team = data.team.filter(function (member) { return member.id !== id; });
      });
    },
    markMessage: function (id, read) {
      return mutate(function (data) {
        data.messages.forEach(function (msg) {
          if (msg.id === id) msg.read = !!read;
        });
      });
    },
    markAllMessages: function (read) {
      return mutate(function (data) {
        data.messages.forEach(function (msg) { msg.read = !!read; });
      });
    },
    addEvent: function (event) {
      return mutate(function (data) {
        event.id = "e" + Date.now();
        data.events.push(event);
      });
    },
    saveSettings: function (settings) {
      return mutate(function (data) {
        data.settings = Object.assign({}, data.settings || {}, settings);
      });
    },
    unreadCount: function (data) {
      return (data.messages || []).filter(function (msg) { return !msg.read; }).length;
    },
    stats: function (data) {
      var tasks = data.tasks || [];
      var open = tasks.filter(function (task) { return !task.done; });
      var done = tasks.filter(function (task) { return task.done; });
      var risk = open.filter(function (task) {
        return task.priority === "높음" || task.status === "지연";
      });
      var progress = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
      return {
        activeProjects: (data.projects || []).length,
        openTasks: open.length,
        doneTasks: done.length,
        riskTasks: risk.length,
        weekProgress: progress,
        unread: this.unreadCount(data)
      };
    }
  };
})(window);
