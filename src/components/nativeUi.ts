/**
 * Primitives that mirror Trilium's own settings UI.
 *
 * Trilium builds its options pages from a small vocabulary — a page header, a
 * titled section wrapping a card, a row per setting, a toggle — and every page in
 * the app is assembled from those four things. These helpers are the plain-DOM
 * equivalents, producing the same markup shape and the same class contract as
 * `apps/client/src/widgets/type_widgets/options/components/*` so plugin pages look
 * like part of the app instead of a Bootstrap dashboard hosted inside it.
 *
 * The matching styles live in `src/artifacts/notes-system.css`.
 */

/** Escapes text before it is interpolated into an innerHTML template. */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export interface PageHeaderOptions {
    /** Boxicons class without the `bx ` prefix, e.g. `bx-slider-alt`. */
    icon: string;
    title: string;
    subtitle?: string;
    /** Buttons rendered on the trailing edge of the title row. */
    actions?: HTMLElement[];
}

/** The sticky title bar a page renders above its sections. */
export function pageHeader({ icon, title, subtitle, actions }: PageHeaderOptions): HTMLElement {
    // The bar spans the full pane so its bottom border does, but its contents are
    // held to the same column as the sections below — as Trilium's own
    // `.options-page-header-inner` does — so the title and actions line up with the
    // cards instead of drifting to the pane edge.
    const header = document.createElement('div');
    header.className = 'ns-page-header';

    const inner = document.createElement('div');
    inner.className = 'ns-page-header-inner';
    inner.innerHTML = `
        <span class="ns-page-header-icon bx ${escapeHtml(icon)}" aria-hidden="true"></span>
        <div class="ns-page-header-titles">
            <h2 class="ns-page-header-title">${escapeHtml(title)}</h2>
            ${subtitle ? `<p class="ns-page-header-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
    `;

    if (actions?.length) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'ns-page-header-actions';
        actions.forEach((a) => actionsEl.appendChild(a));
        inner.appendChild(actionsEl);
    }

    header.appendChild(inner);
    return header;
}

export interface SectionOptions {
    /** Rendered above the card in uppercase micro-caps, as Trilium does. */
    title?: string;
    /** Explanatory paragraph rendered as the first thing inside the card. */
    description?: string;
    /** Controls rendered beside the title, outside the card. */
    actions?: HTMLElement[];
    /** Allows section card to be collapsed/expanded. */
    collapsible?: boolean;
}

/**
 * A titled settings section. Returns the card so callers can append rows to it;
 * the section itself is already attached to `parent`.
 */
export function section(parent: HTMLElement, { title, description, actions, collapsible }: SectionOptions = {}): {
    section: HTMLElement;
    card: HTMLElement;
} {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'ns-section';

    const card = document.createElement('div');
    card.className = 'ns-section-card';

    if (title || actions?.length || collapsible) {
        const header = document.createElement('div');
        header.className = 'ns-section-header d-flex justify-content-between align-items-center';
        header.innerHTML = `<h4 class="ns-section-title m-0">${escapeHtml(title ?? '')}</h4>`;

        const headerRight = document.createElement('div');
        headerRight.className = 'ns-actions d-flex align-items-center gap-2';

        if (actions?.length) {
            actions.forEach((a) => headerRight.appendChild(a));
        }

        if (collapsible) {
            const toggleBtn = iconAction({
                icon: 'bx-chevron-up',
                title: 'Collapse section',
                onClick: () => {
                    const isHidden = card.hidden;
                    card.hidden = !isHidden;
                    toggleBtn.querySelector('span')?.setAttribute('class', `bx ${card.hidden ? 'bx-chevron-down' : 'bx-chevron-up'}`);
                },
            });
            headerRight.appendChild(toggleBtn);
        }

        header.appendChild(headerRight);
        sectionEl.appendChild(header);
    }

    if (description) {
        const p = document.createElement('p');
        p.className = 'ns-section-description';
        p.textContent = description;
        card.appendChild(p);
    }

    sectionEl.appendChild(card);
    parent.appendChild(sectionEl);

    return { section: sectionEl, card };
}

export interface RowOptions {
    label: string;
    description?: string;
    /** Associates the label with the control for screen readers and click-to-focus. */
    htmlFor?: string;
    /**
     * Keeps the row inline on narrow panes. Use for rows whose control is small
     * (a toggle or a button); wide controls read better stacked.
     */
    compact?: boolean;
    /** Puts the control on its own full-width line beneath the label. */
    stacked?: boolean;
}

/** One setting: label and description leading, a single control trailing. */
export function row(control: HTMLElement | string, { label, description, htmlFor, compact, stacked }: RowOptions): HTMLElement {
    const rowEl = document.createElement('div');
    rowEl.className = `ns-row${compact ? ' ns-row-compact' : ''}${stacked ? ' ns-row-stacked' : ''}`;
    rowEl.innerHTML = `
        <div class="ns-row-label">
            <label${htmlFor ? ` for="${escapeHtml(htmlFor)}"` : ''}>${escapeHtml(label)}</label>
            ${description ? `<small class="ns-row-desc">${escapeHtml(description)}</small>` : ''}
        </div>
    `;

    const input = document.createElement('div');
    input.className = 'ns-row-input';
    if (typeof control === 'string') {
        input.innerHTML = control;
    } else {
        input.appendChild(control);
    }
    rowEl.appendChild(input);

    return rowEl;
}

/** Trilium's toggle switch, markup-compatible with the app's own `FormToggle`. */
export function toggle(id: string, checked: boolean, onChange?: (checked: boolean) => void): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `ns-switch${checked ? ' is-on' : ' is-off'}`;
    wrapper.innerHTML = `
        <label class="ns-switch-control">
            <div class="ns-switch-button${checked ? ' on' : ''}">
                <input type="checkbox" id="${escapeHtml(id)}" role="switch" aria-checked="${checked}" aria-label="Toggle setting"${checked ? ' checked' : ''}>
            </div>
        </label>
        <span class="ns-switch-state" aria-live="polite">${checked ? 'ON' : 'OFF'}</span>
    `;

    const input = wrapper.querySelector('input') as HTMLInputElement;
    const track = wrapper.querySelector('.ns-switch-button') as HTMLElement;
    const state = wrapper.querySelector('.ns-switch-state') as HTMLElement;
    input.addEventListener('change', () => {
        track.classList.toggle('on', input.checked);
        wrapper.classList.toggle('is-on', input.checked);
        wrapper.classList.toggle('is-off', !input.checked);
        input.setAttribute('aria-checked', String(input.checked));
        state.textContent = input.checked ? 'ON' : 'OFF';
        onChange?.(input.checked);
    });

    return wrapper;
}

export interface SwitchRowOptions extends Omit<RowOptions, 'htmlFor' | 'compact'> {
    id: string;
    checked: boolean;
    onChange?: (checked: boolean) => void;
}

/** The common case: a labelled setting whose control is a toggle. */
export function switchRow({ id, checked, onChange, ...rest }: SwitchRowOptions): HTMLElement {
    return row(toggle(id, checked, onChange), { ...rest, htmlFor: id, compact: true });
}

export interface ListItemOptions {
    /** Boxicons class without the `bx ` prefix. */
    icon?: string;
    title: string;
    description?: string;
    /** Dims the item to show it is inactive, instead of adding a status badge. */
    disabled?: boolean;
    actions?: HTMLElement[];
}

/**
 * One entry in a list of peers (a rule, a template, an attribute). Rendered as a
 * hairline-separated row inside the section card rather than as its own card, so
 * lists never turn into a stack of nested boxes.
 */
export function listItem({ icon, title, description, disabled, actions }: ListItemOptions): HTMLElement {
    const item = document.createElement('div');
    item.className = `ns-list-item${disabled ? ' is-disabled' : ''}`;
    item.innerHTML = `
        <div class="ns-list-item-main">
            ${icon ? `<span class="ns-list-item-icon bx ${escapeHtml(icon)}" aria-hidden="true"></span>` : ''}
            <div>
                <span class="ns-list-item-title">${escapeHtml(title)}</span>
                ${description ? `<div class="ns-list-item-desc">${escapeHtml(description)}</div>` : ''}
            </div>
        </div>
    `;

    if (actions?.length) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'ns-list-item-actions';
        actions.forEach((a) => actionsEl.appendChild(a));
        item.appendChild(actionsEl);
    }

    return item;
}

/** Placeholder text for an empty list, in the same muted register as descriptions. */
export function emptyState(text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'ns-empty';
    el.textContent = text;
    return el;
}

export interface ButtonOptions {
    text: string;
    /** Boxicons class without the `bx ` prefix. */
    icon?: string;
    /** Trilium uses `btn-primary` for the one affirmative action and `btn-secondary` elsewhere. */
    kind?: 'primary' | 'secondary';
    size?: 'normal' | 'small' | 'micro';
    title?: string;
    className?: string;
    onClick?: () => void | Promise<void>;
}

function bindAsyncClick(button: HTMLButtonElement, onClick: () => void | Promise<void>): void {
    button.addEventListener('click', () => {
        try {
            Promise.resolve(onClick()).catch((error: any) => {
                console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
            });
        } catch (error: any) {
            console.warn(`[Ikmal Tools] Button action failed: ${error?.message || error}`);
        }
    });
}

/** A button using Trilium's own button classes and size scale. */
export function button({ text, icon, kind = 'secondary', size = 'small', title, className, onClick }: ButtonOptions): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    const sizeClass = size === 'small' ? ' btn-sm' : size === 'micro' ? ' btn-micro' : '';
    btn.className = `btn btn-${kind}${sizeClass}${className ? ` ${className}` : ''}`;
    if (title) btn.title = title;
    btn.innerHTML = `${icon ? `<span class="bx ${escapeHtml(icon)}"></span> ` : ''}${escapeHtml(text)}`;
    if (onClick) bindAsyncClick(btn, onClick);
    return btn;
}

export interface IconActionOptions {
    /** Boxicons class without the `bx ` prefix. */
    icon: string;
    /** Tooltip and accessible name — an icon action carries no visible label. */
    title: string;
    onClick: () => void | Promise<void>;
}

/**
 * An icon-only button using Trilium's `.icon-action`, the app's affordance for
 * per-row and section-header actions. Text buttons carry a min-width that makes a
 * row of them dominate a dense list; these stay out of the way.
 */
export function iconAction({ icon, title, onClick }: IconActionOptions): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-action';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = `<span class="bx ${escapeHtml(icon)}"></span>`;
    bindAsyncClick(btn, onClick);
    return btn;
}

export interface ModalOptions {
    title: string;
    /** Boxicons class without the `bx ` prefix. */
    icon?: string;
    /** Body markup. Callers are responsible for escaping any interpolated values. */
    body: string;
    /** Label of the affirmative action. */
    confirmText: string;
    confirmKind?: 'primary' | 'secondary';
    cancelText?: string;
}

/**
 * A dialog painted with Trilium's modal tokens, so it matches the app's own
 * dialogs in every theme rather than picking its own light/dark colours.
 *
 * Mounted on `<body>` rather than inside the page: the note pane is a container
 * and so would become the containing block for a fixed-position backdrop, and
 * re-rendering the page would tear the dialog down mid-edit.
 *
 * `onConfirm` returning `false` keeps the dialog open (e.g. failed validation).
 */
export function openModal(
    { title, icon, body, confirmText, confirmKind = 'primary', cancelText = 'Cancel' }: ModalOptions,
    onConfirm: (content: HTMLElement) => boolean | void
): HTMLElement {
    const backdrop = document.createElement('div');
    backdrop.className = 'ns-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'ns-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
        <div class="ns-modal-header">
            <h5 class="ns-modal-title">${icon ? `<span class="bx ${escapeHtml(icon)}"></span> ` : ''}${escapeHtml(title)}</h5>
            <button type="button" class="btn-close ns-close" aria-label="Close"></button>
        </div>
        <div class="ns-modal-body">${body}</div>
        <div class="ns-modal-footer">
            <button type="button" class="btn btn-sm btn-secondary ns-close">${escapeHtml(cancelText)}</button>
            <button type="button" class="btn btn-sm btn-${confirmKind} ns-confirm">${escapeHtml(confirmText)}</button>
        </div>
    `;

    const close = () => {
        document.removeEventListener('keydown', onKeyDown);
        backdrop.remove();
    };

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    modal.querySelectorAll('.ns-close').forEach((btn) => btn.addEventListener('click', close));
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', onKeyDown);

    modal.querySelector<HTMLButtonElement>('.ns-confirm')!.addEventListener('click', () => {
        if (onConfirm(modal) !== false) close();
    });

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    modal.querySelector<HTMLElement>('input, select, textarea')?.focus();

    return modal;
}

