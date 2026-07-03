import { join } from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export enum IdeType {
    VSCODE = 'vscode',
    CURSOR = 'cursor',
    TRAE = 'trae',
    ANTIGRAVITY = 'antigravity',
    QODER = 'qoder',
    WINDSURF = 'windsurf',
    CODEBUDDY = 'codebuddy',
}

export interface IdeConfig {
    type: IdeType;
    skillsDir: string;
}

export const IDE_CONFIGS: Record<IdeType, IdeConfig> = {
    [IdeType.ANTIGRAVITY]: {
        type: IdeType.ANTIGRAVITY,
        skillsDir: join('.agent', 'skills'),
    },
    [IdeType.CODEBUDDY]: {
        type: IdeType.CODEBUDDY,
        skillsDir: join('.codebuddy', 'skills'),
    },
    [IdeType.CURSOR]: {
        type: IdeType.CURSOR,
        skillsDir: join('.cursor', 'skills'),
    },
    [IdeType.QODER]: {
        type: IdeType.QODER,
        skillsDir: join('.qoder', 'skills'),
    },
    [IdeType.TRAE]: {
        type: IdeType.TRAE,
        skillsDir: join('.trae', 'skills'),
    },
    [IdeType.VSCODE]: {
        type: IdeType.VSCODE,
        skillsDir: join('.github', 'skills'),
    },
    [IdeType.WINDSURF]: {
        type: IdeType.WINDSURF,
        skillsDir: join('.windsurf', 'skills'),
    },
};

export function resolveIdeType(appName: string): IdeType {
    const lowerAppName = appName.toLowerCase();

    if (lowerAppName.includes('codebuddy')) return IdeType.CODEBUDDY;
    if (lowerAppName.includes('cursor')) return IdeType.CURSOR;
    if (lowerAppName.includes('qoder')) return IdeType.QODER;
    if (lowerAppName.includes('trae')) return IdeType.TRAE;
    if (lowerAppName.includes('antigravity')) return IdeType.ANTIGRAVITY;
    if (lowerAppName.includes('windsurf')) return IdeType.WINDSURF;

    return IdeType.VSCODE;
}

/**
 * Detect the current IDE based on environment variables.
 */
export function detectIde(env: NodeJS.ProcessEnv = process.env, appNameHint?: string): IdeType {
    // Check explicit override first
    if (env.AGENTSKILLS_IDE) {
        const override = env.AGENTSKILLS_IDE.toLowerCase();
        if (Object.values(IdeType).includes(override as IdeType)) {
            return override as IdeType;
        }
    }

    const brand = env.VSCODE_BRAND || '';
    if (brand) return resolveIdeType(brand);

    const appName = env.VSCODE_ENV_APPNAME || env.PROG_IDE_NAME || '';
    if (appName) return resolveIdeType(appName);

    if (appNameHint) return resolveIdeType(appNameHint);

    return IdeType.VSCODE;
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

export function getProjectSkillsDir(workspaceRoot: string, ide: IdeType | string): string {
    const config = getIdeConfig(ide);
    return join(workspaceRoot, config.skillsDir);
}

export function resolvePath(p: string): string {
    if (!p) return p;

    // Resolve home directory shortcut ~
    if (p.startsWith('~')) {
        p = join(os.homedir(), p.slice(1));
    }

    // Resolve environmental variables (e.g. %USERPROFILE% on Windows or $HOME on Unix)
    p = p.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
    p = p.replace(/\$([A-Za-z0-9_]+)/g, (_, name) => process.env[name] || '');

    return p;
}

export function getGlobalSkillsDir(ide: IdeType | string): string {
    const ideType = Object.values(IdeType).includes(ide as IdeType)
        ? ide as IdeType
        : resolveIdeType(ide);

    try {
        const config = vscode.workspace.getConfiguration('agentskills');
        const customDir = config.get<string>(`${ideType}.globalSkillsDirectory`);
        if (customDir) {
            return resolvePath(customDir);
        }
    } catch (e) {
        // Fallback
    }

    const homedir = os.homedir();
    switch (ideType) {
        case IdeType.ANTIGRAVITY:
            return join(homedir, '.gemini', 'config', 'skills');
        case IdeType.CURSOR:
            return join(homedir, '.cursor', 'skills');
        case IdeType.TRAE:
            return join(homedir, '.trae', 'skills');
        case IdeType.WINDSURF:
            return join(homedir, '.windsurf', 'skills');
        case IdeType.QODER:
            return join(homedir, '.qoder', 'skills');
        case IdeType.CODEBUDDY:
            return join(homedir, '.codebuddy', 'skills');
        case IdeType.VSCODE:
        default:
            return join(homedir, '.claude', 'skills');
    }
}

