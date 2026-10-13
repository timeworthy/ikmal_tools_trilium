/**
 * The example macro library shipped with Ikmal Tools. Every entry becomes an inert library note
 * (`#ikmalMacroLibrary`) the first time the runtime starts with backend scripting; the user switches
 * the ones they want on from the Macro library screen. See macroRuntime.ts (`seedMacroLibrary`).
 *
 * Rules the tests enforce: unique ids, no shared hotkey or abbreviation anywhere in the library (so
 * any combination can be switched on together), no hotkey the launcher reserves, one caret at most.
 */

import { LIBRARY_LABEL } from './macroEngine.js';

export interface LibraryEntryData {
    /** Stable across versions: it is how the seeder knows an entry was already created. */
    id: string;
    title: string;
    group: 'Dates' | 'Editor' | 'Project' | 'Writing';
    summary: string;
    body: string;
    mode?: 'html' | 'text';
    hotkey?: string;
    abbrev?: string;
    button?: string;
    commands?: string[];
    /** `#macroScope` entries; leave out to act everywhere. */
    scope?: string[];
    /** Expand as typed; the abbreviation must start with a symbol. */
    autoExpand?: boolean;
}

export const MACRO_LIBRARY: LibraryEntryData[] = [
    // ---- Writing ----
    { id: 'signature', title: 'Signature', group: 'Writing', abbrev: 'sig',
      summary: 'Sign-off with the caret after your name. Edit the name in the note.',
      body: '<p>Thanks,<br>Your Name{{cursor}}</p>' },
    { id: 'greeting', title: 'Greeting', group: 'Writing', abbrev: 'hey',
      summary: 'Asks who you are writing to, then opens "Hi <name>,".',
      body: '<p>Hi {{prompt:Name}},</p><p>{{cursor}}</p>' },
    { id: 'literal-snippet', title: 'Literal snippet', group: 'Writing', abbrev: 'snip', mode: 'text',
      summary: 'Text mode: angle brackets and ampersands are inserted exactly as written.',
      body: 'Use <b> and & as typed.\nSecond line{{cursor}}' },
    { id: 'link-from-clipboard', title: 'Link from clipboard', group: 'Writing', abbrev: 'lnk',
      summary: 'Turns the copied address into a link; asks for the link text. Only web, mail and phone addresses are accepted.',
      // The non-breaking space keeps what you type next out of the link; the editor extends a link over text typed straight after it.
      body: '<a href="{{clipboard:url}}">{{prompt:Link text|link}}</a>&nbsp;{{cursor}}' },

    // ---- Dates ----
    { id: 'long-date', title: 'Long date', group: 'Dates', abbrev: 'ddate',
      summary: 'Monday, October 12, 2026',
      body: '{{date:dddd, MMMM D, YYYY}}' },
    { id: 'timestamp', title: 'Timestamp', group: 'Dates', abbrev: 'ts',
      summary: 'Date and time, e.g. 2026-10-12 14:05.',
      body: '{{datetime}}' },
    { id: 'dated-heading', title: 'Dated heading', group: 'Dates', abbrev: 'today',
      summary: 'A heading with today\'s date and the caret below it.',
      body: '<h2>{{date:YYYY-MM-DD}} {{date:dddd}}</h2><p>{{cursor}}</p>' },

    // ---- Project ----
    { id: 'meeting-notes', title: 'Meeting notes', group: 'Project', abbrev: 'mtg', hotkey: 'alt+shift+m',
      summary: 'Asks for the meeting name, then lays out attendees, decisions and actions.',
      body: '<h3>{{prompt:Meeting|Meeting}} - {{date}}</h3><p><strong>Attendees:</strong> {{cursor}}</p><p><strong>Decisions</strong></p><ul><li></li></ul><p><strong>Actions</strong></p><ul><li></li></ul>' },
    { id: 'decision-record', title: 'Decision record', group: 'Project', abbrev: 'adr',
      summary: 'Context, decision and consequences, titled and dated.',
      body: '<h3>{{prompt:Decision}} ({{date}})</h3><p><strong>Context</strong></p><p>{{cursor}}</p><p><strong>Decision</strong></p><p></p><p><strong>Consequences</strong></p><ul><li></li></ul>' },
    { id: 'status-update', title: 'Status update', group: 'Project', abbrev: 'status',
      summary: 'Done, next and blocked for the week.',
      body: '<h3>Status - {{date}}</h3><p><strong>Done</strong></p><ul><li>{{cursor}}</li></ul><p><strong>Next</strong></p><ul><li></li></ul><p><strong>Blocked</strong></p><ul><li></li></ul>' },
    { id: 'standup', title: 'Standup', group: 'Project', abbrev: 'standup',
      summary: 'Yesterday, today and blockers.',
      body: '<h3>Standup - {{date:ddd D MMM}}</h3><p><strong>Yesterday</strong></p><ul><li>{{cursor}}</li></ul><p><strong>Today</strong></p><ul><li></li></ul><p><strong>Blockers</strong></p><ul><li></li></ul>' },
    { id: 'retro', title: 'Retrospective', group: 'Project', abbrev: 'retro',
      summary: 'What went well, what did not, and actions.',
      body: '<h3>Retro - {{date}}</h3><p><strong>Went well</strong></p><ul><li>{{cursor}}</li></ul><p><strong>Did not go well</strong></p><ul><li></li></ul><p><strong>Actions</strong></p><ul><li></li></ul>' },
    { id: 'bug-report', title: 'Bug report', group: 'Project', abbrev: 'bug',
      summary: 'Asks for a title, then steps, expected and actual.',
      body: '<h3>Bug: {{prompt:Title}}</h3><p><strong>Steps</strong></p><ol><li>{{cursor}}</li></ol><p><strong>Expected</strong></p><p></p><p><strong>Actual</strong></p><p></p>' },

    // ---- Editor ----
    { id: 'changelog-entry', title: 'Changelog entry', group: 'Editor', hotkey: 'alt+shift+c', button: 'list-check',
      summary: 'A collapsible block with the caret in its title. Also gets a launch bar button once enabled.',
      body: '<details><summary>{{cursor}}</summary><p>What changed</p></details>' },
    { id: 'checklist-item', title: 'Checklist item', group: 'Editor', hotkey: 'alt+shift+l',
      summary: 'Turns the current line into a to-do item.',
      body: '<p>{{cursor}}</p>', commands: ['todoList'] },
    { id: 'collapsible', title: 'Collapsible', group: 'Editor', abbrev: 'coll',
      summary: 'A collapsible section; asks for its title and leaves the caret below it (a closed section has no visible body to type in).',
      body: '<details><summary>{{prompt:Title}}</summary><p>Details</p></details><p>{{cursor}}</p>' },
    { id: 'table-3x3', title: 'Table 3x3', group: 'Editor', abbrev: 'tbl3',
      summary: 'A table with a header row and two rows of three cells.',
      body: '<figure class="table"><table><thead><tr><th>{{cursor}}</th><th></th><th></th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table></figure>' },
    { id: 'quote', title: 'Quote', group: 'Editor', abbrev: 'qq',
      summary: 'A block quote with the caret inside.',
      body: '<blockquote><p>{{cursor}}</p></blockquote>' },
];

/** The label set for an entry's library note, in a stable order. */
export function libraryLabels(entry: LibraryEntryData): Array<[string, string]> {
    const labels: Array<[string, string]> = [
        [LIBRARY_LABEL, ''],
        ['macroLibraryId', entry.id],
        ['macroGroup', entry.group],
        ['macroSummary', entry.summary],
    ];
    if (entry.mode === 'text') labels.push(['macroMode', 'text']);
    if (entry.hotkey) labels.push(['macroHotkey', entry.hotkey]);
    if (entry.abbrev) labels.push(['macroAbbrev', entry.abbrev]);
    if (entry.button) labels.push(['macroButton', entry.button]);
    for (const command of entry.commands ?? []) labels.push(['macroCommand', command]);
    for (const scope of entry.scope ?? []) labels.push(['macroScope', scope]);
    if (entry.autoExpand) labels.push(['macroAutoExpand', '']);
    return labels;
}
