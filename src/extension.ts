import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SkillsProvider } from './skillsProvider';
import { ConfigManager } from './configManager';
import { GitService } from './services/git';
import { Skill, SkillRepo, LocalSkill } from './types';
import { copyRecursiveSync } from './utils/fs';

type TreeNode = SkillRepo | Skill | { type: string; name: string; path: string };
let skillsTreeView: vscode.TreeView<TreeNode>;

export function activate(context: vscode.ExtensionContext) {
    const skillsProvider = new SkillsProvider();

    // Create Output Channel
    const outputChannel = vscode.window.createOutputChannel('Agent Skills Manager');

    // Patch console to redirect to Output Channel
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[INFO] ${message}`);
        originalLog.apply(console, args);
    };

    console.error = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[ERROR] ${message}`);
        originalError.apply(console, args);
    };

    outputChannel.appendLine('Agent Skills Manager extension activated');

    skillsTreeView = vscode.window.createTreeView('agentskills-skills', {
        treeDataProvider: skillsProvider,
        canSelectMany: true
    });

    context.subscriptions.push(skillsTreeView);

    // Auto-pull preset repositories on activation
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Initializing preset skills repositories...',
        cancellable: false
    }, async () => {
        await ConfigManager.ensurePresetRepos();
        skillsProvider.refresh();
    });

    skillsTreeView.onDidChangeCheckboxState(e => {
        e.items.forEach(([item, state]) => {
            // Only handle repo skills (have repoUrl, not local skills)
            if ('repoUrl' in item) {
                skillsProvider.setChecked(item as Skill, state === vscode.TreeItemCheckboxState.Checked);
            }
        });
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('agentskills.refresh', () => skillsProvider.refresh()),

        vscode.commands.registerCommand('agentskills.addRepo', async () => {
            const url = await vscode.window.showInputBox({
                placeHolder: 'Enter Git Repository URL (e.g., https://github.com/anthropics/skills)',
                prompt: 'Add a new Skill Repository'
            });
            if (url) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Adding repository...',
                    cancellable: false
                }, async () => {
                    await ConfigManager.addRepo(url);
                    skillsProvider.refresh();
                });
            }
        }),

        vscode.commands.registerCommand('agentskills.removeRepo', async (node: SkillRepo) => {
            const result = await vscode.window.showWarningMessage(`Remove repository ${node.name}?`, 'Yes', 'No');
            if (result === 'Yes') {
                await ConfigManager.removeRepo(node.url);
                skillsProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('agentskills.switchBranch', async (node: SkillRepo) => {
            const branches = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching branches...',
                cancellable: false
            }, async () => {
                return await GitService.getRemoteBranches(node.url);
            });

            if (branches.length === 0) {
                vscode.window.showErrorMessage('Could not list branches or no branches found.');
                return;
            }

            const selected = await vscode.window.showQuickPick(branches, {
                placeHolder: `Select branch for ${node.name} (current: ${node.branch || 'default'})`
            });

            if (selected) {
                await ConfigManager.updateRepo(node.url, { branch: selected });
                skillsProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('agentskills.pullRepo', async (node: SkillRepo) => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Pulling ${node.name}...`,
                cancellable: false
            }, async () => {
                await GitService.pullRepo(node.url, node.branch);
            });
            skillsProvider.refresh();
            vscode.window.showInformationMessage(`${node.name} updated.`);
        }),

        vscode.commands.registerCommand('agentskills.sync', async () => {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing to AGENTS.md...',
                cancellable: false
            }, async () => {
                outputChannel.show();
                console.log(`Starting sync process... IDE: ${vscode.env.appName}`);
                const { syncToAgentsMd } = await import('./services/sync');
                const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                const result = syncToAgentsMd(workspaceRoot, vscode.env.appName);

                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            });
        }),

        vscode.commands.registerCommand('agentskills.installSelected', async () => {
            const checked = skillsProvider.getCheckedSkills();
            const selected = checked.length > 0
                ? checked
                : (skillsTreeView.selection.filter(item => !('url' in item)) as Skill[]);

            if (selected.length === 0) {
                vscode.window.showWarningMessage('Please select skills to install (use checkboxes).');
                return;
            }

            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${selected.length} skill(s)...`,
                cancellable: false
            }, async (progress) => {
                const targetBase = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.agent', 'skills');

                for (let i = 0; i < selected.length; i++) {
                    const skill = selected[i];
                    progress.report({ message: `${skill.name} (${i + 1}/${selected.length})` });

                    const targetDir = path.join(targetBase, skill.name);

                    if (!skill.localPath || !fs.existsSync(skill.localPath)) {
                        vscode.window.showWarningMessage(`Source files missing for ${skill.name}. Try refreshing.`);
                        continue;
                    }

                    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
                    copyRecursiveSync(skill.localPath, targetDir);
                }
            });

            skillsProvider.refresh();

            // Auto sync after install
            const { syncToAgentsMd } = await import('./services/sync');
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const result = syncToAgentsMd(workspaceRoot, vscode.env.appName);

            if (result.success) {
                vscode.window.showInformationMessage(`Installed ${selected.length} skill(s) and synced.`);
            } else {
                vscode.window.showWarningMessage(`Installed ${selected.length} skill(s), but sync failed: ${result.message}`);
            }
        }),

        vscode.commands.registerCommand('agentskills.deleteSelected', async () => {
            const checked = skillsProvider.getCheckedSkills();
            const selected = checked.length > 0
                ? checked
                : (skillsTreeView.selection.filter(item => !('url' in item)) as Skill[]);

            if (selected.length === 0) {
                vscode.window.showWarningMessage('Please select skills to delete.');
                return;
            }

            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete ${selected.length} skill(s) from this project?`,
                'Yes', 'No'
            );

            if (confirm !== 'Yes') return;

            const targetBase = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.agent', 'skills');

            for (const skill of selected) {
                const targetDir = path.join(targetBase, skill.name);
                if (fs.existsSync(targetDir)) {
                    fs.rmSync(targetDir, { recursive: true, force: true });
                }
            }

            skillsProvider.refresh();
            vscode.window.showInformationMessage(`Deleted ${selected.length} skill(s).`);
        }),

        vscode.commands.registerCommand('agentskills.installSkill', async (node: Skill) => {
            if (!node || !('repoUrl' in node)) {
                vscode.window.showErrorMessage('Please select a skill to install.');
                return;
            }

            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing ${node.name}...`,
                cancellable: false
            }, async () => {
                const targetBase = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.agent', 'skills');
                const targetDir = path.join(targetBase, node.name);

                if (!node.localPath || !fs.existsSync(node.localPath)) {
                    vscode.window.showWarningMessage(`Source files missing for ${node.name}. Try refreshing.`);
                    return;
                }

                fs.mkdirSync(path.dirname(targetDir), { recursive: true });
                copyRecursiveSync(node.localPath, targetDir);
            });

            skillsProvider.refresh();

            // Auto sync after install
            const { syncToAgentsMd } = await import('./services/sync');
            const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
            const result = syncToAgentsMd(workspaceRoot, vscode.env.appName);

            if (result.success) {
                vscode.window.showInformationMessage(`Installed skill "${node.name}" and synced.`);
            } else {
                vscode.window.showWarningMessage(`Installed skill "${node.name}", but sync failed: ${result.message}`);
            }
        }),

        vscode.commands.registerCommand('agentskills.deleteSkill', async (node: Skill) => {
            if (!node || !('repoUrl' in node)) {
                vscode.window.showErrorMessage('Please select a skill to delete.');
                return;
            }

            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete skill "${node.name}" from this project?`,
                'Yes', 'No'
            );

            if (confirm !== 'Yes') return;

            const targetBase = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.agent', 'skills');
            const targetDir = path.join(targetBase, node.name);

            if (fs.existsSync(targetDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
            }

            skillsProvider.refresh();
            vscode.window.showInformationMessage(`Deleted skill "${node.name}".`);
        }),

        vscode.commands.registerCommand('agentskills.deleteLocalSkill', async (node: LocalSkill) => {
            if (!node || node.type !== 'local-skill') {
                vscode.window.showErrorMessage('Please select a local skill to delete.');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete skill "${node.name}" from ${node.groupPath}?`,
                'Yes', 'No'
            );

            if (confirm !== 'Yes') return;

            try {
                if (fs.existsSync(node.path)) {
                    fs.rmSync(node.path, { recursive: true, force: true });
                }
                skillsProvider.refresh();
                vscode.window.showInformationMessage(`Deleted skill "${node.name}".`);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed to delete skill: ${e}`);
            }
        }),

        vscode.commands.registerCommand('agentskills.openLocalSkill', async (node: LocalSkill) => {
            if (!node || node.type !== 'local-skill') return;

            const skillMdPath = path.join(node.path, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
                const doc = await vscode.workspace.openTextDocument(skillMdPath);
                await vscode.window.showTextDocument(doc);
            }
        }),

        vscode.commands.registerCommand('agentskills.syncToCurrentIde', async () => {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing skills to current IDE...',
                cancellable: false
            }, async () => {
                outputChannel.show();
                console.log(`Syncing skills to current IDE: ${vscode.env.appName}`);
                const { syncToAgentsMd } = await import('./services/sync');
                const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                const result = syncToAgentsMd(workspaceRoot, vscode.env.appName);

                if (result.success) {
                    vscode.window.showInformationMessage(result.message);
                } else {
                    vscode.window.showErrorMessage(result.message);
                }
            });

            skillsProvider.refresh();
        })
    );

    // Check sync status on startup and notify user
    checkSyncStatusOnStartup(skillsProvider);
}

/**
 * Check sync status on startup and show notification if needed
 */
async function checkSyncStatusOnStartup(skillsProvider: SkillsProvider): Promise<void> {
    // Wait a bit for the extension to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    const syncStatus = skillsProvider.getSyncStatus();
    if (syncStatus.needsSync) {
        const action = await vscode.window.showInformationMessage(
            `Skills in .agent/skills are not synced to ${syncStatus.rulesFile}. Sync now?`,
            'Sync',
            'Later'
        );
        if (action === 'Sync') {
            await vscode.commands.executeCommand('agentskills.syncToCurrentIde');
        }
    }
}

export function deactivate() { }
