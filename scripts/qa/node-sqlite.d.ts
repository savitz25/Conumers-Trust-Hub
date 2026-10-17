/** Local Node 22.18 harness API subset. The repo's pinned Node types predate
 * node:sqlite; do not upgrade production dependencies for this fixture. */
declare module 'node:sqlite' {
  export interface StatementSync {
    get(...values: (string | number)[]): Record<string, unknown> | undefined;
    all(...values: (string | number)[]): Record<string, unknown>[];
    run(...values: (string | number)[]): { changes: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): StatementSync;
  }
}
