# Contributing

Thank you for contributing to dsh-usage-stats.

## Before you start

- Search existing issues before opening a duplicate.
- Never include real session content, session IDs, tokens, access credentials, private keys, or unredacted local paths in issues, pull requests, tests, or fixtures. Use synthetic data.
- Open an issue before large behavior changes or public interface changes.

## Development setup

Node.js 22 or newer is required. There are no third-party runtime dependencies to install.

```sh
git clone https://github.com/ailawu0409/dsh-usage-stats.git
cd dsh-usage-stats
npm run check
npm test
```

Use `npm run test:host` or `npm run test:client` while iterating on one half of the plugin. Run the full suite before submitting a pull request.

## Making changes

- Keep the Host and Client halves separate. Do not access the file system or session logs from the Client.
- Preserve the local-only privacy boundary: no network access, telemetry, or uploads.
- Keep the statistics accounting, cache migration, retention, and failure-cooldown behavior consistent with both READMEs.
- Add or update tests for behavior changes; do not only adjust assertions to hide a regression.
- Update `README.md` and `README.zh-CN.md` when user-visible behavior, accounting, installation, or limitations change.
- Avoid unrelated refactors, formatting changes, and dependency upgrades.
- Run `npm run check`, `npm test`, and `npm pack --dry-run` before opening a pull request.

## Commits and pull requests

- Make small, focused commits and explain the behavior they change.
- Ensure CI passes on ubuntu/windows and Node 22/24.
- Describe user-visible changes and the tests you ran in the pull request.

## Reporting bugs

Open an issue with the plugin version, DeepSeek Harness version, operating system, steps to reproduce, expected behavior, and actual behavior. Redact local paths and use synthetic session data.
