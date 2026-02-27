<div align="center">
  <h1>🧠 Synapse</h1>
  <p><strong>A Local AI Automation Studio</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Tauri-02569B?logo=tauri&logoColor=white&style=for-the-badge" alt="Tauri" />
    <img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white&style=for-the-badge" alt="Rust" />
    <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black&style=for-the-badge" alt="React" />
    <img src="https://img.shields.io/badge/Status-In_Development-success?style=for-the-badge" alt="Status" />
  </p>
</div>

---

## 🚀 Introduction

> **Synapse is a privacy-first, resource-efficient local AI automation studio.**

Built from the ground up to handle intense AI workloads without compromising your system's performance, Synapse is the ideal desktop companion for AI-driven automation.

Unlike Electron-based alternatives, Synapse leverages the power of **Tauri and Rust** to deliver a lightweight experience:
- 💾 **Tiny footprint:** ~10 MB disk space.
- ⚡ **Ultra-efficient:** Just 30–50 MB RAM in idle state.
- 🔒 **Local & Private:** Everything runs on your machine.

---

## 🛠 Tech Stack

Synapse is built with a meticulously chosen modern tech stack designed for performance, aesthetic excellence, and developer experience.

| Technology | Role |
| :--- | :--- |
| <img src="https://img.shields.io/badge/Tauri-02569B?logo=tauri&logoColor=white&style=flat-square" alt="Tauri"> | **Tauri 2.x:** Lightweight desktop shell |
| <img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white&style=flat-square" alt="Rust"> | **Rust:** High-performance backend orchestrator |
| <img src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black&style=flat-square" alt="React 19"> | **React 19 & Vite:** Fast, modern frontend |
| <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwind-css&logoColor=white&style=flat-square" alt="Tailwind CSS"> | **Tailwind CSS v4:** Utility-first styling |
| <img src="https://img.shields.io/badge/React_Flow_v12-FF0072?logo=react&logoColor=white&style=flat-square" alt="React Flow"> | **React Flow v12:** Best-in-class node editor |
| <img src="https://img.shields.io/badge/LanceDB-4B0082?logo=database&logoColor=white&style=flat-square" alt="LanceDB"> | **LanceDB:** True embedded vector database |
| <img src="https://img.shields.io/badge/llama.cpp-000000?logo=c%2B%2B&logoColor=white&style=flat-square" alt="llama.cpp"> | **llama.cpp:** Accelerated local LLM inference |

---

## ✨ Features & Roadmap

Synapse offers a comprehensive suite of tools for local AI workflows:

### 🧩 Node Editor
Build complex automation workflows visually using our state-of-the-art, React Flow-powered canvas. Connect logic, models, and data streams seamlessly.

### 📂 Filesystem Automation
React instantly to changes in your workspace. Our Rust-native filesystem watcher triggers workflows automatically based on file events.

### ⌨️ Command Overlay
A lightning-fast, global command palette (powered by cmdk). Access your AI tools and execute workflows instantly from anywhere on your system.

### 🧠 Local RAG (Second Brain)
Chat with your documents securely. By combining LanceDB and embedded models, Synapse creates a deeply integrated semantic search index right on your hard drive.

---

## 🏗 Architecture

The backend orchestration meets modern frontend design through a robust IPC bridge:

```text
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

---

## 💻 Getting Started

Get Synapse up and running on your local machine in seconds.

### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- OS-specific Tauri dependencies (see [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/synapse.git
   cd synapse
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run tauri:dev
   ```
   This command starts the Vite frontend and the Rust backend, opening the Synapse application window.
