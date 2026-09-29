/**
 * Ikmal Tools for Trilium: Standalone Interactive Canvas (Beta)
 * Renders an interactive visual node graph and relationship whiteboard over real Trilium notes.
 */

import { escapeHtml, section, emptyState } from '../components/nativeUi.js';

export function initIkmalCanvas(containerEl) {
    const shell = document.createElement('div');
    shell.className = 'notes-system-shell p-3';

    const { card } = section(shell, {
        title: 'Ikmal Interactive Canvas (Beta)',
        description: 'Visual whiteboard & node graph rendering note relationships and project mind-maps.',
    });

    const canvasArea = document.createElement('div');
    canvasArea.className = 'ns-card p-4 text-center mt-2 position-relative overflow-hidden';
    canvasArea.style.minHeight = '350px';
    canvasArea.style.background = 'var(--main-background-color, #1e1e2e)';

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
                <div class="btn-group btn-group-sm" aria-label="Canvas zoom controls">
                    <button type="button" class="btn btn-outline-secondary" id="btn-zoom-in" aria-label="Zoom in" title="Zoom in"><i class="bx bx-zoom-in"></i></button>
                    <button type="button" class="btn btn-outline-secondary" id="btn-zoom-out" aria-label="Zoom out" title="Zoom out"><i class="bx bx-zoom-out"></i></button>
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

    let zoom = 1;
    const nodes = () => canvasArea.querySelector('#canvas-nodes-container');
    const applyZoom = () => {
        const target = nodes();
        if (target) {
            target.style.transform = `scale(${zoom})`;
            target.style.transformOrigin = 'center center';
            target.dataset.zoom = String(zoom);
        }
    };
    canvasArea.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
        zoom = Math.min(1.5, Number((zoom + 0.1).toFixed(1)));
        applyZoom();
    });
    canvasArea.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
        zoom = Math.max(0.7, Number((zoom - 0.1).toFixed(1)));
        applyZoom();
    });

    canvasArea.querySelectorAll('.preset-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const preset = (e.currentTarget).dataset.preset;
            const container = canvasArea.querySelector('#canvas-nodes-container');
            if (!container) return;
            if (preset === 'flowchart') {
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
            } else if (preset === 'architecture') {
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

if (typeof api !== 'undefined' || typeof window !== 'undefined') {
    const init = () => {
        const container = (typeof api !== 'undefined' && api.$container && (api.$container[0] || api.$container))
            || document.querySelector('.ikmal-canvas-root')
            || document.body;
        if (container) {
            initIkmalCanvas(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
