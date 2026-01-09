import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { InstalledSkill } from '../types';
import { extractYamlField } from './yaml';

/**
 * Represents a skill directory with metadata
 */
export interface SkillDirectory {
    path: string;
    displayName: string;
    isProject: boolean;
    icon: string;
}

/**
 * Get all skill directories with metadata
 */
export function getSkillDirectories(workspaceRoot: string): SkillDirectory[] {
    return [
        // Project-level directories
        {
            path: path.join(workspaceRoot, '.agent', 'skills'),
            displayName: '.agent/skills',
            isProject: true,
            icon: 'folder'
        },
        {
            path: path.join(workspaceRoot, '.cursor', 'skills'),
            displayName: '.cursor/skills',
            isProject: true,
            icon: 'folder'
        },
        {
            path: path.join(workspaceRoot, '.trae', 'skills'),
            displayName: '.trae/skills',
            isProject: true,
            icon: 'folder'
        },
        {
            path: path.join(workspaceRoot, '.windsurf', 'skills'),
            displayName: '.windsurf/skills',
            isProject: true,
            icon: 'folder'
        },
        // Global directories
        {
            path: path.join(os.homedir(), '.agent', 'skills'),
            displayName: '~/.agent/skills',
            isProject: false,
            icon: 'home'
        },
        {
            path: path.join(os.homedir(), '.codex', 'skills'),
            displayName: '~/.codex/skills',
            isProject: false,
            icon: 'home'
        },
        {
            path: path.join(os.homedir(), '.claude', 'skills'),
            displayName: '~/.claude/skills',
            isProject: false,
            icon: 'home'
        },
    ];
}

/**
 * Get all searchable skill directories in priority order
 * Priority: project .agent > global .agent > project .claude > global .claude
 */
export function getSearchDirs(workspaceRoot: string): string[] {
    return getSkillDirectories(workspaceRoot).map(d => d.path);
}

/**
 * Check if a directory entry is a directory or a symlink pointing to a directory
 */
function isDirectoryOrSymlinkToDirectory(entry: fs.Dirent, parentDir: string): boolean {
    if (entry.isDirectory()) {
        return true;
    }
    if (entry.isSymbolicLink()) {
        try {
            const fullPath = path.join(parentDir, entry.name);
            const stats = fs.statSync(fullPath); // statSync follows symlinks
            return stats.isDirectory();
        } catch {
            // Broken symlink or permission error
            return false;
        }
    }
    return false;
}

/**
 * Find all installed skills across directories
 */
export function findAllInstalledSkills(workspaceRoot: string): InstalledSkill[] {
    const skills: InstalledSkill[] = [];
    const seen = new Set<string>();
    const dirs = getSearchDirs(workspaceRoot);

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (isDirectoryOrSymlinkToDirectory(entry, dir)) {
                    // Deduplicate: only add if we haven't seen this skill name yet
                    if (seen.has(entry.name)) continue;

                    const skillPath = path.join(dir, entry.name, 'SKILL.md');
                    if (fs.existsSync(skillPath)) {
                        const content = fs.readFileSync(skillPath, 'utf-8');
                        const isProjectLocal = dir.startsWith(workspaceRoot);

                        skills.push({
                            name: entry.name,
                            description: extractYamlField(content, 'description'),
                            location: isProjectLocal ? 'project' : 'global',
                            path: path.join(dir, entry.name),
                            explicitLocation: isProjectLocal
                                ? path.relative(workspaceRoot, skillPath).replace(/\\/g, '/')
                                : undefined
                        });

                        seen.add(entry.name);
                    }
                }
            }
        } catch (e) {
            console.error(`Error scanning dir ${dir}:`, e);
        }
    }

    return skills;
}
