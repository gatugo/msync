# Step Code Setup Guide

## Installation

### 1. Install Step Code CLI
```bash
npm install -g @stepfun-ai/stepfun
```

### 2. Configure API Key
Get your API key from https://platform.stepfun.ai

```bash
# Option A: Environment variable (PowerShell)
$env:STEP_API_KEY = "your-api-key-here"

# Option B: Add to .env file in project root
echo STEP_API_KEY=your-api-key-here >> .env
```

## Using Step Code in VSCodium

### Quick Start

1. **Open VSCodium** in this project:
   ```bash
   code C:\Users\mela\.aiprojects_2\mindsync
   ```

2. **Open Terminal** (`` Ctrl+` ``)

3. **Start Step Code**:
   ```bash
   stepfun
   ```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+`` | Toggle terminal |
| `Ctrl+Shift+Enter` | Send selected code to Step Code |
| `Ctrl+Shift+B` → "Step Code: Agent Mode" | Launch Step Code in dedicated panel |

### Workflow

**Typical Agent Loop:**
```
You: "Review the API route I just created"
  ↓
Step Code reads src/app/api/route.ts
  ↓
Step Code: "I see you're using Next.js 16. Consider adding input validation..."
  ↓
You: "Fix it"
  ↓
Step Code edits the file
  ↓
Step Code runs: npm run lint
  ↓
Step Code: "Fixed! Added Zod validation."
```

### Common Commands in Step Code

```bash
/help              # Show available commands
/files             # List project files
/review src/app/   # Review specific path
/run npm run lint  # Execute commands
/exit              # Quit Step Code
```

### Using Step Code with Your Code

1. **Select code** in the editor
2. Press `Ctrl+Shift+Enter`
3. Step Code receives it and processes in terminal
4. It can:
   - Explain the code
   - Suggest improvements
   - Write tests
   - Refactor
   - Run commands

### Project Configuration

The `.stepcode.json` file is configured for your Next.js project:
- Model: **step-5-preview** (latest StepFun model)
- Context: TS/TSX files, package.json, tsconfig.json
- Commands: npm run lint, build, dev
- Auto-save enabled

## Troubleshooting

### Step Code not found?
```bash
# Verify installation
stepfun --version

# If not found, reinstall
npm install -g @stepfun-ai/stepfun
```

### API Key not working?
```bash
# Check if key is set
echo $env:STEP_API_KEY  # PowerShell
echo $STEP_API_KEY      # Bash/Git Bash

# Set it again if needed
$env:STEP_API_KEY = "your-key"
```

## Next Steps

1. Start Step Code: `stepfun`
2. Try: "Review my Next.js project structure"
3. Ask: "Generate tests for src/utils/helper.ts"
4. Request: "Optimize the performance of my API routes"

---

**Tip:** Keep the Step Code terminal open at all times - it maintains context and can watch files, run tests, and make changes autonomously.
