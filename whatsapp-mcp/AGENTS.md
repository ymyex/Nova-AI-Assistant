# Repository Guidelines

## Project Structure & Module Organization
The repository is split into two cooperating services. `whatsapp-bridge/` hosts the Go WhatsApp bridge (`main.go`) and its persistent SQLite store under `store/`. `whatsapp-mcp-server/` contains the Python MCP server (`main.py`, `whatsapp.py`, `audio.py`) alongside `pyproject.toml` and the `uv.lock` dependency lockfile. Media assets used in docs live at the repository root (for example `example-use.png`). Exclude generated binaries such as `main.exe` from commits.

## Build, Test, and Development Commands
Run the bridge locally with `go run ./main.go` from `whatsapp-bridge/`; it emits QR-auth prompts on first launch. Build a reusable binary via `go build -o bin/bridge ./` and commit only the source. Launch the MCP server with `uv run main.py` inside `whatsapp-mcp-server/`; this uses the locked dependencies in `uv.lock`.

## Coding Style & Naming Conventions
Format Go code with `go fmt ./...` (required before review). Follow idiomatic Go naming: packages lowercase, exported symbols in PascalCase, internal helpers camelCase. Python files target 3.11+, prefer type hints, snake_case functions, and descriptive module-level constants.

## Testing Guidelines
Add Go unit tests in files ending `_test.go` next to the code they cover; run them with `go test ./...`. For Python contributions, create a `tests/` package and execute with `uv run pytest`; include fixtures that stub the bridge where necessary. Document manual test steps in PR descriptions when touching authentication or media handling flows until automated coverage is in place.

## Commit & Pull Request Guidelines
Git history follows Conventional Commit prefixes (`chore:`, `refactor:`, etc.); match that style and keep subjects under 72 characters. Squash speculative fixes before raising a PR and ensure each commit builds independently. PRs should link the motivating issue (or explain context), summarize user-facing impact, list test commands executed, and attach screenshots for UI or media-flow changes. Request reviews from maintainers of the touched component (Go bridge vs Python server) to keep context aligned.

## Security & Data Handling
Bridge databases under `whatsapp-bridge/store/` contain personal metadata; never commit them and cleanse samples before sharing logs. When debugging, prefer redacting identifiers over deleting entire traces so reviewers can follow the sequence. Rotate QR sessions if you suspect leakage, and document any required environment variables or API tokens in `README.md` without embedding secrets in code.
