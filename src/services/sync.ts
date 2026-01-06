import * as cp from 'child_process';
import * as path from 'path';
import { SyncResult } from '../types';
import { getIdeConfig } from '../utils/ide';

/**
 * Sync installed skills to AGENTS.md using CLI
 */
export function syncToAgentsMd(workspaceRoot: string, ideName?: string): SyncResult {
    const config = getIdeConfig(ideName || 'vscode');
    const outputPath = path.join(workspaceRoot, config.rulesFile);

    try {
        const command = `openskills sync -y --output "${outputPath}"`;
        const stdout = cp.execSync(command, {
            cwd: workspaceRoot,
            encoding: 'utf-8',
            windowsHide: true
        });

        const match = stdout.match(/Synced (\d+) skill\(s\)/);
        const count = match ? parseInt(match[1], 10) : 0;

        return {
            success: true,
            message: `Successfully synced skills to ${path.basename(outputPath)}`,
            count
        };
    } catch (error: any) {
        console.error('[OpenSkills] Sync failed:', error);
        return {
            success: false,
            message: `Sync failed. Ensure 'openskills' is in your PATH. Error: ${error.message}`,
            count: 0
        };
    }
}
