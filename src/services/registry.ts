import * as https from 'https';

export interface RegistrySkillApiItem {
    id: string;
    name: string;
    namespace: string;
    sourceUrl: string;
    description: string;
    author: string;
    installs: number;
    stars: number;
}

export interface RegistrySearchResponse {
    skills: RegistrySkillApiItem[];
    total: number;
    limit: number;
    offset: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

function requestJson<T>(url: string, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
            const status = res.statusCode ?? 0;
            const chunks: Buffer[] = [];

            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                if (status < 200 || status >= 300) {
                    reject(new Error(`Registry request failed (${status})`));
                    return;
                }
                try {
                    resolve(JSON.parse(body) as T);
                } catch (error) {
                    reject(new Error(`Failed to parse registry response: ${String(error)}`));
                }
            });
        });

        req.on('error', (error) => reject(error));
        req.setTimeout(timeoutMs, () => req.destroy(new Error(`Registry request timed out after ${timeoutMs}ms`)));
    });
}

export class RegistryService {
    static async searchSkills(query: string, limit = 20, offset = 0): Promise<RegistrySearchResponse> {
        const trimmed = query.trim();
        if (!trimmed) {
            return { skills: [], total: 0, limit, offset };
        }

        const url = `https://claude-plugins.dev/api/skills?q=${encodeURIComponent(trimmed)}&limit=${limit}&offset=${offset}`;
        const data = await requestJson<RegistrySearchResponse>(url, DEFAULT_TIMEOUT_MS);

        const skills = Array.isArray(data?.skills) ? data.skills : [];
        const total = typeof data?.total === 'number' ? data.total : skills.length;
        const resolvedLimit = typeof data?.limit === 'number' ? data.limit : limit;
        const resolvedOffset = typeof data?.offset === 'number' ? data.offset : offset;

        return { skills, total, limit: resolvedLimit, offset: resolvedOffset };
    }
}
