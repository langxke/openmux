# Directory Restructure Plan

> Status: planned, not yet executed

## Context

Flatten the project: eliminate the extra `glaze-app/` nesting level. Application files move to repo root; non-application content (docs, planning, screenshots) moves into `.claude/`.

## Before → After

```
glaze/                          glaze/
├── .claude/                    ├── .claude/
│   ├── CLAUDE.md               │   ├── CLAUDE.md
│   └── notes/                  │   ├── notes/
│       ├── electron-migration.md│   │   ├── electron-migration.md
│       ├── pty-lifecycle.md    │   │   ├── pty-lifecycle.md
│       └── tauri-experience.md │   │   └── tauri-experience.md
├── tasks/                      │   ├── tasks/
│   └── PRD.md                  │   │   └── PRD.md
├── migration-plan.md           │   ├── migration-plan.md
├── cmux-hero.png               │   ├── assets/
├── cmux-readme-top.png         │   │   ├── cmux-hero.png
├── glaze-working.png           │   │   ├── cmux-readme-top.png
├── .gitignore                  │   │   └── glaze-working.png
└── glaze-app/                  ├── .gitignore
    ├── .npmrc                  ├── .npmrc
    ├── forge.config.ts         ├── forge.config.ts
    ├── index.html              ├── index.html
    ├── package.json            ├── package.json
    ├── pnpm-lock.yaml          ├── pnpm-lock.yaml
    ├── tsconfig.json           ├── tsconfig.json
    ├── tsconfig.app.json       ├── tsconfig.app.json
    ├── tsconfig.node.json      ├── tsconfig.node.json
    ├── vite.main.config.ts     ├── vite.main.config.ts
    ├── vite.preload.config.ts  ├── vite.preload.config.ts
    ├── vite.renderer.config.ts ├── vite.renderer.config.ts
    ├── eslint.config.js        ├── eslint.config.js
    ├── README.md               ├── README.md
    ├── public/                 ├── public/
    └── src/                    └── src/
```

## Steps

1. Move `glaze-app/*` → `glaze/` root
2. Move `glaze/tasks/` → `.claude/tasks/`
3. Move `glaze/migration-plan.md` → `.claude/migration-plan.md`
4. Move `glaze/*.png` → `.claude/assets/`
5. Delete empty `glaze-app/` directory
6. No path changes needed — relative paths remain the same
7. Update `.gitignore`
8. Commit

## Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm start`
