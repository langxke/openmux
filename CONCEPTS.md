# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## PTY Session

A pseudo-terminal process owned by the Electron main process, accessed by the renderer through IPC. Each terminal panel has exactly one PTY session.

Lifecycle: `opening` → `ready` → (optionally `releasing` → `ready`) → `exited`. Release uses a delayed kill (500ms) to allow quick panel recreation without spawning a new process; dispose kills immediately. Ownership and lifecycle management are the responsibility of PtyManager in the main process — the renderer never touches node-pty directly.

## Dockview Layout

The panel layout system governing how terminal and browser panels are arranged within a workspace. Built on the dockview library, each workspace owns one independent layout instance with its own serialized state. Supports split views, tab groups, and drag-to-rearrange.

*Avoid:* split layout, panel container

## Workspace

A named collection of dockview panels with an independently persisted layout. Multiple workspaces coexist in memory — switching between them toggles CSS visibility rather than destroying the hidden workspace's panels, so PTY sessions in background workspaces continue running.
