# Component Guidelines

> How components are built in ArkmeDemo.

## Overview

Components are plain React function components written in TypeScript. Styling is mainly Tailwind classes, often composed through `cn` from `src/lib/utils.ts`.

The app favors direct, readable components over framework-heavy abstractions. Page components currently hold significant local UI state when the behavior is page-specific.

## Component Structure

- Imports first: React/hooks, local components, data helpers, utilities, settings, then types.
- Define local prop and helper types near the top of the file.
- Keep small private helper functions in the same file when they are only used there.
- Export one default component from component/page files.
- Use named exports for shared data helpers and shared types.

Examples:

- `src/layouts/AppShell.tsx` defines private `PhoneStatusBar`, `SignalIcon`, and `BatteryIcon` helpers in the same file because they are shell-specific.
- `src/pages/AdminMessageConsole.tsx` keeps test-console helpers beside the page because they are not reused elsewhere.

## Props Conventions

- Use explicit object prop types for reusable components.
- Keep callback names action-oriented, such as `onNavigate`.
- Use `React.ReactNode` for renderable child-like regions when needed.
- Prefer narrow unions for component modes and page keys.

Current examples:

```tsx
type HomeProps = {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
};
```

```tsx
export default function AppShell({
  mainPane,
  className,
}: {
  mainPane: React.ReactNode;
  className?: string;
}) {
  // ...
}
```

## Styling Patterns

- Use Tailwind classes inline for layout and visual styling.
- Use design tokens from `src/styles/tokens.css` and Tailwind theme classes such as `bg-bg` and `text-text`.
- Use `cn(...)` when classes are conditional or need merging.
- Use CSS files for global tokens and base styles only: `src/styles/globals.css` and `src/styles/tokens.css`.
- Assets are served from `public/` and referenced by path when needed.

## Accessibility

- Use real `button` elements for clickable controls.
- Add `aria-hidden="true"` to decorative icons and device chrome.
- Preserve keyboard-friendly controls when adding modals, pickers, and inputs.
- Keep visible labels concise and localized through the existing preferences translation system when text belongs to the app UI.

## Common Mistakes

- Changing the mobile demo and message test console together when the task only touches one surface.
- Adding one-off visual primitives instead of reusing existing chat, shell, and record components.
- Updating display data without updating the synchronized Codex log source when the change is part of a Codex iteration.
