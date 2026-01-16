import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SkillsProvider } from './skillsProvider';
import { ConfigManager } from './configManager';
import { GitService } from './services/git';
import { Skill, SkillRepo, LocalSkill, LocalSkillsGroup } from './types';
import { copyRecursiveSync } from './utils/fs';
import { detectIde, getProjectSkillsDir } from './utils/ide';

type TreeNode = SkillRepo | Skill | LocalSkillsGroup | LocalSkill;
let skillsTreeView: vscode.TreeView<TreeNode>;

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Agent Skills Manager');
    context.subscriptions.push(outputChannel);

    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalDebug = console.debug;

    console.log = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[INFO] ${message}`);
        originalLog.apply(console, args);
    };

    console.info = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[INFO] ${message}`);
        originalInfo.apply(console, args);
    };

    console.warn = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[WARN] ${message}`);
        originalWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[ERROR] ${message}`);
        originalError.apply(console, args);
    };

    console.debug = (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        outputChannel.appendLine(`[DEBUG] ${message}`);
        originalDebug.apply(console, args);
    };

    outputChannel.appendLine('[INFO] Agent Skills Manager extension activated');
    outputChannel.appendLine(`[INFO] IDE detect hint (vscode.env.appName): ${vscode.env.appName}`);
    outputChannel.appendLine(`[INFO] ENV AGENTSKILLS_IDE=${process.env.AGENTSKILLS_IDE ?? ''}`);
    outputChannel.appendLine(`[INFO] ENV VSCODE_BRAND=${process.env.VSCODE_BRAND ?? ''}`);
    outputChannel.appendLine(`[INFO] ENV VSCODE_ENV_APPNAME=${process.env.VSCODE_ENV_APPNAME ?? ''}`);
    outputChannel.appendLine(`[INFO] ENV PROG_IDE_NAME=${process.env.PROG_IDE_NAME ?? ''}`);

    outputChannel.appendLine('[INFO] Creating SkillsProvider');
    const skillsProvider = new SkillsProvider(context.globalState, outputChannel);

    const dragMimeType = 'application/vnd.agentskills.node';
    const dragAndDropController: vscode.TreeDragAndDropController<TreeNode> = {
        dragMimeTypes: [dragMimeType],
        dropMimeTypes: [dragMimeType],
        handleDrag: (source, dataTransfer, _token) => {
            const first = source[0];
            if (!first) return;

            if ('type' in first && first.type === 'local-group') {
                const group = first as LocalSkillsGroup;
                if (group.isActive) return;
                dataTransfer.set(dragMimeType, new vscode.DataTransferItem(JSON.stringify({
                    kind: 'localGroup',
                    key: group.path
                })));
                return;
            }

            if ('url' in first) {
                const repo = first as SkillRepo;
                dataTransfer.set(dragMimeType, new vscode.DataTransferItem(JSON.stringify({
                    kind: 'repo',
                    key: repo.url
                })));
            }
        },
        handleDrop: (_target, dataTransfer, _token) => {
            const item = dataTransfer.get(dragMimeType);
            const raw = item?.value;
            if (typeof raw !== 'string') return;

            const parsed = JSON.parse(raw) as { kind: 'repo' | 'localGroup'; key: string };
            const target = _target as any | undefined;

            if (parsed.kind === 'repo') {
                const targetKey = target && ('url' in target) ? String(target.url) : undefined;
                skillsProvider.reorderAfterDrop('repo', parsed.key, targetKey);
                return;
            }

            if (parsed.kind === 'localGroup') {
                const isTargetGroup = target && target.type === 'local-group';
                const targetKey = isTargetGroup && !target.isActive ? String(target.path) : undefined;
                skillsProvider.reorderAfterDrop('localGroup', parsed.key, targetKey);
            }
        }
    };

    skillsTreeView = vscode.window.createTreeView('agentskills-skills', {
        treeDataProvider: skillsProvider,
        canSelectMany: true,
        dragAndDropController
    });

    context.subscriptions.push(skillsTreeView);
    outputChannel.appendLine('[INFO] Skills TreeView created');
    outputChannel.appendLine('[INFO] Starting initial refresh/indexing');
    skillsProvider.refresh();

    const updateSearchUi = (query: string) => {
        skillsTreeView.message = query ? `Filter: ${query}` : undefined;
        void vscode.commands.executeCommand('setContext', 'agentskills.hasFilter', Boolean(query));
    };

    updateSearchUi(skillsProvider.getSearchQuery());
    context.subscriptions.push(skillsProvider.onDidChangeSearchQuery(updateSearchUi));

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
        vscode.commands.registerCommand('agentskills.search', async () => {
            const query = await vscode.window.showInputBox({
                placeHolder: 'Search skills by name or description',
                prompt: 'Search Skills',
                value: skillsProvider.getSearchQuery()
            });
            if (query === undefined) return;
            skillsProvider.setSearchQuery(query);

            if (query.trim()) {
                await skillsProvider.waitForIndexing();
                await skillsProvider.recomputeRootNodesForReveal();
                await vscode.commands.executeCommand('workbench.actions.treeView.agentskills-skills.collapseAll');
                for (const node of skillsProvider.getExpandableRootsForSearch()) {
                    await skillsTreeView.reveal(node as any, { expand: true, select: false, focus: false });
                }
            }
        }),
        vscode.commands.registerCommand('agentskills.clearSearch', () => {
            skillsProvider.setSearchQuery('');
            void vscode.commands.executeCommand('workbench.actions.treeView.agentskills-skills.collapseAll');
        }),
        vscode.commands.registerCommand('agentskills.selectAllInRepo', async (node: SkillRepo) => {
            if (!node || !('url' in node)) return;
            await skillsProvider.waitForIndexing();
            skillsProvider.checkAllSkillsInRepo(node);
        }),
        vscode.commands.registerCommand('agentskills.clearInRepo', async (node: SkillRepo) => {
            if (!node || !('url' in node)) return;
            await skillsProvider.waitForIndexing();
            skillsProvider.clearCheckedSkillsInRepo(node);
        }),

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
                const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                const targetBase = getProjectSkillsDir(workspaceRoot, detectIde(process.env, vscode.env.appName));

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

            skillsProvider.clearSelection();
            vscode.window.showInformationMessage(`Installed ${selected.length} skill(s).`);
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

            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const targetBase = getProjectSkillsDir(workspaceRoot, detectIde(process.env, vscode.env.appName));

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
                const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                const targetBase = getProjectSkillsDir(workspaceRoot, detectIde(process.env, vscode.env.appName));
                const targetDir = path.join(targetBase, node.name);

                if (!node.localPath || !fs.existsSync(node.localPath)) {
                    vscode.window.showWarningMessage(`Source files missing for ${node.name}. Try refreshing.`);
                    return;
                }

                fs.mkdirSync(path.dirname(targetDir), { recursive: true });
                copyRecursiveSync(node.localPath, targetDir);
            });

            skillsProvider.clearSelection();
            vscode.window.showInformationMessage(`Installed skill "${node.name}".`);
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

            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const targetBase = getProjectSkillsDir(workspaceRoot, detectIde(process.env, vscode.env.appName));
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

        vscode.commands.registerCommand('agentskills.installPersonalSkill', async (node: LocalSkill) => {
            if (!node || node.type !== 'local-skill') {
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
                const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                const targetBase = getProjectSkillsDir(workspaceRoot, detectIde(process.env, vscode.env.appName));
                const targetDir = path.join(targetBase, node.name);

                if (!fs.existsSync(node.path)) {
                    vscode.window.showWarningMessage(`Source files missing for ${node.name}.`);
                    return;
                }

                fs.mkdirSync(path.dirname(targetDir), { recursive: true });
                copyRecursiveSync(node.path, targetDir);
            });

            skillsProvider.clearSelection();
            vscode.window.showInformationMessage(`Installed skill "${node.name}".`);
        })
    );

    // Show the view on first load or update to help user find the extension
    const extensionId = 'whyuds.agent-skills-manager';
    const extension = vscode.extensions.getExtension(extensionId);
    const currentVersion = extension?.packageJSON.version;
    const lastVersion = context.globalState.get<string>('agentskills.lastShownVersion');

    if (currentVersion && currentVersion !== lastVersion) {
        // Delay slightly to ensure UI is ready
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.view.extension.agentskills-explorer');
        }, 1000);
        context.globalState.update('agentskills.lastShownVersion', currentVersion);
    }

}

export function deactivate() { }
