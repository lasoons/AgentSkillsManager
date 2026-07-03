import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { IDE_CONFIGS, IdeType, getGlobalSkillsDir } from './ide';

/**
 * Represents a skill directory with metadata
 */
export interface SkillDirectory {
    path: string;
    displayName: string;
    isProject: boolean;
    icon: string;
}

function toDisplayPath(relPath: string): string {
    return relPath.replace(/\\/g, '/');
}

/**
 * Get all skill directories with metadata
 */
export function getSkillDirectories(workspaceRoot: string): SkillDirectory[] {
    const uniqueProjectSkillDirs = Array.from(
        new Set(Object.values(IDE_CONFIGS).map(c => c.skillsDir))
    );

    const projectDirs: SkillDirectory[] = uniqueProjectSkillDirs.map((relDir) => {
        const displayName = toDisplayPath(relDir);
        const icon = displayName.startsWith('.claude/') ? 'folder' : 'folder-library';
        return {
            path: path.join(workspaceRoot, relDir),
            displayName,
            isProject: true,
            icon,
        };
    });

    const globalDirs: SkillDirectory[] = Object.values(IdeType).map((ide) => {
        const globalPath = getGlobalSkillsDir(ide);
        let displayName = '';
        if (ide === IdeType.ANTIGRAVITY) {
            displayName = '~/.gemini/config/skills';
        } else if (ide === IdeType.VSCODE) {
            displayName = '~/.claude/skills';
        } else {
            displayName = `~/.${ide}/skills`;
        }
        return {
            path: globalPath,
            displayName,
            isProject: false,
            icon: 'home',
        };
    });

    const codexPath = path.join(os.homedir(), '.codex', 'skills');
    if (!globalDirs.some(d => d.path === codexPath)) {
        globalDirs.push({
            path: codexPath,
            displayName: '~/.codex/skills',
            isProject: false,
            icon: 'home',
        });
    }

    try {
        const config = vscode.workspace.getConfiguration('agentskills');
        const extraDirs = config.get<string[]>('extraGlobalSkillsDirectories') || [];
        for (const dir of extraDirs) {
            if (dir) {
                let resolvedPath = dir;
                if (dir.startsWith('~')) {
                    resolvedPath = path.join(os.homedir(), dir.slice(1));
                }
                if (!globalDirs.some(d => d.path === resolvedPath)) {
                    globalDirs.push({
                        path: resolvedPath,
                        displayName: dir,
                        isProject: false,
                        icon: 'home',
                    });
                }
            }
        }
    } catch (e) {
        // Fallback
    }

    return [...projectDirs, ...globalDirs];
}