// ------------------------------------------------------------- searchable select

export interface ComboboxOption {
    value: string;
    label: string;
    description?: string;
    icon?: string;
}

export interface ComboboxHandle<T extends string | string[] = string | string[]> {
    /** Mount this in place of a `<select>`. */
    el: HTMLElement;
    getValue: () => T;
    setValue: (value: T) => void;
    setOptions?: (options: ComboboxOption[]) => void;
}

/**
 * Ranks how well `query` matches `text`: a contiguous substring ranks by how
 * early it starts, an in-order-but-scattered subsequence match ranks below
 * every substring match (so "otx" still finds "Project Task" but after any
 * option that contains "otx" literally), and no match returns null. Deliberately
 * not a real fuzzy-matching library — this is filtering a few dozen curated
 * options, not ranking full-text search results.
 */
export function fuzzyScore(query: string, text: string): number | null {
    if (!query) return 0;
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    const idx = t.indexOf(q);
    if (idx !== -1) return idx;

    let cursor = 0;
    let gaps = 0;
    for (const ch of q) {
        const found = t.indexOf(ch, cursor);
        if (found === -1) return null;
        gaps += found - cursor;
        cursor = found + 1;
    }
    return 1000 + gaps;
}

export function searchableSelect(opts: {
    id: string;
    options: ComboboxOption[];
    value?: string[];
    isMulti: true;
    placeholder?: string;
    onChange?: (value: string[]) => void;
}): ComboboxHandle<string[]>;

