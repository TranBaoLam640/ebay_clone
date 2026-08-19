# Repository Instructions

## Permanent Git Workflow

For every future task that modifies repository files:

1. Snapshot `git status` before editing.
2. Preserve all unrelated pre-existing user changes.
3. Make the requested changes.
4. Run relevant validation.
5. Stage only files changed by the current task.
6. Create one descriptive conventional commit.
7. Automatically run `git push origin HEAD`.
8. Never force-push or rewrite history.
9. Never commit secrets or `.env` files.
10. Report the commit hash, commit message, branch, and push result.

If a task makes no file changes, do not commit or push.

If push fails because of auth, network, branch protection, or non-fast-forward,
do not bypass the failure and do not force push. Report the failure.
