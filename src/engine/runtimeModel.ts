import { IfThenRuleEngine } from './ifThenRuleEngine.js';
import { loadAutomationSettings, loadYamlSpecification } from './packagePersistence.js';
import { SettingsEngine } from './settingsEngine.js';
import { TemplateEngine } from './templateEngine.js';
import { TodayEngine } from './todayEngine.js';
import { DEFAULT_STARTER_YAML_SPEC, parseAndApplyYamlSpec } from './yamlSpec.js';

interface RuntimeModelApi {
    searchForNotes(searchString: string): Promise<any[]>;
}

export interface RuntimeModelResult {
    yamlSpec: string;
}

/** Loads the persisted package model into the engines shared by a UI entrypoint. */
export async function loadRuntimeModel(
    templateEngine: TemplateEngine,
    todayEngine: TodayEngine,
    ifThenRuleEngine: IfThenRuleEngine,
    settingsEngine: SettingsEngine,
    api?: RuntimeModelApi | null,
): Promise<RuntimeModelResult> {
    const [savedSpec, loadedSettings] = await Promise.all([
        loadYamlSpecification(api).catch((error) => {
            console.warn(`[Ikmal Tools] Saved YAML could not be loaded; using built-ins: ${error}`);
            return null;
        }),
        loadAutomationSettings(api).catch((error) => {
            console.warn(`[Ikmal Tools] Automation settings could not be loaded; using defaults: ${error}`);
            return { ...settingsEngine.getAll() };
        }),
    ]);

    for (const key of Object.keys(loadedSettings) as Array<keyof typeof loadedSettings>) {
        settingsEngine.set(key, loadedSettings[key]);
    }

    const yamlSpec = savedSpec?.trim() ? savedSpec : DEFAULT_STARTER_YAML_SPEC;
    if (savedSpec?.trim()) {
        try {
            // Validate on throwaway engines first. The YAML applier is
            // intentionally incremental, so applying a malformed document
            // directly to the live engines could leave a half-applied model.
            const validation = parseAndApplyYamlSpec(
                savedSpec,
                new TodayEngine(),
                new TemplateEngine(),
                new IfThenRuleEngine(),
            );
            if (!validation.success) {
                console.warn(`[Ikmal Tools] Saved YAML is invalid; using built-in model: ${validation.message}`);
                return { yamlSpec: DEFAULT_STARTER_YAML_SPEC };
            }
            const applied = parseAndApplyYamlSpec(savedSpec, todayEngine, templateEngine, ifThenRuleEngine);
            if (!applied.success) {
                console.warn(`[Ikmal Tools] Saved YAML could not be applied; using built-in model: ${applied.message}`);
                return { yamlSpec: DEFAULT_STARTER_YAML_SPEC };
            }
        } catch (error) {
            console.warn(`[Ikmal Tools] Saved YAML is invalid; using built-in model: ${error}`);
            return { yamlSpec: DEFAULT_STARTER_YAML_SPEC };
        }
    }

    return { yamlSpec };
}
