# Security Policy

## Supported versions

Security fixes are applied to the latest release and the `main` branch. Older releases may not receive fixes.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/ailawu0409/dsh-usage-stats/security/advisories/new) instead of a public issue. Include affected versions, reproduction steps using synthetic data, impact, and a suggested mitigation when available. Maintainers will acknowledge reports as soon as reasonably possible and coordinate disclosure after a fix is available.

## Data and privacy boundary

- The plugin reads local DeepSeek Harness session logs read-only. It does not make network requests or upload data.
- It writes only a folded usage cache under `<profile>/plugin-state/usage-stats-cache.json`.
- There is no telemetry, analytics, or credential collection.
- Security reports, issues, pull requests, and tests must never include real session logs, tokens, credentials, private keys, or unredacted local paths.

## Scope

In scope: unintended data exposure, unintended file writes, path traversal through session identifiers, XSS in the settings UI, Remote invocation validation, and dependency compromise.

Out of scope: issues that require a compromised host or operating system, or the inherent fact that local session logs contain conversation data.
