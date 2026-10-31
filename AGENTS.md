# Working Agreement

## Before writing any code
- Read my request fully and check it for anything unclear, missing, or ambiguous.
- If anything is confusing, ask me questions first. Ask as many as you need.
- Do not start coding unless you are 100% confident you understand what I want. If you are not sure, ask.
- If there are multiple ways to do something, list the options with trade-offs and let me choose.
- For anything non-trivial, summarize your understanding and your plan, then wait for my go-ahead.

## Code quality
- All code must be production-ready: no placeholders, TODOs, mock data, or half-finished logic.
- Handle errors, edge cases, empty states, and invalid input properly.
- Validate inputs and never hardcode secrets, keys, or credentials.
- Follow the existing project structure, naming, and conventions.
- Write clean, readable, maintainable code. Don't leave dead code or unused imports.
- Aim for zero bugs, including minor ones. Review your own code for mistakes before presenting it.

## Testing
- After building, always run and test what you built. Don't assume it works.
- Run the app, build, linter, and type checks, and fix any errors or warnings.
- Write and run tests for the new functionality, covering normal flow, edge cases, and failure cases.
- If something fails, fix it and re-test until everything passes.
- Report what you tested and the results. If something could not be tested, say so clearly.

## Communication
- Never claim something is done or working unless you have verified it.
- If you find a problem outside the scope of my request, tell me instead of silently changing it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
