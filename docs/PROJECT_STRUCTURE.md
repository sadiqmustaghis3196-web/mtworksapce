# Project structure

- `src/`: React frontend. Shared layout/navigation and task components; route pages, API service and authentication context.
- `server/`: Existing Express backend and Prisma schema; kept as the only backend root.
- `docs/`: Implementation status, route/file map, API/model references, and Roman Urdu lessons.
- `scripts/`: Development helpers. The original start_dev.sh uses macOS paths and is not portable.
- `vite.config.js`: React build and same-origin /api development proxy to port 5000.

Runtime: Node 22.12+ (current environment Node 24), PostgreSQL 16, npm lockfiles. Frontend port 8000; API port 5000.
