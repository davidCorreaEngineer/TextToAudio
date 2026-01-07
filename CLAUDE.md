# CLAUDE.md

## I. PROJECT CONTEXT

### What This Is
- **Project**: TextToAudio - Web application for text-to-speech conversion
- **Tech Stack**: Node.js, Express, Google Cloud Text-to-Speech API, vanilla JS frontend
- **Architecture**: Modular monolith with extracted middleware, services, and utilities

### Key Files
```
app_server.js             # Entry point (Express server)
src/
├── utils.js              # Shared utilities (100% tested)
├── middleware/
│   ├── auth.js           # Authentication middleware
│   ├── rateLimit.js      # Rate limiting
│   ├── cors.js           # CORS configuration
│   └── errorHandler.js   # Error handling (98.5% tested)
└── services/
    └── ttsService.js     # Google Cloud TTS integration
public/
├── index.html            # Frontend UI
└── app_client.js         # Client-side logic
```

### Verification Commands (CRITICAL)
```bash
# Run these to verify changes work
npm test                    # Unit + integration tests
npm run test:coverage       # Coverage report
npm run test:unit           # Unit tests only
npm run test:integration    # API endpoint tests
npm run test:security       # Auth, rate limiting, error sanitization
npm run test:e2e            # Full workflow verification

# Single test for speed during iteration
npm test -- --grep "TestName"
```

> **Why this matters**: Claude with verification commands produces 2-3x better results. Always run tests after changes.

---

## II. WORKFLOW

### The Pattern: Explore → Plan → Execute → Verify

```
1. EXPLORE: Read relevant files first. Say "do NOT code yet" for complex tasks.
2. PLAN: Shift+Tab ×2 for plan mode. Iterate until plan is solid.
3. EXECUTE: Implement in small increments (≤50 lines). Auto-accept when plan is good.
4. VERIFY: Run tests/build after EVERY change. Fix failures before moving on.
```

### Planning Triggers

```
REQUIRE plan mode when:
  - Task modifies >3 files
  - Adding new feature
  - Complex debugging / root cause analysis
  - Architectural changes

In plan mode:
  - List affected files
  - Identify edge cases upfront
  - Ask: "What questions can I answer to clarify this further?"
  - WAIT for explicit approval
```

### Thinking Triggers (Use Deliberately)

| Trigger | When to Use |
|---------|-------------|
| `think` | Standard reasoning, simple refactors |
| `think hard` | Multi-file changes, subtle bugs |
| `think harder` | Architectural decisions, complex debugging |
| `ultrathink` | Security issues, performance optimization, critical paths |

### Context Management

- **Between tasks**: `/clear` to reset working memory
- **Resume work**: `/resume` to continue previous session
- **Long sessions**: Watch for context degradation; `/compact` if needed

---

## III. QUALITY ASSURANCE

### Test-Driven Development (Strict)

```
For ANY new feature or bug fix:
1. Write failing test FIRST
2. Include: edge cases, null inputs, error conditions
3. Implement minimum code to pass
4. Refactor while green
5. Run full test suite before commit
```

**Legacy Code Exception**:
- Document testing debt in commit message
- Add tests when touching code for bug fixes
- New features MUST have tests from day 1

### Self-Review Checklist

Before marking ANY task complete:

```
□ Tests pass? (run them, don't assume)
□ Null/empty input handling?
□ Edge cases covered?
□ Resource leaks (streams, connections)?
□ Thread safety (if concurrent)?
□ Security implications reviewed?
```

### End-of-Session Verification

Before ending any session, run:
```
"Review all changes made this session. Verify:
1. Tests pass
2. No security vulnerabilities introduced
3. Code follows project conventions
4. No debugging artifacts left behind"
```

---

## IV. CODE STANDARDS

### Naming (Non-Negotiable)

```
❌ NEVER: int t; void proc(); UserMgr mgr;
✅ ALWAYS: int timeoutSeconds; void processRequest(); UserManager manager;
```

### Simplicity

- **NO** abstractions unless explicitly requested
- **NO** utility functions "for future use"
- **NO** premature optimization
- The simplest solution that works IS the correct solution

### When Uncertain

```
If not 100% certain about any claim or change:
1. State "I'm not certain about [X]" BEFORE that assertion
2. Search docs or codebase for evidence
3. Ask for clarification if still unclear
4. NEVER guess on security-related code
```

---

## V. VERSION CONTROL

### Commits

```
Format: type(scope): concise description

Types: feat | fix | refactor | test | docs | chore

Examples:
  feat(auth): add jwt validation
  fix(api): handle null response body
  test(utils): add edge case coverage
```

### Branch Strategy (Solo)

```
✅ Review `git diff` before every push to main
✅ Complex features: branch + self-review after 24hr
✅ Hotfixes: commit to main with clear explanation
⛔ Never push broken/untested code to main
```

### Session End Protocol

```
1. Run full test suite
2. Commit all meaningful changes
3. Document in commit: done / pending / blockers
4. Push to remote
5. Note any TODO items for next session
```

---

## VI. SLASH COMMANDS

### Available (Create in .claude/commands/)

| Command | Purpose |
|---------|---------|
| `/commit` | Stage, commit with conventional message, push |
| `/review` | Self-review current branch changes |
| `/test` | Run relevant tests for changed files |
| `/verify` | Full verification: lint + test + build |

### Creating New Commands

When you do something 3+ times, make it a command:
```bash
mkdir -p .claude/commands
# Create markdown file with embedded bash via backticks
```

---

## VII. EXCEPTIONS & PRAGMATISM

### When Rules Conflict With Reality

```
If a rule cannot be followed:
1. State which rule and why
2. Document in commit message
3. Add TODO for technical debt

Examples:
- "fix(urgent): patch XSS - tests deferred to PR #123"
- "feat(mvp): inline logic for demo - refactor next sprint"
```

### Velocity vs. Quality Tradeoffs

```
PROTOTYPE/SPIKE: Skip tests, document as throwaway
MVP: Core paths tested, edge cases documented as TODO
PRODUCTION: Full test coverage, no exceptions
```

---

## VIII. LEARNED PATTERNS

> Add patterns here when errors are corrected. Format: AVOID → PREFER → REASON

**AVOID**: Testing by extracting/copying functions into test files
**PREFER**: Extract utilities to separate modules, import and test
**REASON**: Real coverage metrics, single source of truth, catches import bugs

**AVOID**: Setting coverage thresholds on untested monoliths
**PREFER**: Refactor → Test → Set threshold (or per-module thresholds)
**REASON**: 0% on 5000-line files is demotivating, provides no value

**AVOID**: Long implementation runs without verification
**PREFER**: Implement small chunk → run tests → iterate
**REASON**: Errors compound; early detection saves time

**AVOID**: Vague plans like "improve the code"
**PREFER**: Specific scope: "Extract DB logic from UserService to repository class"
**REASON**: Clear objectives produce verifiable results

---

## IX. META

### Document Rules
- Keep under 300 lines
- Every rule must be universally applicable to this project
- Update "Learned Patterns" when errors are corrected

### When to Update This File
- After recurring mistakes (add to Learned Patterns)
- When verification commands change
- When team conventions evolve
- After PR feedback reveals gaps

---

## X. CURRENT STATUS

**Test Coverage**: 99% overall
- src/utils.js: 100%
- src/middleware/: 98.5%
- 7 test suites, 243 tests passing

**Architecture**: Modular (utilities and middleware extracted)

---

*Verify everything. Document learnings. Ship with confidence.*
