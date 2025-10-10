# CI/CD Pipeline Documentation

## Overview

PropPal uses GitHub Actions and Turborepo for automated code quality checks, builds, and deployments. This ensures all code contributions meet quality standards before merging.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`
- Manual dispatch

**Jobs:**

#### Lint Job
- **TypeScript/JavaScript**: ESLint + Prettier
- **Python**: Black + Flake8
- **Command**: `npm run lint`

#### Type Check Job
- **TypeScript**: Type checking across all workspaces
- **Command**: `npx turbo run type-check`

#### Build Job
- **Schema Generation**: Pydantic → TypeScript conversion
- **TypeScript Compilation**: All workspaces
- **Verification**: Ensures `models.ts` is generated
- **Command**: `npm run build`

#### Test Job
- **Unit Tests**: All workspaces
- **Integration Tests**: When available
- **Command**: `npm run test`

#### Security Audit
- **npm audit**: Check for vulnerabilities
- **audit-ci**: Known vulnerability scanning

#### Status Check
- **Summary**: Aggregates all job results
- **PR Comment**: Posts results to pull request

### 2. Deployment Pipeline (`deploy.yml`)

**Triggers:**
- Release published
- Push to `production` branch
- Manual dispatch

**Jobs:**

#### Pre-deployment Checks
- Full CI pipeline execution
- Environment validation

#### Deploy Backend
- Docker image build
- Cloud deployment (configurable)

#### Deploy Frontend
- Vercel deployment (default)
- Deployment URL in PR comment

#### Post-deployment Tests
- Smoke tests
- Health checks

### 3. PR Checks (`pr-checks.yml`)

**Features:**

#### Auto-labeling
- Labels PRs based on changed files
- Uses `.github/labeler.yml` config

#### PR Title Check
- Enforces conventional commit format
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

#### PR Size Check
- Calculates changes (+additions -deletions)
- Labels: small, medium, large, extra-large
- Warns if PR is too large

#### Breaking Changes Detection
- Scans commit messages for "BREAKING CHANGE"
- Comments on PR if found
- Reminds to update CHANGELOG and version

## Configuration Files

### `.github/labeler.yml`
Auto-labeling configuration:
- `frontend`: Web/Mobile changes
- `backend`: API/Service changes
- `infra`: Docker/CI changes
- `packages`: Shared package changes
- `documentation`: Markdown files
- `dependencies`: Package files

## Local Testing

### Test Linting Locally
```bash
# JavaScript/TypeScript
npm run lint:js

# Python
npm run lint:py

# All (Turborepo)
npm run lint
```

### Test Build Locally
```bash
# All workspaces
npm run build

# Specific workspace
npx turbo run build --filter=@proppal/schemas
```

### Test Type Checking
```bash
npx turbo run type-check
```

## CI/CD Best Practices

### 1. PR Guidelines
- ✅ Keep PRs small (< 500 lines)
- ✅ Use conventional commit format
- ✅ Add tests for new features
- ✅ Update documentation
- ✅ Pass all CI checks before requesting review

### 2. Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes

**Examples:**
```
feat(auth): add Clerk authentication integration
fix(api): resolve database connection timeout
docs(readme): update setup instructions
```

### 3. Breaking Changes
Mark breaking changes in commit message:
```
feat(api): change user schema structure

BREAKING CHANGE: User.name is now split into firstName and lastName
```

## Workflow Status Badges

Add to your README:

```markdown
[![CI](https://github.com/bilalrana8718/PropPal/actions/workflows/ci.yml/badge.svg)](https://github.com/bilalrana8718/PropPal/actions/workflows/ci.yml)
[![Deploy](https://github.com/bilalrana8718/PropPal/actions/workflows/deploy.yml/badge.svg)](https://github.com/bilalrana8718/PropPal/actions/workflows/deploy.yml)
```

## Secrets Configuration

Required GitHub Secrets:

### For Deployment
```
VERCEL_TOKEN          # Vercel deployment token
MONGODB_URL           # Production MongoDB connection string
CLERK_SECRET_KEY      # Production Clerk secret
# Add cloud provider credentials as needed
```

### Adding Secrets
1. Go to repository Settings
2. Secrets and variables → Actions
3. New repository secret
4. Add name and value

## Troubleshooting

### CI Fails on Lint
```bash
# Fix locally
npm run lint:js -- --fix
npm run format:py

# Commit fixes
git add .
git commit -m "style: fix linting issues"
git push
```

### CI Fails on Build
```bash
# Check schema generation
cd packages/schemas
npm run generate

# Check TypeScript compilation
npm run build

# Fix issues and push
```

### CI Fails on Type Check
```bash
# Run type check locally
npx turbo run type-check

# Fix type errors
# Commit and push
```

## Caching Strategy

GitHub Actions caches:
- **Node modules**: Based on `package-lock.json`
- **Python packages**: Based on `requirements.txt`
- **Turborepo cache**: Remote caching for faster builds

### Clear Cache
If you need to clear cache:
1. Go to Actions → Caches
2. Delete specific cache
3. Or add `--no-cache` flag in workflow

## Performance Optimization

### Turborepo Benefits
- ✅ **Parallel execution**: Runs tasks concurrently
- ✅ **Smart caching**: Skips unchanged workspaces
- ✅ **Dependency awareness**: Builds in correct order

### Workflow Optimization
- ✅ **Concurrency**: Cancels in-progress runs
- ✅ **Job parallelization**: Runs lint/build/test simultaneously
- ✅ **Artifact caching**: Reuses built assets

## Monitoring & Notifications

### GitHub Checks
- View status on PR page
- Click "Details" for full logs
- Re-run failed jobs if needed

### PR Comments
CI posts results directly on PRs:
- ✅ All checks passed
- ❌ Check failures with links
- 📊 PR size analysis
- ⚠️ Breaking change warnings

## Extending CI/CD

### Adding New Jobs

1. **Create workflow file**:
```yaml
# .github/workflows/custom.yml
name: Custom Workflow
on: [push]
jobs:
  custom-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Custom job"
```

2. **Add to CI pipeline**:
```yaml
# In ci.yml
custom-check:
  name: Custom Check
  runs-on: ubuntu-latest
  steps:
    - name: Run custom check
      run: npm run custom-script
```

### Adding New Labels

Edit `.github/labeler.yml`:
```yaml
'new-label':
  - path/to/files/**/*
```

## FAQ

**Q: Why did my PR fail CI?**
A: Check the failed job details. Most common: linting errors, build failures, or type errors.

**Q: How do I skip CI for a commit?**
A: Add `[skip ci]` to commit message (not recommended).

**Q: Can I run CI locally?**
A: Yes! Use `npm run lint`, `npm run build`, `npm run test`.

**Q: How long does CI take?**
A: Typically 3-5 minutes for full pipeline with caching.

**Q: What if CI is stuck?**
A: Cancel the workflow and re-run. Check for infinite loops in code.

## Support

- 📧 CI/CD Issues: Create issue with `ci` label
- 📚 Documentation: See `/docs` folder
- 🤝 Contributing: See `CONTRIBUTING.md`

---

**Owner**: Rana Bilal Akbar  
**Last Updated**: October 10, 2025

