# Building Synapse: a local AI automation studio

**Synapse is best built with Tauri 2.x (Rust) + React Flow + llama.cpp server + LanceDB — a stack that delivers a ~10 MB installer, 30–50 MB idle memory, and full GPU-accelerated local AI in a privacy-first desktop app.** This combination beats Electron on resource efficiency (critical when llama.cpp consumes 5–10 GB VRAM alongside the app), provides native filesystem access and global hotkeys through Tauri's plugin ecosystem, and leverages the richest node-editor ecosystem available through React Flow v12. The architecture splits into a Rust core for orchestration, process management, and workflow execution, with a Python sidecar handling AI/ML tasks where Python's ecosystem is irreplaceable.

---

## The recommended tech stack and why each piece wins

| Layer | Choice | Version | Reasoning |
|-------|--------|---------|-----------|
| Desktop shell | **Tauri** | v2.10.x | ~10 MB bundle, 30 MB RAM idle, native Rust backend, global hotkeys, sidecar support |
| Backend | **Rust** (+ Python sidecar) | Rust 1.77+ | Performance, memory safety, native Tauri integration; Python for AI/ML ecosystem |
| Frontend | **React** (via Vite) | React 19 | Best node-editor ecosystem, massive component libraries, proven in desktop apps |
| Node editor | **React Flow** | v12.8 (`@xyflow/react`) | MIT license, 25K stars, custom React nodes, shadcn integration, performance-optimized |
| Styling | **Tailwind CSS + shadcn/ui** | Tailwind v4 | React Flow's official UI components use this exact stack; "ChatGPT white" aesthetic out of the box |
| State management | **Zustand** | v5.x | Used by React Flow's own workflow templates, lightweight, perfect for graph state |
| Vector DB | **LanceDB** | Latest OSS | True embedded (no server), Rust core, Python/TS/Rust bindings, disk-based with memory mapping |
| Embedding | **FastEmbed** (ONNX Runtime) | Latest | Lightweight (~50 MB vs ~2 GB PyTorch), ships quantized models, CPU-optimized |
| LLM inference | **llama.cpp server** | Latest | OpenAI-compatible API, CUDA-optimized, function calling, spawned as managed sidecar |
| Filesystem watching | **notify** crate | v8.2.0 | Rust-native, used by Deno/Zed/rust-analyzer, FSEvents/inotify/ReadDirectoryChangesW backends |
| Command palette | **cmdk** (via shadcn/ui) | Latest | Headless, ~3 KB, used by Linear/Vercel, composable pages for nested navigation |
| Database | **SQLite** via rusqlite | Latest | Single file, zero config, workflow definitions + execution logs + settings |
| Async runtime | **Tokio** | v1.x | De facto Rust async standard, work-stealing scheduler, powers Tauri internally |

**Why Tauri over Electron:** Synapse runs alongside llama.cpp, which consumes **5–10 GB RAM** for model inference. Electron's baseline of 200–300 MB idle memory is wasteful; Tauri's 30–50 MB leaves more headroom for AI workloads. Tauri also provides first-class sidecar process management (`tauri-plugin-shell`), global shortcuts (`tauri-plugin-global-shortcut`), and a capability-based security model ideal for an app that spawns processes and accesses the filesystem. The only trade-off is Rust's learning curve — but since this project already demands systems-level work (process management, GPU coordination, filesystem watching), Rust pays dividends.

**Why not Wails:** No system-wide global shortcuts (dealbreaker for the Ctrl+Space overlay) and no built-in auto-updater. Wails v3 remains in alpha.

**Why React over Svelte:** React Flow's ecosystem is unmatched. The xyflow team launched "React Flow UI" — pre-built shadcn/ui components (BaseNode, LabeledHandle, AnimatedEdge, NodeSearch, ZoomSlider) purpose-built for workflow editors. Svelte Flow exists but has a smaller community, no equivalent component library, and the team acknowledges slower development pace. SolidJS has no viable node-editor library at all.

---

## Architecture overview: how the components connect

