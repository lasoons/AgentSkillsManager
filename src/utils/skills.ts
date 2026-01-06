import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { InstalledSkill } from '../types';
import { extractYamlField } from './yaml';

/**
 * Get all searchable skill directories in priority order
 * Priority: project .agent > global .agent > project .claude > global .claude
 */
export function getSearchDirs(workspaceRoot: string): string[] {
    return [
        path.join(workspaceRoot, '.agent', 'skills'),   // 1. Project universal (.agent)
        path.join(os.homedir(), '.agent', 'skills'),    // 2. Global universal (.agent)
        path.join(workspaceRoot, '.claude', 'skills'),  // 3. Project claude
        path.join(os.homedir(), '.claude', 'skills'),   // 4. Global claude
    ];
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
