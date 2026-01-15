import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './configManager';
import { GitService } from './services/git';
import { Skill, SkillRepo, SkillMatchStatus, LocalSkillsGroup, LocalSkill } from './types';
import { getIdeConfig, resolveIdeType } from './utils/ide';
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
    private syncedSkillsCache: Map<string, string> = new Map(); // skillName -> location
    private skillCache: Map<string, Skill> = new Map();
    private installedSkillHashes: Map<string, string> = new Map(); // skillName -> hash

    refresh(): void {
        clearHashCache();
        this.updateInstalledSkillHashes();
        this.updateSyncedSkillsCache();
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

    /**
     * Get sync status for startup notification
     */
    getSyncStatus(): { needsSync: boolean; currentIde: string; rulesFile: string } {
        const root = this.getWorkspaceRoot();
        if (!root) return { needsSync: false, currentIde: '', rulesFile: '' };

        const currentIde = resolveIdeType(vscode.env.appName);
        const config = getIdeConfig(currentIde);
        const rulesPath = path.join(root, config.rulesFile);
        const projectSkillsPath = path.join(root, '.claude', 'skills');

        const isSynced = this.checkProjectSkillsSynced(projectSkillsPath, rulesPath);

        return {
            needsSync: !isSynced,
            currentIde: currentIde,
            rulesFile: config.rulesFile
        };
    }

    private getSkillKey(skill: Skill): string {
        return `${skill.repoUrl}::${skill.name}`;
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private getInstalledSkillsDir(): string | undefined {
        const root = this.getWorkspaceRoot();
        return root ? path.join(root, '.claude', 'skills') : undefined;
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

    private updateSyncedSkillsCache(): void {
        this.syncedSkillsCache.clear();
        const root = this.getWorkspaceRoot();
        if (!root) return;

        const config = getIdeConfig(vscode.env.appName);
        const agentsPath = path.join(root, config.rulesFile);
        if (!fs.existsSync(agentsPath)) return;

        const content = fs.readFileSync(agentsPath, 'utf-8');
        // Parse skill entries with both name and location
        const skillRegex = /<skill>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<location>([^<]+)<\/location>[\s\S]*?<\/skill>/g;
        let match;
        while ((match = skillRegex.exec(content)) !== null) {
            this.syncedSkillsCache.set(match[1].trim(), match[2].trim());
        }
    }

    /**
     * Check if a skill is synced based on name and location
     * @param skillName The name of the skill
     * @param isProjectSkill Whether the skill is from project directory (vs personal directory)
     */
    private isSkillSynced(skillName: string, isProjectSkill: boolean): boolean {
        const syncedLocation = this.syncedSkillsCache.get(skillName);
        if (!syncedLocation) return false;

        // 'global' means personal directory skill
        // Otherwise it's a path like '.claude/skills/xxx/SKILL.md' which is project skill
        const syncedIsProject = syncedLocation !== 'global';
        return syncedIsProject === isProjectSkill;
    }

    private getLocalSkillsGroups(): LocalSkillsGroup[] {
        const root = this.getWorkspaceRoot();
        if (!root) return [];

        const currentIde = resolveIdeType(vscode.env.appName);
        const config = getIdeConfig(currentIde);
        const rulesPath = path.join(root, config.rulesFile);
        const projectSkillsPath = path.join(root, '.claude', 'skills');

        // Check if .claude/skills has skills synced to current IDE
        const isProjectSkillsSynced = this.checkProjectSkillsSynced(projectSkillsPath, rulesPath);

        return getSkillDirectories(root)
            .map(dir => {
                const isProjectAgentSkills = dir.path === projectSkillsPath;
                return {
                    type: 'local-group' as const,
                    name: dir.displayName,
                    path: dir.path,
                    icon: dir.icon,
                    exists: fs.existsSync(dir.path),
                    needsSync: isProjectAgentSkills ? !isProjectSkillsSynced : undefined,
                    currentIde: isProjectAgentSkills ? currentIde : undefined
                };
            })
            .filter(group => {
                // Only show groups that exist and have at least one skill
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

    /**
     * Check if .claude/skills has skills and they are synced to rules file
     */
    private checkProjectSkillsSynced(skillsDir: string, rulesPath: string): boolean {
        if (!fs.existsSync(skillsDir)) return true; // No skills = synced

        // Check if there are any skills in the directory
        try {
            const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
            const hasSkills = entries.some(entry =>
                entry.isDirectory() &&
                !entry.name.startsWith('.') &&
                fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md'))
            );
            if (!hasSkills) return true; // No skills = synced
        } catch {
            return true;
        }

        // Check if rules file exists and has skills
        if (!fs.existsSync(rulesPath)) return false;

        try {
            const content = fs.readFileSync(rulesPath, 'utf-8');
            // Check if the rules file has skills_system section
            return content.includes('<skills_system') || content.includes('<available_skills>');
        } catch {
            return false;
        }
    }

    private getLocalSkillsFromGroup(group: LocalSkillsGroup): LocalSkill[] {
        if (!fs.existsSync(group.path)) return [];

        const root = this.getWorkspaceRoot();
        const isProjectGroup = root ? group.path.startsWith(root) : false;
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
                            synced: this.isSkillSynced(entry.name, isProjectGroup)
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

            // For .claude/skills, show sync status
            if (element.needsSync !== undefined) {
                if (element.needsSync) {
                    item.contextValue = 'localSkillsGroupNeedsSync';
                    item.description = `[Needs Sync to ${element.currentIde}]`;
                    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
                } else {
                    item.contextValue = 'localSkillsGroup';
                    item.description = '[Synced]';
                    item.iconPath = new vscode.ThemeIcon(element.icon);
                }
            } else {
                item.contextValue = 'localSkillsGroup';
                item.iconPath = new vscode.ThemeIcon(element.icon);
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

                const status: string[] = [];
                if (element.synced) status.push('Synced');
                item.description = status.length > 0 ? `[${status.join(', ')}]` : element.description;

                item.iconPath = element.synced
                    ? new vscode.ThemeIcon('pass-filled')
                    : new vscode.ThemeIcon('tools');
            } else {
                // Personal directory skills: have install button only (like git skills)
                item.contextValue = 'personalSkill';

                // Check if already installed in project
                const installed = this.isSkillInstalled(element.name);
                const status: string[] = [];
                if (installed) status.push('Installed');
                if (element.synced) status.push('Synced');

                const truncatedDesc = element.description.length > 10
                    ? element.description.substring(0, 10) + '...'
                    : element.description;
                item.description = status.length > 0 ? `[${status.join(', ')}]` : truncatedDesc;

                if (installed) {
                    item.contextValue = 'personalSkillInstalled';
                    item.iconPath = element.synced
                        ? new vscode.ThemeIcon('pass-filled')
                        : new vscode.ThemeIcon('check');
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
            const synced = this.isSkillSynced(element.name, true); // Repo skills install to project directory
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
            if (synced) status.push('Synced');

            item.contextValue = installed ? 'skillInstalled' : 'skill';
            const truncatedDesc = element.description.length > 10
                ? element.description.substring(0, 10) + '...'
                : element.description;
            item.description = status.length > 0 ? `[${status.join(', ')}]` : truncatedDesc;
            item.tooltip = `${element.name}\n${element.description}\n${element.path}`;

            let iconName = 'tools';
            if (installed && synced) {
                iconName = 'pass-filled';
            } else if (installed) {
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
            this.updateSyncedSkillsCache();
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
