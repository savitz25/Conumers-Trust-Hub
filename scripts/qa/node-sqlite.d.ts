/** Local Node 22.18 harness API subset. The repo's pinned Node types predate
 * node:sqlite; do not upgrade production dependencies for this fixture. */
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      get(...values: (string | number)[]): Record<string, unknown> | undefined;
      run(...values: (string | number)[]): { changes: number | bigint };
    };
  }
}
