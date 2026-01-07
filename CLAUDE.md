# CLAUDE.md — TextToAudio

## Project
- Node.js/Express + Google Cloud TTS
- Entry: app_server.js
- Tests: `npm test` (expect 13 suites, 439 tests)

## Verify After Every Change
npm test                 # Must pass before commit
npm run test:coverage    # Maintain >95%

## Danger Zones (Require Explicit Approval)
- .env, credentials.json — Never commit secrets
- app_server.js — Core routing, high impact
- src/services/ttsService.js — GCP integration, billing implications
- src/services/quotaService.js — Quota tracking, billing implications

## Workflow
1. Plan mode (Shift+Tab ×2) for >3 files or new features
2. Implement ≤50 lines at a time
3. Run tests, fix failures
4. Commit with: type(scope): description

## TTS-Specific Rules
- Input text max: 5000 chars (GCP limit)
- Always validate audio format before response
- Handle GCP 429 (quota) with retry + user feedback

## Learned Patterns
[Add here when mistakes happen]

## When Uncertain
State "I'm not certain" → search docs → ask
