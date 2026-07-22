# Support and compatibility

## Versioning

TypeScript and Python distributions share one semantic version. While the SDK
is below `1.0.0`, minor releases may include breaking API changes. Patch
releases are reserved for compatible fixes.

The generic `agilabs.turns` v1 wire contract has its own compatibility promise:
breaking its envelope, cursor, retry, or simultaneous-intent behavior requires
a new protocol version. See [Turn protocol v1](/protocol-v1).

Pin an exact release for production and review the GitHub release notes before
upgrading:

```json
{
  "dependencies": {
    "@yugao-gaos/turn-based-grid-sdk": "git+https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK.git#v0.10.0"
  }
}
```

## Runtime support

- TypeScript output targets ES2022 and uses ESM package entry points.
- Hosted clients and keyed drivers require a runtime with `fetch`.
- The `./agent-cli` entry point is Node-only because it launches subprocesses.
- Python requires version 3.10 or newer and has no runtime dependencies.

## Getting help

Use [GitHub Issues](https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/issues)
for reproducible bugs and focused feature requests. Include the SDK version,
runtime version, minimal input or reducer, expected result, and actual result.

Do not report suspected vulnerabilities in a public issue. Follow the private
instructions in the repository's
[security policy](https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/security/policy).

## Scope of support

The SDK project can support reusable mechanics, protocol compatibility, agent
infrastructure, and the published clients. Product content and hosting policy
remain the responsibility of the product that integrates the SDK.
