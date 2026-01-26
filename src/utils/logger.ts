import type * as vscode from 'vscode';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
    minLevel?: LogLevel;
    mirrorToConsole?: boolean;
}

type LoggerSink = {
    outputChannel?: vscode.OutputChannel;
};

const levelOrder: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

function toConsoleMethod(level: LogLevel): 'debug' | 'info' | 'warn' | 'error' {
    if (level === 'debug') return 'debug';
    if (level === 'info') return 'info';
    if (level === 'warn') return 'warn';
    return 'error';
}

function safeJsonStringify(value: unknown): string | undefined {
    try {
        const seen = new WeakSet<object>();
        return JSON.stringify(value, (_key, val) => {
            if (typeof val === 'bigint') return String(val);
            if (!val || typeof val !== 'object') return val;
            if (seen.has(val as object)) return '[Circular]';
            seen.add(val as object);
            return val;
        });
    } catch {
        return undefined;
    }
}

function formatValue(value: unknown): string {
    if (value instanceof Error) {
        return value.stack ?? `${value.name}: ${value.message}`;
    }
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    const json = safeJsonStringify(value);
    if (json !== undefined) return json;
    try {
        return String(value);
    } catch {
        return '[Unprintable]';
    }
}

function formatArgs(args: unknown[]): string {
    return args.map(formatValue).join(' ');
}

export class Logger {
    private sink: LoggerSink;
    private scope?: string;
    private minLevel: LogLevel;
    private mirrorToConsole: boolean;

    constructor(outputChannel?: vscode.OutputChannel, options?: LoggerOptions) {
        this.sink = { outputChannel };
        this.scope = undefined;
        this.minLevel = options?.minLevel ?? 'debug';
        this.mirrorToConsole = options?.mirrorToConsole ?? true;
    }

    setOutputChannel(outputChannel: vscode.OutputChannel | undefined): void {
        this.sink.outputChannel = outputChannel;
    }

    child(scope: string): Logger {
        const child = new Logger(undefined, { minLevel: this.minLevel, mirrorToConsole: this.mirrorToConsole });
        child.sink = this.sink;
        child.scope = scope;
        return child;
    }

    debug(...args: unknown[]): void {
        this.log('debug', args);
    }

    info(...args: unknown[]): void {
        this.log('info', args);
    }

    warn(...args: unknown[]): void {
        this.log('warn', args);
    }

    error(...args: unknown[]): void {
        this.log('error', args);
    }

    private log(level: LogLevel, args: unknown[]): void {
        if (levelOrder[level] < levelOrder[this.minLevel]) return;

        const levelText = level.toUpperCase();
        const scopeText = this.scope ? ` [${this.scope}]` : '';
        const line = `[${levelText}]${scopeText} ${formatArgs(args)}`;

        this.sink.outputChannel?.appendLine(line);

        if (this.mirrorToConsole) {
            const method = toConsoleMethod(level);
            (console[method] ?? console.log).apply(console, args as any);
        }
    }
}

const defaultLogger = new Logger(undefined, { minLevel: 'debug', mirrorToConsole: true });

export function getLogger(scope?: string): Logger {
    return scope ? defaultLogger.child(scope) : defaultLogger;
}

export function setLoggerOutputChannel(outputChannel: vscode.OutputChannel | undefined): void {
    defaultLogger.setOutputChannel(outputChannel);
}
