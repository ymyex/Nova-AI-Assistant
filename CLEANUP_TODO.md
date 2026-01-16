# Codebase Cleanup TODO

This document tracks remaining cleanup tasks for the Nova AI Assistant codebase.

## Low Priority

### 11. Test Coverage
No tests found in the repository:

**Missing:**
- Python unit tests (`pytest`)
- TypeScript/React tests (`vitest` or `jest`)
- Go tests (`go test`)
- Integration tests
- E2E tests (`playwright` or `cypress`)

**Suggested structure:**
```
tests/
├── python/
│   ├── test_gemini.py
│   ├── test_whatsapp.py
│   └── test_nova_service.py
├── frontend/
│   ├── components/
│   └── hooks/
└── e2e/
    └── flows/
```

---

### 12. Error Handling Audit
Review error handling patterns:

| Area | Issue |
|------|-------|
| `ConfigForm.tsx` | Some catch blocks only log, don't notify user |
| `nova_service.py` | Exception handling may swallow errors |
| `whatsapp.py` | Network errors need better recovery |

---

### 14. Performance Optimizations

| Area | Improvement |
|------|-------------|
| Frontend bundle | 560KB - consider code splitting |
| React re-renders | Add `React.memo` where needed |
| API polling | Consider WebSocket for status |
| Database queries | Add indexes if slow |

---

### 15. Documentation Gaps

| Document | Status |
|----------|--------|
| API documentation (OpenAPI/Swagger) | Missing |
| Architecture diagram (visual) | Text-only in README |
| Deployment guide | Partial |
| Contributing guide | Missing |
| Changelog | Missing |

---

## Quick Commands

```bash
# Find large files
find . -type f -size +1M -exec ls -lh {} \;

# Find TODO/FIXME comments
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.py" --include="*.ts" --include="*.tsx" --include="*.go"

# Find unused exports (requires ts-prune)
npx ts-prune frontend/src

# Find duplicate code (requires jscpd)
npx jscpd frontend/src --min-lines 10

# Check for outdated dependencies
cd frontend && npm outdated
cd ../opencode && bun outdated
pip list --outdated
```

---

*Last updated: January 16, 2026*
