# CI/CD Quick Reference Card

## 🚀 GitHub Actions Workflows

### Main CI Pipeline
**File**: `.github/workflows/ci.yml`

| Job | Command | Purpose |
|-----|---------|---------|
| **Lint** | `npm run lint` | Code quality (ESLint, Prettier, Black, Flake8) |
| **Type Check** | `npx turbo run type-check` | TypeScript type safety |
| **Build** | `npm run build` | Compile all workspaces + schema generation |
| **Test** | `npm run test` | Run all tests |
| **Security** | `npm audit` | Vulnerability scanning |
| **Status** | - | Aggregate results & PR comment |

**Triggers**: PR to main/develop, Push to main/develop, Manual

---

## 📋 Pre-Commit Checklist

Before creating a PR:

```bash
# 1. Lint your code
npm run lint:js        # JavaScript/TypeScript
npm run lint:py        # Python
npm run lint          # All

# 2. Fix formatting
npm run format:js     # Auto-fix JS/TS
npm run format:py     # Auto-fix Python

# 3. Type check
npx turbo run type-check

# 4. Build
npm run build

# 5. Test
npm run test
```

---

## 💬 Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code refactoring
- `perf` - Performance
- `test` - Tests
- `build` - Build system
- `ci` - CI/CD
- `chore` - Other

### Examples
```bash
git commit -m "feat(auth): add Clerk authentication"
git commit -m "fix(api): resolve database timeout"
git commit -m "docs(readme): update setup guide"
```

### Breaking Changes
```bash
git commit -m "feat(api): change user schema

BREAKING CHANGE: User.name split into firstName and lastName"
```

---

## 🏷️ Auto Labels

PRs are automatically labeled based on files changed:

| Label | Files |
|-------|-------|
| `frontend` | `apps/web/**`, `apps/mobile/**` |
| `backend` | `apps/backend/**` |
| `backend:auth` | `apps/backend/services/auth/**` |
| `infra` | `infra/**`, `.github/**` |
| `infra:docker` | `**/Dockerfile`, `docker-compose.yml` |
| `infra:ci` | `.github/workflows/**` |
| `packages:schemas` | `packages/schemas/**` |
| `documentation` | `**/*.md`, `docs/**` |
| `dependencies` | `package.json`, `requirements.txt` |
| `tests` | `**/*.test.*`, `**/tests/**` |

---

## 📊 PR Size Guidelines

| Size | Lines | Icon | Action |
|------|-------|------|--------|
| Small | < 200 | 🟢 | Ideal - Quick review |
| Medium | 200-500 | 🟡 | Good - Reviewable |
| Large | 500-1000 | 🟠 | Consider splitting |
| Extra Large | > 1000 | 🔴 | Should split |

---

## ⚡ CI Performance

### Typical Run Times
- **Lint**: 1-2 minutes
- **Type Check**: 30-60 seconds
- **Build**: 2-3 minutes
- **Test**: 1-2 minutes
- **Total**: 3-5 minutes (with caching)

### Caching
- ✅ Node modules
- ✅ Python packages
- ✅ Turborepo cache
- ✅ Build artifacts

---

## 🛠️ Local Commands

### Lint & Format
```bash
# Check
npm run lint:js
npm run lint:py

# Fix
npm run format:js
npm run format:py
```

### Build
```bash
# All workspaces
npm run build

# Specific workspace
npx turbo run build --filter=@proppal/schemas

# With logs
npx turbo run build --verbose
```

### Type Check
```bash
# All
npx turbo run type-check

# Specific
cd apps/web
npx tsc --noEmit
```

### Docker
```bash
# Start
npm run docker:up

# Rebuild
npm run docker:rebuild:gateway

# Logs
npm run docker:logs

# Stop
npm run docker:down
```

---

## 🔍 Debugging CI Failures

### Lint Failed
```bash
# View errors
npm run lint

# Auto-fix
npm run format

# Commit
git add .
git commit -m "style: fix linting issues"
```

### Build Failed
```bash
# Check locally
npm run build

# Check schema
cd packages/schemas
npm run generate

# Fix and retry
```

### Type Check Failed
```bash
# Check errors
npx turbo run type-check

# Fix types
# Update tsconfig.json or fix code

# Verify
npx tsc --noEmit
```

---

## 📈 Workflow Status

### Check CI Status
1. Go to PR page
2. See "Checks" section
3. Click "Details" for logs
4. Re-run failed jobs if needed

### PR Comments
CI automatically posts:
- ✅ Pass/Fail status
- 📊 PR size analysis
- ⚠️ Breaking change alerts
- 🔗 Links to failed jobs

---

## 🚀 Deployment

### Manual Deployment
```bash
# Go to Actions tab
# Select "Deploy to Production"
# Click "Run workflow"
# Choose environment (staging/production)
# Click "Run workflow"
```

### Automatic Deployment
- **Staging**: Push to `develop`
- **Production**: Push to `production` or create Release

---

## 🎯 Best Practices

### Before Creating PR
- [ ] All tests pass locally
- [ ] Code is linted
- [ ] No type errors
- [ ] Commit messages follow format
- [ ] PR description is clear
- [ ] Breaking changes documented

### PR Title
```
feat(scope): add feature
fix(scope): resolve bug
docs(scope): update guide
```

### PR Description
```markdown
## Description
What changed and why

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Breaking change

## Testing
How to test

## Checklist
- [ ] Tests added
- [ ] Docs updated
- [ ] CI passing
```

---

## 📞 Quick Help

### Common Issues

**Q: CI failed but works locally?**
- Clear cache and re-run
- Check environment differences
- Verify dependencies match

**Q: Can't push - pre-commit hooks fail?**
- Run `npm run lint` locally
- Fix issues
- Try push again

**Q: PR too large warning?**
- Split into multiple PRs
- Group related changes
- Review one feature at a time

### Get Help
- 📚 Full docs: `.github/README.md`
- 🤝 Contributing: `CONTRIBUTING.md`
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions

---

## 🔗 Quick Links

- [Full CI/CD Docs](./.github/README.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Workflow Files](../.github/workflows/)
- [Main README](../README.md)

---

**Last Updated**: October 10, 2025  
**Owner**: Rana Bilal Akbar

