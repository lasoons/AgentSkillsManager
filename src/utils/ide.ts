import { join } from 'path';

export enum IdeType {
    VSCODE = 'vscode',
    CURSOR = 'cursor',
    WINDSURF = 'windsurf',
    TRAE = 'trae',
    ANTIGRAVITY = 'antigravity',
}

export interface IdeConfig {
    type: IdeType;
    rulesFile: string;
    initialContent: string;
}

const DEFAULT_AGENTS_MD_CONTENT = '# AGENTS\n\nInsert overview text here. The agent will only see this should they choose to apply the rule.\n\n';

export const IDE_CONFIGS: Record<IdeType, IdeConfig> = {
    [IdeType.ANTIGRAVITY]: {
        type: IdeType.ANTIGRAVITY,
        rulesFile: join('.agent', 'rules', 'openskills.md'),
        initialContent: `---
trigger: always_on
---
Insert overview text here. The agent will only see this should they choose to apply the rule.

`,
    },
    [IdeType.CURSOR]: {
        type: IdeType.CURSOR,
        rulesFile: join('.cursor', 'rules', 'openskills.mdc'),
        initialContent: `---
alwaysApply: true
---
Insert overview text here. The agent will only see this should they choose to apply the rule.

`,
    },
    [IdeType.WINDSURF]: {
        type: IdeType.WINDSURF,
        rulesFile: join('.windsurf', 'rules', 'openskills.md'),
        initialContent: `---
trigger: manual
---
Insert overview text here. The agent will only see this should they choose to apply the rule.

`,
    },
    [IdeType.TRAE]: {
        type: IdeType.TRAE,
        rulesFile: join('.trae', 'rules', 'openskills.md'),
        initialContent: `---
alwaysApply: true
---
Insert overview text here. The agent will only see this should they choose to apply the rule.

`,
    },
    [IdeType.VSCODE]: {
        type: IdeType.VSCODE,
        rulesFile: 'AGENTS.md',
        initialContent: DEFAULT_AGENTS_MD_CONTENT,
    },
};

export function resolveIdeType(appName: string): IdeType {
    const lowerAppName = appName.toLowerCase();

    if (lowerAppName.includes('cursor')) return IdeType.CURSOR;
    if (lowerAppName.includes('windsurf')) return IdeType.WINDSURF;
    if (lowerAppName.includes('trae')) return IdeType.TRAE;
    if (lowerAppName.includes('antigravity')) return IdeType.ANTIGRAVITY;

    return IdeType.VSCODE;
}

/**
 * Detect the current IDE based on environment variables.
 */
export function detectIde(env: NodeJS.ProcessEnv = process.env): IdeType {
    // Check explicit override first
    if (env.OPENSKILLS_IDE) {
        const override = env.OPENSKILLS_IDE.toLowerCase();
        if (Object.values(IdeType).includes(override as IdeType)) {
            return override as IdeType;
        }
    }

    // Check VSCODE_ENV_APPNAME
    const appName = env.VSCODE_ENV_APPNAME || env.PROG_IDE_NAME || '';
    return resolveIdeType(appName);
}

/**
 * Get configuration for a specific IDE or the detected one.
 */
export function getIdeConfig(ide: IdeType | string): IdeConfig {
    const ideType = Object.values(IdeType).includes(ide as IdeType)
        ? ide as IdeType
        : resolveIdeType(ide);
    return IDE_CONFIGS[ideType];
}