export function searchableSelect(opts: {
    id: string;
    options: ComboboxOption[];
    value?: string;
    isMulti?: false;
    placeholder?: string;
    onChange?: (value: string) => void;
}): ComboboxHandle<string>;

export function searchableSelect(opts: {
    id: string;
    options: ComboboxOption[];
    value?: string | string[];
    isMulti?: boolean;
    placeholder?: string;
    onChange?: (value: string | string[]) => void;
}): ComboboxHandle<string | string[]>;

/**
 * A text input with a filtered dropdown of options, for picking one or more values
 * out of a list too long to scan as a native `<select>`. Still a closed picker,
 * not a free-text field: blurring without a valid selection snaps the input
 * back to the current value's label rather than accepting arbitrary text.
 */
export function searchableSelect({
    id,
    options,
    value,
    isMulti,
    placeholder,
    onChange,
}: {
    id: string;
    options: ComboboxOption[];
    value?: string | string[];
    isMulti?: boolean;
    placeholder?: string;
    onChange?: (value: any) => void;
}): ComboboxHandle<any> {
    const wrapper = document.createElement('div');
    wrapper.className = 'ns-combobox';

    let selectedValues: string[] = isMulti
        ? (Array.isArray(value) ? [...value] : (value ? [value] : []))
        : [];
    let selectedValue: string = isMulti
        ? ''
        : (typeof value === 'string' ? value : (Array.isArray(value) && value.length > 0 ? value[0] : ''));

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'ns-combobox-tags';
    if (!isMulti) tagsContainer.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'form-control form-control-sm';
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    if (placeholder) input.placeholder = placeholder;

    const panel = document.createElement('div');
    panel.className = 'ns-combobox-panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;

    wrapper.append(tagsContainer, input, panel);

    let visible: ComboboxOption[] = [];
    let highlighted = -1;

    const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

    function renderTags() {
        if (!isMulti) return;
        tagsContainer.innerHTML = '';
        for (const val of selectedValues) {
            const tag = document.createElement('span');
            tag.className = 'ns-combobox-tag';
            tag.innerHTML = `<span>${escapeHtml(labelFor(val))}</span><i class="bx bx-x ns-remove-tag" data-val="${escapeHtml(val)}"></i>`;
            tag.querySelector('.ns-remove-tag')?.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeValue(val);
            });
            tagsContainer.appendChild(tag);
        }
    }

    function removeValue(val: string) {
        selectedValues = selectedValues.filter((v) => v !== val);
        renderTags();
        onChange?.([...selectedValues]);
    }

    function highlight(index: number) {
        highlighted = index;
        Array.from(panel.children).forEach((el, i) => el.classList.toggle('active', i === index));
    }

    function closePanel() {
        panel.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        highlighted = -1;
    }

    function selectOption(option: ComboboxOption) {
        if (isMulti) {
            if (!selectedValues.includes(option.value)) {
                selectedValues.push(option.value);
                renderTags();
                onChange?.([...selectedValues]);
            }
            input.value = '';
            closePanel();
        } else {
            selectedValue = option.value;
            input.value = option.label;
            closePanel();
            onChange?.(option.value);
        }
    }

    function renderPanel(query: string) {
        visible = options
            .map((o) => ({ o, score: fuzzyScore(query, o.label) }))
            .filter((x): x is { o: ComboboxOption; score: number } => x.score !== null)
            .sort((a, b) => a.score - b.score)
            .map((x) => x.o);

        panel.innerHTML = '';

        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'ns-combobox-empty';
            empty.textContent = 'No matches.';
            panel.appendChild(empty);
        } else {
            for (const option of visible) {
                const item = document.createElement('div');
                const isSelected = isMulti ? selectedValues.includes(option.value) : selectedValue === option.value;
                item.className = `ns-combobox-option${isSelected ? ' is-selected' : ''}`;
                item.setAttribute('role', 'option');
                const iconHtml = option.icon ? `<i class="bx ${escapeHtml(option.icon)} text-primary me-1"></i>` : '';
                item.innerHTML = `<span>${iconHtml}${escapeHtml(option.label)}${isSelected ? ' <i class="bx bx-check text-success ms-1"></i>' : ''}</span>${option.description ? `<span class="ns-meta">${escapeHtml(option.description)}</span>` : ''}`;
                // mousedown fires before the input's blur handler, so the click
                // registers before closePanel() would otherwise swallow it.
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectOption(option);
                });
                panel.appendChild(item);
            }
        }

        panel.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        highlighted = -1;
    }

    input.addEventListener('focus', () => {
        input.select();
        renderPanel('');
    });

    input.addEventListener('input', () => renderPanel(input.value));

    input.addEventListener('blur', () => {
        if (isMulti) {
            input.value = '';
        } else {
            input.value = labelFor(selectedValue);
        }
        closePanel();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isMulti) {
                input.value = '';
            } else {
                input.value = labelFor(selectedValue);
            }
            closePanel();
            input.blur();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (panel.hidden) { renderPanel(input.value); return; }
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            highlight(Math.max(0, Math.min(visible.length - 1, highlighted + delta)));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const option = highlighted >= 0 ? visible[highlighted] : visible[0];
            if (option) selectOption(option);
        }
    });

    if (isMulti) {
        renderTags();
        input.value = '';
    } else {
        input.value = labelFor(selectedValue);
    }

    return {
        el: wrapper,
        getValue: () => (isMulti ? [...selectedValues] : selectedValue),
        setValue: (v: string | string[]) => {
            if (isMulti) {
                selectedValues = Array.isArray(v) ? [...v] : (v ? [v] : []);
                renderTags();
                input.value = '';
            } else {
                selectedValue = typeof v === 'string' ? v : (v[0] ?? '');
                input.value = labelFor(selectedValue);
            }
        },
        setOptions: (newOptions: ComboboxOption[]) => {
            options = [...newOptions];
            if (!isMulti) input.value = labelFor(selectedValue);
        },
    };
}

