# Contributing to FinX

Thanks for your interest in improving FinX.

## Development Setup

1. Create and activate a Python virtual environment.
2. Install backend dependencies:

```bash
pip install -r requirements.txt
pip install -r webapp/backend/requirements.txt
```

3. Install frontend dependencies:

```bash
cd webapp/frontend
npm install
```

4. Create local environment files from examples:

- webapp/backend/.env.example -> webapp/backend/.env
- webapp/frontend/.env.example -> webapp/frontend/.env.local

## Contribution Guidelines

- Keep commits focused and descriptive.
- Do not commit secrets, API keys, model checkpoints, or generated datasets.
- Update documentation when behavior, setup, or architecture changes.
- Prefer small pull requests over large monolithic ones.

## Pull Request Checklist

- Code runs locally.
- Docs updated for user-facing changes.
- No secrets or local artifacts included.
- Commit history is clear and reviewable.

## Code Style

- Python: clear names, small functions, and type hints where practical.
- TypeScript/React: typed props and avoid `any` where possible.
- Keep complexity low and prioritize readability.
