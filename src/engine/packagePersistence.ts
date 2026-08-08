/**
 * Reads and writes this package's Automation settings as `packageSetting:<key>`
 * labels on its own manifest note — the same label name and note (found via
 * `#packageOwner`/`#packageArtifact=manifest`) that Trilium's Community
 * Packages manager uses for "Configure" on any installed package, and that this repo's own
 * `tools/deploy_plugin_to_instance.py` tags every deployed note with. Settings
 * saved from inside this dashboard and from that external manager's Configure
 * screen land on the same labels, so neither overwrites the other.
 *
 * Falls back to an in-memory store when there is no Trilium `api` (tests, the
 * static preview harness), so callers never need to branch on environment.
 */

import { AutomationSettings, DEFAULT_AUTOMATION_SETTINGS } from './settingsEngine.js';

const PACKAGE_ID = 'iansherr/ikmal_tools_trilium';

function settingLabelName(key: string): string {
    return `packageSetting:${key}`;
}

interface TriliumFNote {
    noteId: string;
    getOwnedLabelValue(name: string): string | null;
}

interface TriliumFrontendApi {
    searchForNotes(searchString: string): Promise<TriliumFNote[]>;
}

function triliumApi(): TriliumFrontendApi | null {
    const a = (globalThis as any).api;
    return a && typeof a.searchForNotes === 'function' ? a : null;
}

async function findManifestNote(): Promise<TriliumFNote | null> {
    const api = triliumApi();
    if (!api) return null;
    const notes = await api.searchForNotes(`#packageOwner="${PACKAGE_ID}" #packageArtifact="manifest"`);
    return notes[0] ?? null;
}

import { TriliumApiBridge } from './triliumApiBridge.js';

async function writeLabel(note: TriliumFNote, name: string, value: string): Promise<void> {
    return TriliumApiBridge.setNoteAttribute(note.noteId, 'label', name, value);
}

function parseStoredBoolean(raw: string, fallback: boolean): boolean {
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'boolean' ? parsed : fallback;
    } catch {
        // Settings written before this used bare "true"/"false" rather than JSON.
        return raw === 'true';
    }
}

/** Used only when there is no manifest note to read from or write to. */
const memoryStore = new Map<string, string>();

/**
 * The full YAML specification (Today layout, templates, categories, if/then
 * rules) lives on the same manifest note as the boolean settings, under its
 * own label rather than a `packageSetting:<key>` one, since it isn't part of
 * the fixed schema `trilium-package.json` declares and validates against.
 * JSON-encoded like the booleans so embedded newlines and quotes round-trip
 * through the attribute value untouched.
 */
const YAML_SPEC_LABEL = 'packageData:yamlSpecification';

export async function loadYamlSpecification(): Promise<string | null> {
    const note = await findManifestNote();
    const raw = note ? note.getOwnedLabelValue(YAML_SPEC_LABEL) : memoryStore.get(YAML_SPEC_LABEL) ?? null;
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'string' ? parsed : null;
    } catch {
        return null;
    }
}

export async function saveYamlSpecification(yamlSpec: string): Promise<void> {
    const serialized = JSON.stringify(yamlSpec);
    const note = await findManifestNote();
    if (note) {
        await writeLabel(note, YAML_SPEC_LABEL, serialized);
    } else {
        memoryStore.set(YAML_SPEC_LABEL, serialized);
    }
}

export async function loadAutomationSettings(): Promise<AutomationSettings> {
    const note = await findManifestNote();
    const result: AutomationSettings = { ...DEFAULT_AUTOMATION_SETTINGS };

    for (const key of Object.keys(DEFAULT_AUTOMATION_SETTINGS) as (keyof AutomationSettings)[]) {
        const raw = note ? note.getOwnedLabelValue(settingLabelName(key)) : memoryStore.get(key) ?? null;
        if (raw !== null) {
            const def = DEFAULT_AUTOMATION_SETTINGS[key];
            if (typeof def === 'boolean') {
                (result[key] as boolean) = parseStoredBoolean(raw, def);
            } else if (typeof def === 'number') {
                const num = Number(raw);
                (result[key] as number) = isNaN(num) ? def : num;
            } else {
                (result[key] as string) = String(raw);
            }
        }
    }

    return result;
}

export async function saveAutomationSetting<K extends keyof AutomationSettings>(
    key: K,
    value: AutomationSettings[K]
): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const note = await findManifestNote();

    if (note) {
        await writeLabel(note, settingLabelName(key), serialized);
    } else {
        memoryStore.set(key, serialized);
    }
}
