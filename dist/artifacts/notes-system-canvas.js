"use strict";
(() => {
  // src/components/nativeUi.ts
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function section(parent, { title, description, actions, collapsible } = {}) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "ns-section";
    const card = document.createElement("div");
    card.className = "ns-section-card";
    if (title || actions?.length || collapsible) {
      const header = document.createElement("div");
      header.className = "ns-section-header d-flex justify-content-between align-items-center";
      header.innerHTML = `<h4 class="ns-section-title m-0">${escapeHtml(title ?? "")}</h4>`;
      const headerRight = document.createElement("div");
      headerRight.className = "ns-actions d-flex align-items-center gap-2";
      if (actions?.length) {
        actions.forEach((a) => headerRight.appendChild(a));
      }
      if (collapsible) {
        const toggleBtn = iconAction({
          icon: "bx-chevron-up",
          title: "Collapse section",
          onClick: () => {
            const isHidden = card.hidden;
            card.hidden = !isHidden;
            toggleBtn.querySelector("span")?.setAttribute("class", `bx ${card.hidden ? "bx-chevron-down" : "bx-chevron-up"}`);
          }
        });
        headerRight.appendChild(toggleBtn);
      }
      header.appendChild(headerRight);
      sectionEl.appendChild(header);
    }
    if (description) {
      const p = document.createElement("p");
      p.className = "ns-section-description";
      p.textContent = description;
      card.appendChild(p);
    }
    sectionEl.appendChild(card);
    parent.appendChild(sectionEl);
    return { section: sectionEl, card };
  }
  function bindAsyncClick(button, onClick) {
    button.addEventListener("click", () => {
      try {
        Promise.resolve(onClick()).catch((error) => {
          console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
        });
      } catch (error) {
        console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
      }
    });
  }
  function iconAction({ icon, title, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-action";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = `<span class="bx ${escapeHtml(icon)}"></span>`;
    bindAsyncClick(btn, onClick);
    return btn;
  }
  function showToast(opts, typeArg, durationArg) {
    if (typeof document === "undefined") return;
    const message = typeof opts === "string" ? opts : opts.message;
    const type = typeof opts === "string" ? typeArg || "success" : opts.type || "success";
    const durationMs = typeof opts === "string" ? durationArg ?? 3500 : opts.durationMs ?? 3500;
    const undoAction = typeof opts === "string" ? void 0 : opts.undoAction;
    let container = document.querySelector(".ns-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "ns-toast-container";
      container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 1060; display: flex; flex-direction: column; gap: 8px; max-width: 360px; pointer-events: none;";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    const bgClass = type === "success" ? "bg-success" : type === "warning" ? "bg-warning text-dark" : type === "danger" ? "bg-danger" : "bg-primary";
    const icon = type === "success" ? "bx-check-circle" : type === "warning" ? "bx-error" : type === "danger" ? "bx-x-circle" : "bx-info-circle";
    toast.className = `toast show align-items-center text-white ${bgClass} border-0 shadow-lg`;
    toast.style.cssText = "pointer-events: auto; transition: all 0.3s ease; opacity: 1; transform: translateY(0);";
    toast.innerHTML = `
        <div class="d-flex p-2.5">
            <div class="toast-body d-flex align-items-center gap-2 small">
                <i class="bx ${icon} fs-6"></i>
                <span>${escapeHtml(message)}</span>
                ${undoAction ? `<button type="button" class="btn btn-micro btn-light text-dark ms-2 undo-btn">Undo</button>` : ""}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto close-toast-btn" aria-label="Close"></button>
        </div>
    `;
    if (undoAction) {
      toast.querySelector(".undo-btn")?.addEventListener("click", () => {
        undoAction();
        removeToast();
      });
    }
    const removeToast = () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector(".close-toast-btn")?.addEventListener("click", removeToast);
    container.appendChild(toast);
    if (durationMs > 0) {
      setTimeout(removeToast, durationMs);
    }
  }
  if (typeof window !== "undefined") {
    window.__ikmalToast = showToast;
  }

  // src/artifacts/notes-system-canvas.jsx
  function initIkmalCanvas(containerEl) {
    const shell = document.createElement("div");
    shell.className = "notes-system-shell p-3";
    const { card } = section(shell, {
      title: "Ikmal Interactive Canvas (Beta)",
      description: "Visual whiteboard & node graph rendering note relationships and project mind-maps."
    });
    const canvasArea = document.createElement("div");
    canvasArea.className = "ns-card p-4 text-center mt-2 position-relative overflow-hidden";
    canvasArea.style.minHeight = "350px";
    canvasArea.style.background = "var(--main-background-color, #1e1e2e)";
    canvasArea.innerHTML = `
        <div class="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2 flex-wrap gap-2">
            <div class="d-flex align-items-center gap-2">
                <i class="bx bx-network-chart fs-3 text-primary"></i>
                <span class="fw-bold">Visual Node Graph</span>
                <span class="badge bg-warning text-dark small">Beta</span>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="tiny text-muted fw-bold">Presets:</span>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary preset-btn" data-preset="mindmap"><i class="bx bx-sitemap"></i> Mindmap</button>
                    <button class="btn btn-outline-secondary preset-btn" data-preset="flowchart"><i class="bx bx-git-repo-forked"></i> Flowchart</button>
                    <button class="btn btn-outline-secondary preset-btn" data-preset="architecture"><i class="bx bx-cube-alt"></i> Architecture</button>
                </div>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" id="btn-zoom-in"><i class="bx bx-zoom-in"></i></button>
                    <button class="btn btn-outline-secondary" id="btn-zoom-out"><i class="bx bx-zoom-out"></i></button>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-center align-items-center gap-4 py-5 flex-wrap" id="canvas-nodes-container">
            <div class="p-3 border rounded shadow-sm bg-body position-relative text-start" style="width: 200px; border-left: 4px solid var(--bs-primary, #4f46e5) !important;">
                <div class="badge bg-primary mb-1">Project Hub</div>
                <h6 class="mb-1 fw-bold">Ikmal Tools v1.0</h6>
                <small class="text-muted">3 connected notes</small>
            </div>
            <i class="bx bx-right-arrow-alt fs-2 text-muted"></i>
            <div class="p-3 border rounded shadow-sm bg-body position-relative text-start" style="width: 200px; border-left: 4px solid var(--bs-success, #10b981) !important;">
                <div class="badge bg-success mb-1">Task</div>
                <h6 class="mb-1 fw-bold">FleetSync Integration</h6>
                <small class="text-muted">Targeted item sync</small>
            </div>
        </div>

        <div class="alert alert-info border small text-muted mb-0 mt-3">
            <i class="bx bx-info-circle me-1"></i> Interactive drag-and-drop node placement and connection line drawing are currently in Beta.
        </div>
    `;
    canvasArea.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const preset = e.currentTarget.dataset.preset;
        const container = canvasArea.querySelector("#canvas-nodes-container");
        if (!container) return;
        if (preset === "flowchart") {
          container.innerHTML = `
                    <div class="p-3 border rounded shadow-sm bg-body text-start" style="width: 180px; border-left: 4px solid #3b82f6 !important;">
                        <span class="badge bg-info mb-1">Start</span>
                        <h6 class="m-0 fw-bold">1. Receive Input</h6>
                    </div>
                    <i class="bx bx-right-arrow-alt fs-2 text-muted"></i>
                    <div class="p-3 border rounded shadow-sm bg-body text-start" style="width: 180px; border-left: 4px solid #f59e0b !important;">
                        <span class="badge bg-warning text-dark mb-1">Process</span>
                        <h6 class="m-0 fw-bold">2. Run Validation</h6>
                    </div>
                    <i class="bx bx-right-arrow-alt fs-2 text-muted"></i>
                    <div class="p-3 border rounded shadow-sm bg-body text-start" style="width: 180px; border-left: 4px solid #10b981 !important;">
                        <span class="badge bg-success mb-1">End</span>
                        <h6 class="m-0 fw-bold">3. Materialize Note</h6>
                    </div>
                `;
        } else if (preset === "architecture") {
          container.innerHTML = `
                    <div class="p-3 border rounded shadow-sm bg-body text-start" style="width: 180px; border-left: 4px solid #8b5cf6 !important;">
                        <span class="badge bg-primary mb-1">Frontend UI</span>
                        <h6 class="m-0 fw-bold">Trilium Render Note</h6>
                    </div>
                    <i class="bx bx-transfer fs-2 text-muted"></i>
                    <div class="p-3 border rounded shadow-sm bg-body text-start" style="width: 180px; border-left: 4px solid #ec4899 !important;">
                        <span class="badge bg-danger mb-1">Backend Handler</span>
                        <h6 class="m-0 fw-bold">create-note-api</h6>
                    </div>
                    <i class="bx bx-transfer fs-2 text-muted"></i>
                    <div class="p-3 border rounded shadow-sm bg-body text-start" style="width: 180px; border-left: 4px solid #06b6d4 !important;">
                        <span class="badge bg-info mb-1">Storage</span>
                        <h6 class="m-0 fw-bold">Trilium Database</h6>
                    </div>
                `;
        } else {
          container.innerHTML = `
                    <div class="p-3 border rounded shadow-sm bg-body position-relative text-start" style="width: 200px; border-left: 4px solid var(--bs-primary, #4f46e5) !important;">
                        <div class="badge bg-primary mb-1">Project Hub</div>
                        <h6 class="mb-1 fw-bold">Ikmal Tools v1.0</h6>
                        <small class="text-muted">3 connected notes</small>
                    </div>
                    <i class="bx bx-right-arrow-alt fs-2 text-muted"></i>
                    <div class="p-3 border rounded shadow-sm bg-body position-relative text-start" style="width: 200px; border-left: 4px solid var(--bs-success, #10b981) !important;">
                        <div class="badge bg-success mb-1">Task</div>
                        <h6 class="mb-1 fw-bold">FleetSync Integration</h6>
                        <small class="text-muted">Targeted item sync</small>
                    </div>
                `;
        }
      });
    });
    card.appendChild(canvasArea);
    shell.appendChild(card);
    containerEl.appendChild(shell);
  }
  if (typeof api !== "undefined" || typeof window !== "undefined") {
    const init = () => {
      const container = typeof api !== "undefined" && api.$container && (api.$container[0] || api.$container) || document.querySelector(".ikmal-canvas-root") || document.body;
      if (container) {
        initIkmalCanvas(container);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})();