```
┌─────────────────────────────── FRONTEND (Tauri WebView) ───────────────────────────────┐
│                                                                                         │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │  Node Editor         │  │ Command Overlay   │  │  Settings / Logs / Dashboard    │   │
│  │  (React Flow v12)    │  │ (cmdk + shadcn)   │  │  (shadcn/ui components)         │   │
│  └──────────┬──────────┘  └────────┬─────────┘  └───────────────┬──────────────────┘   │
│             └──────────────────────┴─────────────────────────────┘                       │
│                                        │                                                 │
│                            Zustand (graph state, UI state)                               │
│                                        │                                                 │
└────────────────────────────────────────┼─────────────────────────────────────────────────┘
                                         │ Tauri IPC (invoke / events)
┌────────────────────────────────────────┼──────────────────────────── RUST BACKEND ───────┐
│                                        │                                                 │
│  ┌─────────────────────────────────────┴──────────────────────────────────────────────┐  │
│  │                         Command Router / Tauri Commands                             │  │
│  └──┬──────────┬──────────────┬──────────────┬───────────────┬───────────────┬────────┘  │
│     │          │              │              │               │               │            │
│  ┌──┴───┐  ┌──┴──────┐  ┌───┴────┐  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴────────┐   │
│  │Workfl.│  │Process  │  │File    │  │Plugin     │  │Credential │  │Trigger       │   │
│  │Engine │  │Manager  │  │Indexer │  │Registry   │  │Manager    │  │Manager       │   │
│  │(DAG)  │  │(Tokio)  │  │(notify)│  │           │  │(keyring)  │  │(cron/fs/api) │   │
│  └──┬───┘  └──┬──────┘  └───┬────┘  └───────────┘  └───────────┘  └──────────────┘   │
│     │         │              │                                                          │
│  ┌──┴─────────┴──────────────┴───────────────────────────────────────────────────────┐  │
│  │  Storage: SQLite (rusqlite) — workflows, logs, settings, file index               │  │
│  │  Vector:  LanceDB (embedded) — semantic search index                              │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  ┌────────────────── Managed Sidecar Processes ──────────────────────────────────────┐  │
│  │  llama-server (CUDA)  │  Python sidecar (FastAPI)  │  Embedding worker (ONNX)    │  │
│  │  Port 8080            │  Port 8081                  │  (in Python sidecar)        │  │
│  └───────────────────────┴────────────────────────────┴─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

The frontend communicates with the Rust backend through two Tauri IPC mechanisms: **commands** (request-response for CRUD operations like saving workflows) and **events** (pub-sub for real-time streaming like token generation progress and workflow execution updates). The Rust backend manages all sidecar processes — llama-server for LLM inference, a Python FastAPI sidecar for AI/ML tasks requiring Python's ecosystem (document parsing, embedding generation via FastEmbed), and filesystem watchers via the `notify` crate. SQLite stores structured data (workflow definitions as JSON DAGs, execution logs, settings), while LanceDB handles vector embeddings for the local RAG "second brain" capability.

---

## Phase 1 (MVP): core shell and basic workflows — weeks 1–4

The MVP should deliver a working desktop app with a node editor, manual workflow execution, and basic LLM integration. This validates the core architecture before investing in advanced features.

**Week 1–2: Tauri + React + React Flow scaffold.** Initialize a Tauri 2.x project with React (Vite) frontend. Install `@xyflow/react` v12 and set up a basic node editor with three built-in node types: a Text Input node, a "Run LLM Prompt" node, and a Text Output node. Configure Tailwind CSS v4 with shadcn/ui for the design system. Set up Zustand for state management following React Flow's recommended patterns. Implement workflow serialization — nodes and edges are plain JavaScript objects, trivially serialized to JSON. Store workflows in SQLite via `rusqlite` on the Rust side, exposed through Tauri commands (`save_workflow`, `load_workflow`, `list_workflows`).

**Week 2–3: llama.cpp integration.** Bundle `llama-server` as a Tauri sidecar binary using the `externalBin` configuration with platform-specific target-triple suffixes. Implement process lifecycle management in Rust: spawn on demand, health-check via `GET /health`, graceful shutdown on app close. The optimal server configuration for an **RTX 4070 (12 GB VRAM)** is:

```bash
llama-server -m model-Q4_K_M.gguf -ngl 99 -c 8192 -np 2 -fa \
  --cache-type-k q8_0 --cache-type-v q8_0 --jinja \
  --host 127.0.0.1 --port 8080
