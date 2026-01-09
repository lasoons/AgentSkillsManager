import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Compute a hash of a single file's content
 */
function computeFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Recursively collect all file paths and their hashes in a directory
 * Returns a sorted array of "relativePath:hash" strings for deterministic comparison
 */
function collectFileHashes(dirPath: string, basePath: string = dirPath): string[] {
    const hashes: string[] = [];

    if (!fs.existsSync(dirPath)) {
        return hashes;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) {
            continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
            // Recurse into subdirectories
            hashes.push(...collectFileHashes(fullPath, basePath));
        } else if (entry.isFile()) {
            const fileHash = computeFileHash(fullPath);
            hashes.push(`${relativePath}:${fileHash}`);
        } else if (entry.isSymbolicLink()) {
            // For symlinks, hash the target path (not following it)
            try {
                const target = fs.readlinkSync(fullPath);
                const linkHash = crypto.createHash('md5').update(target).digest('hex');
                hashes.push(`${relativePath}:link:${linkHash}`);
            } catch {
                // Ignore broken symlinks
            }
        }
    }

    return hashes.sort();
}

/**
 * Compute a combined hash for an entire directory
 * This hash changes if any file content, name, or structure changes
 */
export function computeDirectoryHash(dirPath: string): string {
    const fileHashes = collectFileHashes(dirPath);
    const combined = fileHashes.join('\n');
    return crypto.createHash('md5').update(combined).digest('hex');
}

/**
 * Compare two skill directories to check if they have identical content
 * @param dir1 First directory path
 * @param dir2 Second directory path
 * @returns true if directories have identical content, false otherwise
 */
export function compareSkillDirectories(dir1: string, dir2: string): boolean {
    if (!fs.existsSync(dir1) || !fs.existsSync(dir2)) {
        return false;
    }

    const hash1 = computeDirectoryHash(dir1);
    const hash2 = computeDirectoryHash(dir2);

    return hash1 === hash2;
}

/**
 * Cache for directory hashes to avoid recomputing
 */
const hashCache = new Map<string, { hash: string; mtime: number }>();

/**
 * Get cached directory hash, recomputing if directory has been modified
 */
export function getCachedDirectoryHash(dirPath: string): string {
    if (!fs.existsSync(dirPath)) {
        return '';
    }

    try {
        const stats = fs.statSync(dirPath);
        const mtime = stats.mtimeMs;
        const cached = hashCache.get(dirPath);

        if (cached && cached.mtime === mtime) {
            return cached.hash;
        }

        const hash = computeDirectoryHash(dirPath);
        hashCache.set(dirPath, { hash, mtime });
        return hash;
    } catch {
        return '';
    }
}

/**
 * Clear the hash cache (useful after installations/deletions)
 */
export function clearHashCache(): void {
    hashCache.clear();
}
