# Contributing to PropPal

Thank you for your interest in contributing to PropPal! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards others

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **Python**: v3.13 or higher
- **Docker**: Latest version
- **Git**: Latest version

### Setup Development Environment

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then:
   git clone https://github.com/YOUR_USERNAME/PropPal.git
   cd PropPal
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd apps/backend
   python -m venv venv
   .\venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Mac/Linux
   pip install -r requirements.txt
   cd ../..
   ```

3. **Set up environment variables**
   ```bash
   # Frontend
   cp apps/web/env.template apps/web/.env.local
   # Edit apps/web/.env.local with your Clerk keys
   
   # Backend
   cp apps/backend/.env.example apps/backend/.env
   # Edit apps/backend/.env with your MongoDB and Clerk keys
   ```

4. **Verify setup**
   ```bash
   npm run lint
   npm run build
   npm run dev
   ```

## Development Workflow

### 1. Create a Branch

```bash
# Update main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation
- `refactor/what-changed` - Code refactoring
- `test/what-added` - Adding tests
- `chore/what-changed` - Maintenance tasks

### 2. Make Changes

- Write code following our [coding standards](#coding-standards)
- Add tests for new functionality
- Update documentation as needed
- Run linters and tests locally

### 3. Test Locally

```bash
# Lint your code
npm run lint:js        # JavaScript/TypeScript
npm run lint:py        # Python
npm run lint          # All

# Fix linting issues
npm run format:js     # Auto-fix JS/TS
npm run format:py     # Auto-fix Python

# Build
npm run build

# Run tests
npm run test

# Test Docker
npm run docker:rebuild:up
npm run docker:logs
```

### 4. Commit Changes

Follow the [commit guidelines](#commit-guidelines):

```bash
git add .
git commit -m "feat(auth): add social login support"
```

### 5. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub.

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

### Scopes

- `auth` - Authentication
- `api` - API endpoints
- `db` - Database
- `ui` - User interface
- `docker` - Docker configuration
- `ci` - CI/CD pipeline
- `docs` - Documentation

### Examples

```bash
# Feature
git commit -m "feat(auth): add Clerk authentication integration"

# Bug fix
git commit -m "fix(api): resolve database connection timeout"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Breaking change
git commit -m "feat(api): change user schema structure

BREAKING CHANGE: User.name is now split into firstName and lastName"
```

### Commit Message Rules

✅ **Do:**
- Use imperative mood ("add" not "added")
- Start with lowercase (unless proper noun)
- No period at the end
- Keep under 72 characters
- Reference issues when applicable

❌ **Don't:**
- Use past tense
- Add unnecessary punctuation
- Be vague ("fix stuff")
- Commit broken code

## Pull Request Process

### Before Creating PR

1. ✅ All tests pass locally
2. ✅ Code is linted and formatted
3. ✅ Documentation is updated
4. ✅ Commits follow guidelines
5. ✅ Branch is up to date with main

### PR Title

Follow same format as commits:

```
feat(auth): add social login support
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How to test these changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Changes are backward compatible (or BREAKING CHANGE noted)
```

### PR Size Guidelines

- 🟢 **Small** (< 200 lines): Ideal
- 🟡 **Medium** (200-500 lines): Acceptable
- 🟠 **Large** (500-1000 lines): Consider splitting
- 🔴 **Extra Large** (> 1000 lines): Should be split

### Review Process

1. **Automated Checks**
   - CI pipeline must pass
   - All status checks green

2. **Code Review**
   - At least 1 approval required
   - Address reviewer feedback

3. **Merge**
   - Squash and merge (preferred)
   - Rebase and merge (for clean history)
   - No merge commits

## Coding Standards

### TypeScript/JavaScript

```typescript
// ✅ Good
export async function getUserById(id: string): Promise<User> {
  const user = await db.users.findOne({ id })
  if (!user) {
    throw new ResourceNotFoundException('User not found')
  }
  return user
}

// ❌ Bad
export async function getUser(id) {
  return await db.users.findOne({ id })
}
```

**Rules:**
- Use TypeScript strict mode
- Always type function parameters and returns
- Use async/await over promises
- Prefer const over let
- Use meaningful variable names
- Add JSDoc for complex functions

### Python

```python
# ✅ Good
async def get_user_by_id(user_id: str) -> User:
    """
    Retrieve user by ID from database.
    
    Args:
        user_id: Unique user identifier
        
    Returns:
        User object if found
        
    Raises:
        ResourceNotFoundException: If user not found
    """
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise ResourceNotFoundException(
            message=f"User {user_id} not found"
        )
    return User(**user)

# ❌ Bad
def getUser(id):
    return db.users.find_one({"_id": id})
```

**Rules:**
- Use type hints (PEP 484)
- Follow PEP 8 style guide
- Use Black for formatting
- Add docstrings (Google style)
- Use async/await for I/O operations
- Prefer explicit over implicit

### File Organization

```
apps/
├── backend/
│   ├── common/          # Shared utilities
│   ├── models/          # Pydantic models
│   └── services/        # API services
│       ├── auth/        # Authentication
│       └── main.py      # Entry point
├── web/
│   └── src/
│       ├── app/         # Next.js app
│       ├── components/  # React components
│       └── lib/         # Utilities
└── packages/
    └── schemas/         # Shared schemas
```

## Testing

### Writing Tests

**TypeScript (Jest/Vitest):**
```typescript
describe('getUserById', () => {
  it('should return user when found', async () => {
    const user = await getUserById('123')
    expect(user).toBeDefined()
    expect(user.id).toBe('123')
  })
  
  it('should throw when user not found', async () => {
    await expect(getUserById('999')).rejects.toThrow()
  })
})
```

**Python (pytest):**
```python
@pytest.mark.asyncio
async def test_get_user_by_id_success():
    user = await get_user_by_id("123")
    assert user is not None
    assert user.id == "123"

@pytest.mark.asyncio
async def test_get_user_by_id_not_found():
    with pytest.raises(ResourceNotFoundException):
        await get_user_by_id("999")
```

### Running Tests

```bash
# All tests
npm run test

# Specific workspace
npx turbo run test --filter=@proppal/schemas

# Python tests
cd apps/backend
pytest

# With coverage
pytest --cov=.
```

## Documentation

### Code Documentation

**Add comments for:**
- Complex algorithms
- Non-obvious solutions
- TODO items with context
- Public APIs

**Don't comment:**
- Obvious code
- Every line
- Instead of good naming

### API Documentation

FastAPI auto-generates OpenAPI docs:
```python
@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    include_posts: bool = False
):
    """
    Get user by ID.
    
    - **user_id**: Unique user identifier
    - **include_posts**: Whether to include user's posts
    
    Returns user object with optional posts.
    """
    ...
```

### README Updates

Update README when:
- Adding new features
- Changing setup process
- Adding dependencies
- Modifying architecture

## Questions?

- 💬 **Discussion**: Start a [GitHub Discussion](https://github.com/bilalrana8718/PropPal/discussions)
- 🐛 **Bug**: Create an [issue](https://github.com/bilalrana8718/PropPal/issues)
- 📧 **Email**: Contact maintainers

## Recognition

Contributors will be:
- Added to CONTRIBUTORS.md
- Mentioned in release notes
- Acknowledged in documentation

Thank you for contributing to PropPal! 🎉