```

**Q4_K_M quantization** is the sweet spot for 12 GB VRAM — a Llama 3.1 8B model uses ~4.9 GB (leaving headroom for KV cache and the app), generating ~68 tokens/second. Qwen 2.5 14B at Q4_K_M fits tightly at ~9.3 GB with ~42 tok/s. Flash attention (`-fa`) reduces memory bandwidth requirements through tiling and kernel fusion. KV cache quantization (`q8_0`) extends achievable context windows to **16K–32K tokens** for 8B models. Always use CUDA backend on NVIDIA hardware — Vulkan is slower and has known stability issues on NVIDIA GPUs.

**Week 3–4: Workflow execution engine.** Build a DAG execution engine in Rust. Each node type implements a `NodeExecutor` trait with `execute()`, `input_types()`, and `output_types()` methods. The engine performs topological sort on the workflow graph, executes nodes sequentially (parallel branches via `tokio::spawn`), and streams progress events to the frontend via Tauri's event system. Implement five initial node types: Read File, Run LLM Prompt, Save to Disk, Text Transform, and a manual Trigger. Data flows between nodes as a standardized `NodeData` enum (text, binary, JSON object).

**Critical MVP pitfall to avoid:** Don't build a plugin system yet. Hardcode node types in Rust for Phase 1. Extensibility adds weeks of complexity with minimal user value at the MVP stage.

---

## Phase 2: filesystem automation and command overlay — weeks 5–8

**Filesystem watching** transforms Synapse from a manual tool into an automation engine. The Rust `notify` crate v8.2.0 is the clear choice — it powers Deno, Zed, and rust-analyzer, uses native OS backends (FSEvents on macOS, inotify on Linux, ReadDirectoryChangesW on Windows), and consumes near-zero CPU when idle. The critical implementation pattern for Synapse's "new PDF in Downloads" scenario involves **debouncing** and **write-completion detection**:

1. Detect file creation event via `notify`
2. Filter by extension/pattern (ignore `.tmp`, `.crdownload`, `.part` files from in-progress downloads)
3. Poll file size every 500ms until stable for 2 seconds (write-completion)
4. Only then trigger the workflow

On Linux, tune `fs.inotify.max_user_watches` to **524288+** (default 124K can be exhausted when watching many directories). On all platforms, treat file renames as delete + create pairs for consistency — inotify's rename event matching is inherently racy according to the Linux man page itself.

**The global command overlay** requires a second Tauri window configured as transparent, frameless, always-on-top, and hidden by default:

```json
{
  "label": "overlay",
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "width": 680,
  "height": 420,
  "center": true,
  "visible": false,
  "skipTaskbar": true
}
```

Register `Ctrl+Space` via `tauri-plugin-global-shortcut` to toggle visibility. On macOS, set `macOSPrivateApi: true` for full transparency support. The UI inside the overlay uses **cmdk** (by pacocoursey, ~3 KB gzipped) — the same library powering Linear's and Vercel's command palettes — integrated through shadcn/ui's `Command` component. cmdk's composable pages feature enables a natural flow: user types → fuzzy-search filters workflows → selection reveals parameters → execute.

**Platform-specific caveat:** On Wayland (Linux), global shortcuts are restricted by protocol design. Implement a fallback: system tray click or in-app-only shortcut. On macOS, the overlay won't perfectly replicate Spotlight's focus behavior (where the previous app retains focus) — track the previously focused window and restore focus after overlay dismissal using platform-specific APIs.

---

## Phase 3: local RAG and the "second brain" — weeks 9–12

The local RAG system makes Synapse's AI "remember" what's on the user's machine. This is the most architecturally complex feature, requiring background indexing, vector search, and intelligent retrieval.

**LanceDB is the optimal vector database** for this use case. Unlike ChromaDB (whose JavaScript client requires a running server, disqualifying it for truly embedded desktop use) or sqlite-vec (no ANN index yet — brute-force O(n) scans become slow beyond 500K vectors), LanceDB runs fully embedded in-process, works from disk via memory mapping (low RAM footprint), and handles **millions of vectors with <10 ms query latency** on NVMe SSDs. It's battle-tested in desktop apps — AnythingLLM and Continue.dev's IDE extension both use LanceDB for local-first semantic search. It provides native hybrid search (vector + full-text via Tantivy) with built-in cross-encoder reranking, eliminating the need for separate BM25 infrastructure.

**For embedding generation, use FastEmbed (by Qdrant) with nomic-embed-text-v1.5**, truncated to **384 dimensions** via Matryoshka Representation Learning. FastEmbed uses ONNX Runtime (~50 MB total dependencies vs ~2 GB for PyTorch), ships quantized models, and doesn't require a GPU — crucial since the GPU is reserved for llama.cpp inference. On CPU, nomic-embed-text generates embeddings at **~15–30 ms per chunk**, which is more than adequate for background indexing. Reserve GPU embedding (via CUDA ExecutionProvider) for real-time query embedding where latency matters.

The background indexing pipeline runs in the Python sidecar:

1. **Filesystem watcher** (Rust `notify`) detects new/modified files → queues changes
2. **Content hash check** (SHA-256) against SQLite metadata table — skip unchanged files
3. **Text extraction**: PyMuPDF for PDFs, python-docx for Word, tree-sitter for code, plain text for markdown
4. **Structure-aware chunking**: Split by headings/sections (not fixed-length), **512–1000 token chunks** with 10–20% overlap
5. **Embedding**: FastEmbed batch-encodes chunks on CPU (2 threads to avoid hogging resources)
6. **Storage**: Upsert into LanceDB with metadata (file path, chunk position, content hash, file type)
7. **Rate limiting**: Pause indexing when system CPU exceeds 70%; process in batches of 50–100 documents

**Retrieval at query time** follows a hybrid pipeline: embed the query → LanceDB hybrid search (vector + BM25) → Reciprocal Rank Fusion → cross-encoder reranking (ms-marco-MiniLM-L-6-v2, ~5 ms per pair on top-20 candidates) → top-5 chunks injected into LLM context.

---

## Phase 4: advanced AI features and polish — weeks 13–16

**Function calling / tool use** is what transforms Synapse from a prompt-and-response tool into an agent framework. llama.cpp's server supports native OpenAI-compatible function calling when launched with the `--jinja` flag. The server automatically generates GBNF grammars to constrain model output to valid tool calls. **Qwen 2.5 7B/14B Instruct** models have the strongest tool-calling support on 12 GB VRAM, handling parallel tool calls reliably. The agent loop pattern: send messages with `tools` definitions → parse `tool_calls` from response → execute locally → send results as `tool` role messages → loop until the model responds without tool calls.

**Structured output** via JSON Schema-to-GBNF conversion is essential for reliable data extraction in automation workflows (e.g., extracting invoice amounts and dates). Use `response_format: {"type": "json_object", "schema": {...}}` in API requests — llama-server converts this to GBNF grammar at the token-sampling level, guaranteeing valid JSON output.

**Model management** should organize GGUF files under `~/.synapse/models/` with subdirectories by purpose (chat, code, embedding). For model switching, restart `llama-server` with the new model path — the process restart takes 2–5 seconds for a 7B model, which is acceptable for user-initiated switches. llama.cpp's newer router mode (`--models-dir`) can manage multiple models automatically but is less battle-tested.

This phase also adds more node types: Fetch Webpage (with HTML-to-text extraction), Create Image (via Stable Diffusion integration), Send Email (SMTP), Run Shell Command (sandboxed), HTTP Request, JSON Transform, Conditional Branch, and Loop constructs.

---

## The node editor demands careful performance engineering

React Flow v12 handles **100+ nodes** well when custom nodes are properly memoized with `React.memo()`. The xyflow team collaborated with performance consultant Ivan Akulov to implement batched store updates and selective re-rendering — only changed nodes re-render. However, three patterns cause performance degradation that must be actively avoided:

- **Unmemoized custom nodes**: Every edge update triggers a cascade of node re-renders. Wrap all custom node components in `React.memo()` and use `useNodesData()` for selective data access.
- **Complex inline node UIs**: Rich node interiors (forms, progress bars, previews) should use controlled viewport virtualization — only render full node UIs for nodes currently visible on canvas.
- **Edge overdraw**: With 200+ visible edges, SVG rendering becomes a bottleneck. Use React Flow's `edgesFocusable={false}` and `edgesUpdatable={false}` when not in editing mode, and consider `pathfinding` edge type only for visible connections.

React Flow provides built-in `<MiniMap />`, `<Controls />`, and `<Background />` components. The serialization model is trivially simple — nodes and edges are plain JavaScript objects that `JSON.stringify()` directly to the workflow definition stored in SQLite. Undo/redo isn't built in but is easily implemented with Zustand middleware (the `zustand/middleware` `temporal` pattern or a custom history stack).

---

## Security requires defense in depth, not a single wall

Synapse executes user-defined workflows that access the filesystem, spawn processes, and make network requests. The n8n CVE-2025-68613 (CVSS 9.9 — expression injection escaping the sandbox to achieve RCE) is a cautionary tale.

**Four layers of protection:**

- **Tauri's capability system**: Each window and plugin gets a capability file defining allowed operations. Restrict filesystem access to user-configured directories via Tauri's scope system. The IPC isolation pattern ensures the webview cannot directly access system resources.
- **Process isolation for node execution**: Execute untrusted nodes (Shell Command, custom scripts) in separate child processes with restricted permissions. On Linux, use `bubblewrap` namespaces; on macOS, use `sandbox-exec` seatbelt profiles.
- **Credential separation**: Never store API keys in workflow JSON. Use `keyring-rs` for cross-platform OS keyring access (macOS Keychain, Windows Credential Manager, GNOME Keyring). Reference credentials by ID in workflows, resolve at execution time. Fall back to Tauri's `Stronghold` plugin (AES-256 encrypted vault) when system keyring is unavailable.
- **LLM process isolation**: llama-server runs as a sidecar bound to **127.0.0.1 only**, communicating via HTTP. A crash in inference doesn't crash the app. Use health checks (`GET /health`) to detect and auto-restart crashed processes.

**Never use `vm2`** for JavaScript sandboxing in custom code nodes — it has had repeated sandbox-escape CVEs through early 2026. Use `isolated-vm` (V8 isolates) or WASM-based sandboxing instead.

---

## RTX 4070 performance budget shapes model choices

The **12 GB VRAM** constraint is the binding resource. Here's how to allocate it:

| Component | VRAM usage | Notes |
|-----------|-----------|-------|
| Llama 3.1 8B (Q4_K_M) | ~4.9 GB | ~68 tok/s, leaves room for 16K context |
| Qwen 2.5 14B (Q4_K_M) | ~9.3 GB | ~42 tok/s, tight — only ~4K context with f16 KV |
| KV cache (8K ctx, q8_0) | ~0.5–1.5 GB | Scales with context length |
| Embedding model (ONNX, CPU) | 0 GB | Runs on CPU via FastEmbed, no GPU needed |
| CUDA overhead | ~0.3 GB | Driver/runtime allocation |

**The practical sweet spot is an 8B model at Q4_K_M with q8_0 KV cache** — this provides 16K–32K context window, ~68 tokens/second generation, and ~2 GB headroom for safety. For users needing stronger reasoning, Qwen 2.5 14B Q4_K_M fits but limits context to ~4K–8K tokens. Avoid Q3_K_M and below — quality degrades severely. Q5_K_M offers diminishing returns for ~20% more VRAM.

Running embeddings on CPU (not GPU) is deliberate: FastEmbed with nomic-embed-text-v1.5 processes ~30–65 embeddings/second on CPU, which is sufficient for background indexing, and keeps the GPU entirely free for interactive LLM inference.

---

## Potential pitfalls and how to sidestep them

**Tauri's WebKitGTK inconsistencies on Linux** cause CSS rendering differences from Chromium. Test on Ubuntu (WebKitGTK via apt), Fedora, and Arch early. Some CSS features (backdrop-filter, certain animation properties) behave differently. Use progressive enhancement and avoid relying on Chromium-specific behaviors.

**Python sidecar packaging** is the trickiest integration point. PyInstaller's `--onefile` mode creates a bootloader process whose PID differs from the actual Python process — Tauri can only kill the bootloader, potentially orphaning the Python process. **Mitigation:** Have the Python process check `os.getppid()` periodically and self-terminate if the parent is gone, or use `--onedir` mode instead of `--onefile` for more predictable process management.

**inotify watch limits** on Linux silently fail when exhausted. On first launch, check `cat /proc/sys/fs/inotify/max_user_watches` and guide the user to increase it to 524288 if needed (e.g., `echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches`).

**LanceDB's IVF-PQ index** must be explicitly created after initial data ingestion — it doesn't auto-create like HNSW in other databases. Build the index once the collection exceeds ~10K vectors, and rebuild periodically as data grows.

**React Flow's MIT license** is genuinely free for commercial use. The "React Flow Pro" subscription ($129–$249/month) only provides access to premium example templates and priority support — all library features are free.

---

## Conclusion

Synapse's architecture achieves the rare combination of **local-first privacy, GPU-accelerated AI, and visual programming** by treating the desktop app as an orchestration layer rather than a monolith. The Rust core handles what Rust does best — process management, filesystem watching, concurrent workflow execution — while Python handles what Python does best — ML inference, document parsing, embedding generation. The two communicate over localhost HTTP, maintaining process isolation that prevents an LLM crash from taking down the app.

The most important architectural insight is that **llama.cpp's server mode is the right integration pattern**, not direct library bindings. The HTTP API provides language-agnostic access, concurrent request handling, crash isolation, and model hot-swapping — benefits that outweigh the ~1ms latency overhead of localhost HTTP. Pair this with LanceDB's embedded vector search (the only vector DB with production-quality bindings in Python, TypeScript, and Rust simultaneously) and React Flow's React-component-as-node model (enabling rich interactive UIs inside each workflow node), and you have a stack where every piece was purpose-built for exactly this class of application.

Start with Phase 1's five-node MVP. If the workflow engine can execute "Read File → Run LLM Prompt → Save to Disk" reliably, everything else is extension.