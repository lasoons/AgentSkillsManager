/**
 * Match status between installed skill and repository skill
 */
export enum SkillMatchStatus {
    NotInstalled = 'not_installed',    // Skill not installed in workspace
    Matched = 'matched',                // Installed skill matches this repo version
    Conflict = 'conflict',              // Installed skill differs from this repo version
}

export interface Skill {
    name: string;
    description: string;
    path: string; // Relative path in the repo
    repoUrl: string;
    localPath?: string; // If locally cloned
    installed?: boolean; // Whether installed in current workspace
    matchStatus?: SkillMatchStatus; // Match status with installed version
}

export interface SkillRepo {
    url: string;
    name: string; // User friendly name or derived from URL
    branch?: string;
    isPreset?: boolean; // Whether this is a preset (built-in) repository
}

export interface SyncResult {
    success: boolean;
    message: string;
    count: number;
}

/**
 * Represents an installed skill (in project or global directory)
 */
export interface InstalledSkill {
    name: string;
    description: string;
    location: 'project' | 'global';
    path: string;
    explicitLocation?: string; // e.g. "project/.agent/skills/myskill/SKILL.md"
}

/**
 * Represents a local skills directory group in the TreeView
 */
export interface LocalSkillsGroup {
    type: 'local-group';
    name: string;           // Display name, e.g. "project/.agent/skills"
    path: string;           // Actual directory path
    icon: string;           // Icon name
    exists: boolean;        // Whether the directory exists
    needsSync?: boolean;    // Whether skills exist but not synced to current IDE
    currentIde?: string;    // Current IDE type (e.g. 'antigravity', 'cursor')
}

/**
 * Represents a skill in a local directory
 */
export interface LocalSkill {
    type: 'local-skill';
    name: string;
    description: string;
    path: string;           // Full path to skill directory
    groupPath: string;      // Parent group directory path
    synced: boolean;        // Whether synced to AGENTS.md
}

