# LeafAtlas Netlify build troubleshooting (20 November 2026)

## Correct repository layout

At the GitHub repository **root** there must be: `netlify.toml`, `package.json`, `.node-version`, `build.mjs`, and folders `public/`, `server/`, `netlify/`.

The ZIP itself contains these files **at the top level**, not in another project folder. Unzip and upload the **contents** into the repo root.

## Netlify build settings

- Repository base directory: **blank** if files are in repo root
- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Node version: 22 (set in `.node-version`)

If you place all files inside a folder, set **Base directory** to that exact folder; then `public` and `netlify/functions` remain relative to it.

## If build fails again

In Netlify choose **Project / Site → Deploys → Failed deploy → Deploy log**. Copy or screenshot the **first error message and 15–20 lines above it** (not only the final exit code). Check:

- `ENOENT`, `Missing script: build`, `package.json not found`: incorrect base directory or nested folder.
- `python3: command not found`: still running the older build; confirm Git contains `build.mjs` and `package.json` says `node build.mjs`.
- `npm ERR!`, `notarget`, dependency errors: dependency install issue.
- `Deploy directory 'public' does not exist`: wrong publish/base directory.
- errors mentioning Netlify Functions/bundling: inspect full log and the Node version.

## Important

A successful build only publishes the application. **Do not collect actual patient responses until Netlify Functions and Blobs have been validated on your live project** and the project-specific privacy/security configuration is as approved by your Trust. The live app intentionally requires private environment variables; keep them out of Git.

Run local sanity checks:

```bash
node --version
npm run build
npm test
```

The build step itself needs no installed third-party dependencies. Netlify installs the Functions dependency automatically.
