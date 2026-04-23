# GitHub Actions Release Pipeline Implementation

I've successfully implemented the GitHub Actions CI/CD pipeline to automatically build and release `MyAPITester` for macOS, Linux, and Windows.

## Changes Made

### 1. Created Workflow File
Created the GitHub Actions workflow at `.github/workflows/release.yml`. This workflow:
- Triggers whenever a new tag starting with `v` (e.g., `v1.0.0`) is pushed to the repository.
- Uses a matrix strategy to run jobs concurrently on `ubuntu-latest`, `macos-latest`, and `windows-latest`.
- Sets up Node.js, installs dependencies, builds the Vite+React application, and packages it using `electron-builder`.
- Uses `GH_TOKEN` and `--publish always` to automatically attach the resulting executables and installers (`.dmg`, `.AppImage`, and `.exe`) to the GitHub Release.

### 2. Updated `package.json`
Added the `repository` field to `package.json` with the URL `https://github.com/vunloon/MyAPITester.git`. This ensures that `electron-builder` correctly identifies where to push the GitHub release artifacts.

## How to Test

To trigger the release pipeline, follow these steps in your terminal:

1. Stage and commit the changes:
```bash
git add .
git commit -m "chore: setup github actions release pipeline"
```

2. Create a version tag (e.g., `v1.0.0-beta`):
```bash
git tag v1.0.0-beta
```

3. Push the commit and the tag to your repository:
```bash
git push origin main # or whatever your main branch is
git push origin v1.0.0-beta
```

After pushing, head over to the **Actions** tab on your GitHub repository page. You will see the `Release MyAPITester` workflow running. Once the three jobs finish successfully, a new release will be created under the **Releases** section, with the macOS, Windows, and Linux executables attached!