export interface ToastOptions {
    message: string;
    type?: 'success' | 'info' | 'warning' | 'danger';
    durationMs?: number;
    undoAction?: () => void;
}

export function showToast(opts: ToastOptions | string, typeArg?: 'success' | 'info' | 'warning' | 'danger', durationArg?: number): void {
    if (typeof document === 'undefined') return;
    const message = typeof opts === 'string' ? opts : opts.message;
    const type = typeof opts === 'string' ? (typeArg || 'success') : (opts.type || 'success');
    const durationMs = typeof opts === 'string' ? (durationArg ?? 3500) : (opts.durationMs ?? 3500);
    const undoAction = typeof opts === 'string' ? undefined : opts.undoAction;

    let container = document.querySelector('.ns-toast-container') as HTMLElement;
    if (!container) {
        container = document.createElement('div');
        container.className = 'ns-toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1060; display: flex; flex-direction: column; gap: 8px; max-width: 360px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-success' : type === 'warning' ? 'bg-warning text-dark' : type === 'danger' ? 'bg-danger' : 'bg-primary';
    const icon = type === 'success' ? 'bx-check-circle' : type === 'warning' ? 'bx-error' : type === 'danger' ? 'bx-x-circle' : 'bx-info-circle';

    toast.className = `toast show align-items-center text-white ${bgClass} border-0 shadow-lg`;
    toast.style.cssText = 'pointer-events: auto; transition: all 0.3s ease; opacity: 1; transform: translateY(0);';
    toast.innerHTML = `
        <div class="d-flex p-2.5">
            <div class="toast-body d-flex align-items-center gap-2 small">
                <i class="bx ${icon} fs-6"></i>
                <span>${escapeHtml(message)}</span>
                ${undoAction ? `<button type="button" class="btn btn-micro btn-light text-dark ms-2 undo-btn">Undo</button>` : ''}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto close-toast-btn" aria-label="Close"></button>
        </div>
    `;

    if (undoAction) {
        toast.querySelector('.undo-btn')?.addEventListener('click', () => {
            undoAction();
            removeToast();
        });
    }

    const removeToast = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.close-toast-btn')?.addEventListener('click', removeToast);
    container.appendChild(toast);

    if (durationMs > 0) {
        setTimeout(removeToast, durationMs);
    }
}

if (typeof window !== 'undefined') {
    (window as any).__ikmalToast = showToast;
}
