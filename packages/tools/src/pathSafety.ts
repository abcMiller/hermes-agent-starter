import path from 'node:path';

export function resolveInsideWorkspace(workspaceDir: string, requestedPath: string): string {
  const resolved = path.resolve(workspaceDir, requestedPath);
  const normalizedWorkspace = path.resolve(workspaceDir);
  if (resolved !== normalizedWorkspace && !resolved.startsWith(normalizedWorkspace + path.sep)) {
    throw new Error(`Path escapes workspace: ${requestedPath}`);
  }
  return resolved;
}
