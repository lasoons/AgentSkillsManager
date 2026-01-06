import * as cp from 'child_process';
import * as path from 'path';
import { getIdeConfig } from './utils/ide';

/**
 * Sync installed skills to AGENTS.md using CLI
 */
export function syncToAgentsMd(workspaceRoot: string, ideName?: string): { success: boolean; message: string; count: number } {
    const config = getIdeConfig(ideName || 'vscode');
    const outputPath = path.join(workspaceRoot, config.rulesFile);

    try {
        console.log(`[OpenSkills] Executing CLI sync to ${outputPath}`);

        // We use -y for non-interactive mode
        // We specicy output path explicitly
        const command = `openskills sync -y --output "${outputPath}"`;

        // Execute command in workspace root
        const stdout = cp.execSync(command, {
            cwd: workspaceRoot,
            encoding: 'utf-8',
            windowsHide: true
        });

        console.log(`[OpenSkills] CLI Output: ${stdout}`);

        // Try to parse count from output if possible (e.g. "Synced X skill(s)")
        // Output format: "✅ Synced X skill(s) to AGENTS.md"
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
