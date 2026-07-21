# Releasing

TypeScript and Python distributions share one semantic version. Before a
release, update both `package.json` and `python/pyproject.toml`, then run:

```sh
npm ci
npm run typecheck
npm test
npm run build

python3 -m pip install build pytest
PYTHONPATH=python python3 -m pytest python/tests
python3 -m build python
```

Commit the version change separately and push it. Create a GitHub release whose
tag is `v` followed by that version, such as `v0.1.0`.

Publishing the release runs `.github/workflows/release.yml`. It:

1. validates the TypeScript SDK and publishes it to GitHub Packages;
2. validates and builds the Python SDK; and
3. attaches the npm tarball, Python wheel, and Python source distribution to
   the GitHub release.

GitHub Packages uses the repository's `GITHUB_TOKEN`; no long-lived npm token
is required. Package consumers authenticate with a token that has
`read:packages` access.
