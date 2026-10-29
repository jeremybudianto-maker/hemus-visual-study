/* Shared interactions for the HEMUS visual study. No framework is required. */
(() => {
  "use strict";

  document.documentElement.classList.add("js");

  function initNavigation() {
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.getElementById("primary-nav");
    if (!toggle || !nav) return;

    const setOpen = (open, restoreFocus = false) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      if (restoreFocus) toggle.focus();
    };

    setOpen(false);
    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false, true);
      }
    });

    // Observe the real CSS breakpoint rather than maintaining a second one here.
    let resizePending = false;
    window.addEventListener("resize", () => {
      if (resizePending) return;
      resizePending = true;
      window.requestAnimationFrame(() => {
        resizePending = false;
        if (window.getComputedStyle(toggle).display === "none") setOpen(false);
      });
    }, { passive: true });
  }

  function initGallery() {
    const rows = Array.from(document.querySelectorAll(".screenshot-row"));
    if (!rows.length) return;

    const filterBar = document.getElementById("gallery-filter");
    const filters = filterBar ? Array.from(filterBar.querySelectorAll("button[data-filter]")) : [];
    const count = document.getElementById("gallery-count");
    const emptyState = document.getElementById("gallery-empty");
    const dialog = document.getElementById("image-dialog");
    const image = document.getElementById("lightbox-image");
    const title = document.getElementById("lightbox-title");
    const description = document.getElementById("lightbox-description");
    const counter = document.getElementById("lightbox-counter");
    const category = document.getElementById("lightbox-category");
    const videoLink = document.getElementById("lightbox-video-link");
    const previous = document.getElementById("lightbox-prev");
    const next = document.getElementById("lightbox-next");
    const close = document.getElementById("lightbox-close");
    let selectedRow = null;
    let opener = null;
    let previousOverflow = "";

    const visibleRows = () => rows.filter((row) => !row.hidden);

    function applyFilter(value) {
      rows.forEach((row) => {
        row.hidden = value !== "all" && row.dataset.category !== value;
      });
      filters.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.filter === value));
      });
      const visible = visibleRows().length;
      if (count) count.textContent = `Showing ${visible} of ${rows.length} frames`;
      if (emptyState) emptyState.hidden = visible !== 0;
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => applyFilter(button.dataset.filter || "all"));
    });
    applyFilter("all");

    const rowForHash = (hash) => {
      if (!hash.startsWith("#frame-")) return null;
      let id;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch (_) {
        return null;
      }
      const target = document.getElementById(id);
      return rows.includes(target) ? target : null;
    };

    // Reveal a linked frame before the browser performs its normal anchor jump.
    document.querySelectorAll('a[href^="#frame-"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const row = rowForHash(link.getAttribute("href") || "");
        if (row?.hidden) applyFilter("all");
      });
    });
    window.addEventListener("hashchange", () => {
      const row = rowForHash(window.location.hash);
      if (row?.hidden) {
        applyFilter("all");
        row.scrollIntoView({ block: "start", behavior: "auto" });
      }
    });

    if (!dialog || !image || !title || typeof dialog.showModal !== "function") return;

    function renderRow(row) {
      const rowImage = row.querySelector("img");
      if (!rowImage) return;
      const visible = visibleRows();
      const position = visible.indexOf(row);
      const number = String(rows.indexOf(row) + 1).padStart(2, "0");
      const time = row.querySelector(".shot-time")?.textContent.trim() || "";
      selectedRow = row;
      image.src = rowImage.currentSrc || rowImage.src;
      image.alt = rowImage.alt;
      title.textContent = `Frame ${number}${time ? ` · ${time}` : ""}`;
      if (description) description.textContent = row.querySelector(".screenshot-description")?.textContent.trim() || "";
      if (category) category.textContent = row.querySelector(".category-label")?.textContent.trim() || "";
      if (counter) counter.textContent = `${position + 1} / ${visible.length}`;
      if (previous) previous.disabled = visible.length < 2;
      if (next) next.disabled = visible.length < 2;
      if (videoLink && row.dataset.video) videoLink.href = row.dataset.video;
    }

    function openRow(row, trigger) {
      opener = trigger;
      renderRow(row);
      if (!dialog.open) {
        previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
      }
      if (close) close.focus();
    }

    function changeFrame(direction) {
      const visible = visibleRows();
      if (!visible.length) return;
      const current = visible.indexOf(selectedRow);
      const index = (Math.max(0, current) + direction + visible.length) % visible.length;
      renderRow(visible[index]);
    }

    rows.forEach((row) => {
      const button = row.querySelector(".screenshot-image-button");
      if (button) button.addEventListener("click", () => openRow(row, button));
    });
    previous?.addEventListener("click", () => changeFrame(-1));
    next?.addEventListener("click", () => changeFrame(1));
    close?.addEventListener("click", () => dialog.close());

    dialog.addEventListener("keydown", (event) => {
      if (!dialog.open) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        changeFrame(event.key === "ArrowLeft" ? -1 : 1);
      }
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (outside) dialog.close();
    });
    // Native dialog Escape handling provides the same cleanup as the close button.
    dialog.addEventListener("close", () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected && !opener.closest(".screenshot-row")?.hidden) {
        opener.focus();
      } else {
        filters.find((button) => button.getAttribute("aria-pressed") === "true")?.focus();
      }
    });
  }

  function initReflection() {
    const editor = document.getElementById("reflection-text");
    if (!editor) return;
    const preview = document.getElementById("reflection-preview");
    const wordCount = document.getElementById("word-count");
    const wordStatus = document.getElementById("word-status");
    const saveStatus = document.getElementById("save-status");
    const thirdViewing = document.getElementById("third-viewing-note");
    const save = document.getElementById("save-reflection");
    const copy = document.getElementById("copy-reflection");
    const reflectionKey = "hemus-reflection-v1";
    const viewingKey = "hemus-third-viewing-v1";

    const status = (message) => {
      if (saveStatus) saveStatus.textContent = message;
    };

    function refresh() {
      const text = editor.value.trim();
      // Count a timestamp as one item and keep apostrophes within English words.
      const matches = text.match(/\b\d{1,2}:\d{2}\b|[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*(?:[-–][A-Za-z0-9]+)*/g);
      const total = matches ? matches.length : 0;
      if (wordCount) wordCount.textContent = `${total} words / target 150–200`;
      if (wordStatus) {
        if (total < 150) {
          wordStatus.textContent = `Add at least ${150 - total} more words.`;
          wordStatus.dataset.status = "short";
        } else if (total > 200) {
          wordStatus.textContent = `Remove at least ${total - 200} words.`;
          wordStatus.dataset.status = "long";
        } else {
          wordStatus.textContent = "Within the 150–200 word range.";
          wordStatus.dataset.status = "ready";
        }
      }
      if (preview) {
        preview.replaceChildren();
        const paragraphs = text ? text.split(/\n\s*\n/) : ["Your reflection will appear here."];
        paragraphs.forEach((part) => {
          const p = document.createElement("p");
          p.textContent = part;
          if (!text) p.className = "empty-state";
          preview.append(p);
        });
      }
    }

    // Saved writing stays on this device. It is never sent to a server.
    try {
      const savedReflection = window.localStorage.getItem(reflectionKey);
      const savedViewing = window.localStorage.getItem(viewingKey);
      if (savedReflection !== null) editor.value = savedReflection;
      if (thirdViewing && savedViewing !== null) thirdViewing.value = savedViewing;
      if (savedReflection !== null || savedViewing !== null) status("Your saved draft is loaded from this device.");
    } catch (_) {
      // Private browsing or file permissions can disable storage; editing still works.
    }

    editor.addEventListener("input", () => {
      refresh();
      status("Unsaved changes.");
    });
    thirdViewing?.addEventListener("input", () => status("Unsaved changes."));
    save?.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        window.localStorage.setItem(reflectionKey, editor.value);
        if (thirdViewing) window.localStorage.setItem(viewingKey, thirdViewing.value);
        status("Reflection and notes saved on this device.");
      } catch (_) {
        status("This browser cannot save your draft. Use Copy reflection to keep your writing.");
      }
    });

    copy?.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(editor.value);
        status("Reflection copied.");
      } catch (_) {
        editor.focus();
        editor.select();
        status("Select and copy the highlighted text to keep your reflection.");
      }
    });
    refresh();
  }

  function initVideo() {
    const button = document.getElementById("load-video");
    const frame = button?.closest(".video-frame");
    if (!button || !frame) return;
    button.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/JlwNP_0U36A?autoplay=1&rel=0";
      iframe.title = 'HEMUS — "IN MY HAND YOUR NAME IN BLACK" music video';
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      frame.replaceChildren(iframe);
      iframe.focus();
    }, { once: true });
  }

  function init() {
    initNavigation();
    initGallery();
    initReflection();
    initVideo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
