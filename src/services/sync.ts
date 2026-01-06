import * as fs from 'fs';
import * as path from 'path';
import { SyncResult } from '../types';
import { getIdeConfig } from '../utils/ide';
import { findAllInstalledSkills } from '../utils/skills';
import { generateSkillsXml, replaceSkillsSection } from '../utils/agentsMd';

/**
 * Sync installed skills to AGENTS.md (native implementation, no CLI dependency)
 */
export function syncToAgentsMd(workspaceRoot: string, ideName?: string): SyncResult {
    const config = getIdeConfig(ideName || 'vscode');
    const outputPath = path.join(workspaceRoot, config.rulesFile);

    try {
        // Validate output file is markdown
        if (!outputPath.endsWith('.md') && !outputPath.endsWith('.mdc')) {
            return {
                success: false,
                message: 'Output file must be a markdown file (.md or .mdc)',
                count: 0
            };
        }

        // Find all installed skills
        const skills = findAllInstalledSkills(workspaceRoot);
        console.log(`[OpenSkills] Found ${skills.length} installed skill(s)`);

        if (skills.length === 0) {
            return {
                success: true,
                message: 'No skills installed. Install skills first.',
                count: 0
            };
        }

        // Create file if it doesn't exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let content = '';
        if (fs.existsSync(outputPath)) {
            content = fs.readFileSync(outputPath, 'utf-8');
        } else {
            content = config.initialContent;
            console.log(`[OpenSkills] Created ${outputPath}`);
        }

        // Generate XML and replace section
        const xml = generateSkillsXml(skills);
        const updated = replaceSkillsSection(content, xml);

        fs.writeFileSync(outputPath, updated);

        return {
            success: true,
            message: `Successfully synced skills to ${path.basename(outputPath)}`,
            count: skills.length
        };
    } catch (error: any) {
        console.error('[OpenSkills] Sync failed:', error);
        return {
            success: false,
            message: `Sync failed: ${error.message}`,
            count: 0
        };
    }
}
