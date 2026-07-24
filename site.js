(function () {
  const storage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (_) {
        // The experience still works when storage is blocked.
      }
    }
  };

  const navToggle = document.querySelector("[data-nav-toggle]");
  const navLinks = document.querySelector("[data-nav-links]");

  if (navToggle && navLinks) {
    const closeNav = () => {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
      navLinks.classList.remove("is-open");
    };

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
      navLinks.classList.toggle("is-open", !isOpen);
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        closeNav();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNav();
      }
    });
  }

  const modal = document.querySelector("[data-age-modal]");
  const confirmButton = modal?.querySelector("[data-age-confirm]");
  const cancelButton = modal?.querySelector("[data-age-cancel]");
  const AGE_KEY = "centrallion-age-confirmed";
  let pendingAction = null;
  let returnFocus = null;

  const focusableSelector = [
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  const closeAgeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("is-locked");
    pendingAction = null;
    if (returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus();
    }
  };

  const runAgeChecked = (action, trigger) => {
    if (storage.get(AGE_KEY) === "yes") {
      action();
      return;
    }

    if (!modal) return;
    pendingAction = action;
    returnFocus = trigger || document.activeElement;
    modal.hidden = false;
    document.body.classList.add("is-locked");
    window.setTimeout(() => confirmButton?.focus(), 0);
  };

  confirmButton?.addEventListener("click", () => {
    const action = pendingAction;
    storage.set(AGE_KEY, "yes");
    if (modal) modal.hidden = true;
    document.body.classList.remove("is-locked");
    pendingAction = null;
    if (typeof action === "function") {
      action();
    }
  });

  cancelButton?.addEventListener("click", closeAgeModal);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAgeModal();
    }
  });

  modal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAgeModal();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.querySelectorAll("[data-age-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || storage.get(AGE_KEY) === "yes") return;
      event.preventDefault();
      runAgeChecked(() => {
        window.location.href = href;
      }, link);
    });
  });

  const gameLoader = document.querySelector("[data-game-loader]");
  const gameFrame = document.querySelector("[data-game-frame]");
  const gamePlaceholder = document.querySelector("[data-game-placeholder]");

  const loadGame = () => {
    if (!gameFrame) return;
    const source = gameFrame.getAttribute("data-src");
    if (!source || gameFrame.getAttribute("src")) return;
    gameFrame.setAttribute("src", source);
    gameFrame.hidden = false;
    if (gamePlaceholder) {
      gamePlaceholder.hidden = true;
    }
  };

  gameLoader?.addEventListener("click", () => {
    runAgeChecked(loadGame, gameLoader);
  });

  const fullscreenButton = document.querySelector("[data-fullscreen]");
  const playStage = document.querySelector("[data-play-stage]");

  fullscreenButton?.addEventListener("click", async () => {
    if (!playStage?.requestFullscreen) return;
    try {
      await playStage.requestFullscreen();
    } catch (_) {
      // Fullscreen may be blocked by browser or embedded context.
    }
  });

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
})();
