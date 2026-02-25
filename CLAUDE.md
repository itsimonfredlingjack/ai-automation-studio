# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Synapse** — a local-first AI automation studio. Desktop app with a visual node editor for building workflows. Architecture is ready for AI model integration but does not currently bundle any local models.

Full design spec: `BLUEPRINT-AI-STUDIO.md`

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Desktop shell | Tauri 2.x | ~10 MB bundle, Rust backend |
| Backend | Rust (Tokio) | Process management, DAG engine |
| Frontend | React 19 (Vite 7) | TypeScript |
| Node editor | React Flow v12 (`@xyflow/react`) | Custom memoized nodes |
| Styling | Tailwind CSS v4 + shadcn/ui | Neutral palette |
| State | Zustand v5 | flowStore + workflowStore |
| Database | SQLite via rusqlite (bundled) | `~/.synapse/synapse.db` |

## Build & Development

```bash
npm run tauri:dev          # Full app (Vite HMR + Rust backend)
npm run dev                # Frontend only (Vite on :1420)
npm run build              # Frontend production build

# Rust (from src-tauri/)
cargo build                # Build backend
cargo clippy               # Lint
cargo test                 # Tests
```

## Architecture

**Frontend** (Tauri WebView) → Tauri IPC → **Rust Backend**

- `src/` — React frontend: node editor, sidebar, stores
- `src-tauri/src/` — Rust backend: DB, engine, commands

### Rust Backend Structure
```
src-tauri/src/
  lib.rs           — Tauri bootstrap, command registration
  commands/        — Tauri IPC handlers (workflow CRUD + execute)
  db/              — SQLite schema + workflow persistence
  models/          — Workflow, WorkflowNode, WorkflowEdge, Position
  engine/          — DAG executor (topological sort, NodeExecutor trait)
    nodes/         — Built-in executors: text_input, text_transform, text_output
  state.rs         — AppState { db: Mutex<Connection> }
  error.rs         — AppError enum
```

### Frontend Structure
```
src/
  App.tsx                    — Layout: Sidebar + FlowEditor
  stores/                    — flowStore (React Flow state), workflowStore (CRUD)
  lib/tauri.ts               — Typed invoke() wrappers
  components/nodes/          — TextInputNode, TextTransformNode, TextOutputNode
  components/editor/         — FlowEditor (React Flow canvas), NodePalette (drag-to-add)
  components/layout/         — Sidebar (workflow list, create/save/delete)
  types/workflow.ts          — TypeScript types matching Rust models
```

## Key Patterns

- **Node types** are registered in `engine/executor.rs::NodeRegistry` (Rust) and `components/nodes/nodeTypes.ts` (React). Add new nodes in both places.
- **Workflow serialization**: React Flow nodes/edges → JSON → SQLite. The `Sidebar.tsx` handles the conversion between React Flow format and Rust model format.
- **DAG execution**: Topological sort (Kahn's algorithm) in `engine/mod.rs`, sequential node execution. Each node implements the `NodeExecutor` trait.
- **All custom React Flow nodes must be wrapped in `React.memo()`** — prevents cascade re-renders on edge updates.

## Tauri IPC Commands

| Command | Description |
|---------|-------------|
| `save_workflow` | Upsert workflow (nodes/edges as JSON) |
| `load_workflow` | Load by ID |
| `list_workflows` | List all (metadata only, sorted by updated_at) |
| `delete_workflow` | Delete by ID |
| `execute_workflow` | Run DAG engine on a saved workflow |

## Future AI Integration Points

The architecture is designed to add AI capabilities later:
- **LLM node type**: Add a node executor that calls an OpenAI-compatible API (llama.cpp server or remote)
- **Python sidecar**: Tauri supports managed sidecar processes for embedding/ML tasks
- **Vector DB**: LanceDB integration for local RAG (see blueprint Phase 3)
- **Models directory**: `~/.synapse/models/` convention from blueprint
