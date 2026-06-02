# Local In-Browser AI (WebGPU) Integration

This document serves as the design specification and safe development guide for integrating `@mlc-ai/web-llm` into MindSync. This feature allows highly capable, private on-device coaching using local hardware.

---

## 🚀 Proposed Architecture

To keep the MindSync user interface fluid (60fps) and prevent the browser from freezing during heavy AI model inference, we use a multi-threaded architecture:

```
┌────────────────────────────────────────────────────────┐
│                      MAIN THREAD                       │
│                                                        │
│  ┌──────────────────────┐      ┌────────────────────┐  │
│  │   AICoachScreen UI   │ ◄───►│  Zustand Store     │  │
│  └──────────┬───────────┘      │  (localAiEnabled)  │  │
│             │                  └────────────────────┘  │
└─────────────┼──────────────────────────────────────────┘
              │ (Message Passing: Event Listeners)
              ▼
┌────────────────────────────────────────────────────────┐
│                    WEB WORKER THREAD                   │
│                                                        │
│    `webllm.worker.ts`                                  │
│    - Loads WebLLM engine asynchronously                │
│    - Handles download caching & progress ticks         │
│    - Runs GPU model inference in the background        │
└────────────────────────────────────────────────────────┘
```

1. **Zustand Store (`useStore.ts`)**: Tracks whether Local AI is enabled, the status (`idle | downloading | ready | error`), download progress (0-100%), and error messages.
2. **Local AI Client (`localAiClient.ts`)**: A wrapper client in the main thread that instantiates the Web Worker and exposes a clean promise-based API similar to OpenAI (`chat.completions.create`).
3. **Web Worker (`webllm.worker.ts`)**: Isolates the `@mlc-ai/web-llm` execution context. It streams back the generated response token-by-token and broadcasts progress updates during the model download.

---

## 📂 Proposed File Changes

### New Files
1. **`docs/LOCAL_AI_IMPLEMENTATION.md`** [NEW] *(This document)*
2. **`src/lib/worker/webllm.worker.ts`** [NEW]
   - Houses the web worker script.
   - Listens for messages like `init`, `generate`, and `interrupt`.
3. **`src/lib/localAiClient.ts`** [NEW]
   - Acts as a bridge between the React frontend and the web worker.
   - Decouples the UI code from the complex Web Worker mechanics.
4. **`src/components/LocalAiTracker.tsx`** [NEW]
   - A modern, glowing progress-tracker/status pill.
   - Shows active model downloads, has a "minimize" toggle, and allows resuming/viewing the download at any time.

### Modified Files
1. **`package.json`** [MODIFY]
   - Add `@mlc-ai/web-llm` as a dependency.
2. **`src/store/useStore.ts`** [MODIFY]
   - Add state slices: `localAiEnabled: boolean`, `localAiStatus: 'idle' | 'downloading' | 'ready' | 'error'`, `localAiProgress: number`, `localAiError: string`.
3. **`src/components/SettingsTab.tsx`** (or relevant setting page) [MODIFY]
   - Add a premium glowing toggle switch: "Enable Local On-Device AI".
   - Clear warning notes that the first run requires a 2GB–4GB download (cached locally after).
4. **`src/components/AICoachScreen.tsx`** [MODIFY]
   - Intercept prompts if `localAiEnabled` is toggled.
   - If the model is **still downloading**, gracefully use the offline **Smart Logic** (deterministic coaching) so the user is never blocked.
   - If the model is **ready**, stream tokens from the local Web Worker.
   - If WebGPU is **not supported or fails**, fall back gracefully to Cloud AI (if API key is present) or Smart Logic, displaying a helpful toast notification.

---

## ⚠️ Potential Errors & Safeguards

| Error / Failure Case | Impact | Safeguard / Resolution |
| :--- | :--- | :--- |
| **WebGPU Unsupported** | Engine cannot run, browser may throw uncaught exceptions. | **Pre-check Support**: Before downloading, run a safe check for `navigator.gpu`. If undefined, disable the toggle in Settings and display: *"Your browser/device doesn't support WebGPU. Falling back to Smart Logic."* |
| **Out of Memory (OOM)** | Browser tab crashes, or Web Worker terminates abruptly. | **Smart Model Recommendations**: Recommend optimized, quantized models (e.g. `Phi-3.5-mini-instruct-q4f16_1-MLC`) which fit comfortably within 4GB of memory. Use a try/catch during worker initialization. |
| **Interrupted Download** | Model weights are partially downloaded; state is corrupted. | **Auto-Resumption**: WebLLM leverages the browser's Cache API. If a download is cut off, triggering it again will pick up right where it left off, skipping already-cached files. |
| **Local Model Formatting Issues** | Smaller models fail to produce the correct action blocks (e.g. `[ACTION: CREATE_TASK...]`). | **Strict System Prompt & Examples**: Inject an explicit, strict System Prompt in the Web Worker. Feed the model 2-3 examples of perfect action formatting so it acts as an infallible parser. |

---

## 🛡️ Git Safety Net (Your Parallel Universe Guide)

All work will be developed inside a dedicated feature branch named `feature/local-ai`. This ensures your `main` branch remains 100% stable and pristine.

### 1. To Go to Your WebGPU Branch (Code & Test)
When you want to work on or test the WebGPU features, ensure you are on this branch:
```powershell
git checkout feature/local-ai
```

### 2. To Go Back to the Original Version (Without WebGPU)
If you want to view, build, or deploy the exact version before WebGPU:
```powershell
git checkout main
```
*Note: Git will instantly update all local files on your computer to match the pre-WebGPU state.*

### 3. To Discard the WebGPU Experiment Forever
If you ever decide to delete this feature completely and clean your codebase:
```powershell
git checkout main
git branch -D feature/local-ai
```
*All WebGPU code is deleted, and your repository is left 100% unmodified.*
