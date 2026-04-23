# Theme Support Implementation Plan

This plan details the steps to introduce a comprehensive theming system into MyAPITester, supporting light, dark, and several creative themes.

## Goal
Implement a robust theming system using CSS variables mapped to Tailwind CSS configuration. The app will include Light, Dark, and three creative themes (e.g., Dracula, Nord, Hacker) and allow the user to easily switch between them.

## User Review Required
None. This is a visual enhancement, but please review the creative themes proposed and let me know if you have specific preferences!

## Open Questions
- Is `localStorage` acceptable for persisting the selected theme across sessions? (This is standard practice for UI preferences and avoids adding more IPC overhead for simple UI state).
- The creative themes proposed are: **Dracula** (Dark with neon accents), **Nord** (Cool frosty colors), and **Hacker** (Black background with green terminal text). Are these acceptable?

## Proposed Changes

### 1. `src/index.css`
- [MODIFY] Define global CSS variables in `:root` and distinct variants using `[data-theme="light"]`, `[data-theme="dracula"]`, etc.
- [MODIFY] Map these CSS variables into the Tailwind configuration via the new `@theme` directive (e.g., `--color-bg-base`, `--color-bg-surface`, `--color-border-main`).

### 2. `src/App.tsx`
- [MODIFY] Replace all hardcoded color classes (e.g., `bg-[#181818]`, `border-[#333]`, `text-gray-300`) with the new semantic classes (e.g., `bg-bg-base`, `border-border-main`, `text-text-secondary`).
- [MODIFY] Add state management for `theme` initialized from `localStorage`.
- [MODIFY] Inject a `useEffect` that updates `document.documentElement.setAttribute('data-theme', theme)` whenever the theme changes.
- [MODIFY] Update the Monaco Editor's `theme` prop to be dynamic (`vs` for light, `vs-dark` for dark/creative).
- [MODIFY] Add a Theme selector dropdown at the bottom of the sidebar.

### 3. `src/KeyValueEditor.tsx`
- [MODIFY] Update hardcoded input/border colors to use the new semantic classes to ensure the key-value editor aligns with the global theme.

## Verification Plan

### Manual Verification
1. Launch the app using `npm run dev`.
2. Toggle the theme from the sidebar.
3. Verify that the UI updates immediately across all elements (Sidebar, Tab bar, Main Area, Key-Value inputs).
4. Verify that the Monaco editor theme dynamically adjusts.
5. Close and reopen the application to verify that the theme selection persists.
