import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './configManager';
import { GitService } from './services/git';
import { Skill, SkillRepo, SkillMatchStatus, LocalSkillsGroup, LocalSkill } from './types';
import { getProjectSkillsDir } from './utils/ide';
import { getCachedSkillHash, clearHashCache } from './utils/skillCompare';
import { getSkillDirectories } from './utils/skills';
import { extractYamlField } from './utils/yaml';

// Union type for all tree node types
type TreeNode = SkillRepo | Skill | LocalSkillsGroup | LocalSkill;

// Type guards
function isSkillRepo(node: TreeNode): node is SkillRepo {
    return 'url' in node && !('type' in node);
}

function isSkill(node: TreeNode): node is Skill {
    return 'repoUrl' in node && !('type' in node);
}

function isLocalSkillsGroup(node: TreeNode): node is LocalSkillsGroup {
    return 'type' in node && node.type === 'local-group';
}

function isLocalSkill(node: TreeNode): node is LocalSkill {
    return 'type' in node && node.type === 'local-skill';
}

export class SkillsProvider implements vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

    private checkedSkills: Set<string> = new Set();
    private skillCache: Map<string, Skill> = new Map();
    private installedSkillHashes: Map<string, string> = new Map(); // skillName -> hash

    refresh(): void {
        clearHashCache();
        this.updateInstalledSkillHashes();
        this._onDidChangeTreeData.fire();
    }

    setChecked(skill: Skill, checked: boolean): void {
        const key = this.getSkillKey(skill);
        if (checked) {
            this.checkedSkills.add(key);
            this.skillCache.set(key, skill);
        } else {
            this.checkedSkills.delete(key);
        }
    }

    getCheckedSkills(): Skill[] {
        const result: Skill[] = [];
        for (const key of this.checkedSkills) {
            const skill = this.skillCache.get(key);
            if (skill) {
                result.push(skill);
            }
        }
        return result;
    }

    clearSelection(): void {
        this.checkedSkills.clear();
        this.refresh();
    }

    private getSkillKey(skill: Skill): string {
        return `${skill.repoUrl}::${skill.name}`;
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private getInstalledSkillsDir(): string | undefined {
        const root = this.getWorkspaceRoot();
        return root ? getProjectSkillsDir(root, vscode.env.appName) : undefined;
    }

    private isSkillInstalled(skillName: string): boolean {
        const dir = this.getInstalledSkillsDir();
        return dir ? fs.existsSync(path.join(dir, skillName, 'SKILL.md')) : false;
    }

    private updateInstalledSkillHashes(): void {
        this.installedSkillHashes.clear();
        const dir = this.getInstalledSkillsDir();
        if (!dir || !fs.existsSync(dir)) return;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    const skillDir = path.join(dir, entry.name);
                    if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
                        const hash = getCachedSkillHash(skillDir);
                        this.installedSkillHashes.set(entry.name, hash);
                    }
                }
            }
        } catch (e) {
            console.error('Error updating installed skill hashes:', e);
        }
    }

    private getSkillMatchStatus(skill: Skill): SkillMatchStatus {
        const installedHash = this.installedSkillHashes.get(skill.name);
        if (!installedHash) {
            return SkillMatchStatus.NotInstalled;
        }

        // Compare with repo skill hash
        if (skill.localPath && fs.existsSync(skill.localPath)) {
            const repoHash = getCachedSkillHash(skill.localPath);
            return installedHash === repoHash ? SkillMatchStatus.Matched : SkillMatchStatus.Conflict;
        }

        return SkillMatchStatus.NotInstalled;
    }

    private getLocalSkillsGroups(): LocalSkillsGroup[] {
        const root = this.getWorkspaceRoot();
        if (!root) return [];

        const activeProjectSkillsPath = getProjectSkillsDir(root, vscode.env.appName);

        return getSkillDirectories(root)
            .map(dir => {
                return {
                    type: 'local-group' as const,
                    name: dir.displayName,
                    path: dir.path,
                    icon: dir.icon,
                    exists: fs.existsSync(dir.path),
                    isActive: dir.path === activeProjectSkillsPath
                };
            })
            .filter(group => {
                if (group.isActive) return true;
                if (!group.exists) return false;
                try {
                    const entries = fs.readdirSync(group.path, { withFileTypes: true });
                    return entries.some(entry =>
                        entry.isDirectory() &&
                        !entry.name.startsWith('.') &&
                        fs.existsSync(path.join(group.path, entry.name, 'SKILL.md'))
                    );
                } catch {
                    return false;
                }
            });
    }

    private getLocalSkillsFromGroup(group: LocalSkillsGroup): LocalSkill[] {
        if (!fs.existsSync(group.path)) return [];

        const skills: LocalSkill[] = [];
        try {
            const entries = fs.readdirSync(group.path, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    const skillPath = path.join(group.path, entry.name);
                    const skillMdPath = path.join(skillPath, 'SKILL.md');
                    if (fs.existsSync(skillMdPath)) {
                        const content = fs.readFileSync(skillMdPath, 'utf-8');
                        skills.push({
                            type: 'local-skill',
                            name: entry.name,
                            description: extractYamlField(content, 'description') || '',
                            path: skillPath,
                            groupPath: group.path,
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Error scanning local skills in ${group.path}:`, e);
        }
        return skills;
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        // Local skills group
        if (isLocalSkillsGroup(element)) {
            const item = new vscode.TreeItem(
                element.name,
                vscode.TreeItemCollapsibleState.Collapsed
            );

            item.contextValue = 'localSkillsGroup';
            item.iconPath = element.isActive
                ? new vscode.ThemeIcon('layers-active')
                : new vscode.ThemeIcon(element.icon);
            if (element.isActive) {
                item.description = '[Active]';
            }

            item.tooltip = element.path;
            return item;
        }

        // Local skill
        if (isLocalSkill(element)) {
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);

            // Check if this is a project skill or personal directory skill
            const root = this.getWorkspaceRoot();
            const isProjectSkill = root && element.groupPath.startsWith(root);

            if (isProjectSkill) {
                // Project skills: have delete and open buttons
                item.contextValue = 'localSkill';
                item.description = element.description;
                item.iconPath = new vscode.ThemeIcon('tools');
            } else {
                // Personal directory skills: have install button only (like git skills)
                item.contextValue = 'personalSkill';

                // Check if already installed in project
                const installed = this.isSkillInstalled(element.name);
                const status: string[] = [];
                if (installed) status.push('Installed');

                const truncatedDesc = element.description.length > 10
                    ? element.description.substring(0, 10) + '...'
                    : element.description;
                item.description = status.length > 0 ? `[${status.join(', ')}]` : truncatedDesc;

                if (installed) {
                    item.contextValue = 'personalSkillInstalled';
                    item.iconPath = new vscode.ThemeIcon('check');
                } else {
                    item.iconPath = new vscode.ThemeIcon('tools');
                }
            }

            item.tooltip = new vscode.MarkdownString(
                `**${element.name}**\n\n` +
                `${element.description}\n\n` +
                `---\n\n` +
                `📁 ${element.path}`
            );

            return item;
        }

        // Skill repo
        if (isSkillRepo(element)) {
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'skillRepo';
            item.description = element.branch ? `[${element.branch}]` : '';
            item.tooltip = element.url;
            item.iconPath = new vscode.ThemeIcon('github');
            return item;
        }

        // Repo skill
        if (isSkill(element)) {
            const matchStatus = element.matchStatus ?? this.getSkillMatchStatus(element);
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
            const key = this.getSkillKey(element);

            // Handle conflict state - skill installed from different repo
            if (matchStatus === SkillMatchStatus.Conflict) {
                item.contextValue = 'skillConflict';
                item.description = '[Conflict]';
                item.tooltip = new vscode.MarkdownString(
                    `**${element.name}**\n\n` +
                    `${element.description}\n\n` +
                    `---\n\n` +
                    `⚠️ **冲突**: 此skill已从其他仓库安装，版本与当前仓库不一致。\n\n` +
                    `如需安装此版本，请先删除已安装的版本。`
                );
                item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('disabledForeground'));
                // No checkbox for conflicting skills
                return item;
            }

            // Normal installed or not installed state
            const installed = matchStatus === SkillMatchStatus.Matched;
            const status: string[] = [];
            if (installed) status.push('Installed');

            item.contextValue = installed ? 'skillInstalled' : 'skill';
            const truncatedDesc = element.description.length > 10
                ? element.description.substring(0, 10) + '...'
                : element.description;
            item.description = status.length > 0 ? `[${status.join(', ')}]` : truncatedDesc;
            item.tooltip = `${element.name}\n${element.description}\n${element.path}`;

            let iconName = 'tools';
            if (installed) {
                iconName = 'check';
            }
            item.iconPath = new vscode.ThemeIcon(iconName);

            item.checkboxState = this.checkedSkills.has(key)
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked;

            return item;
        }

        // Fallback
        return new vscode.TreeItem('Unknown');
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!element) {
            // Root level: local skill groups + repos
            const localGroups = this.getLocalSkillsGroups();
            const repos = ConfigManager.getRepos();
            return [...localGroups, ...repos];
        }

        // Local skills group children
        if (isLocalSkillsGroup(element)) {
            return this.getLocalSkillsFromGroup(element);
        }

        // Skill repo children
        if (isSkillRepo(element)) {
            try {
                // Ensure hashes are up to date
                if (this.installedSkillHashes.size === 0) {
                    this.updateInstalledSkillHashes();
                }

                const skills = await GitService.getSkillsFromRepo(element.url, element.branch);
                skills.forEach(s => {
                    s.matchStatus = this.getSkillMatchStatus(s);
                    s.installed = s.matchStatus === SkillMatchStatus.Matched;
                    this.skillCache.set(this.getSkillKey(s), s);
                });
                return skills;
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to load skills from ${element.name}: ${e}`);
                return [];
            }
        }

        return [];
    }
}
