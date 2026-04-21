# Style Guide

## Project Structure

The project follows a feature-based folder structure:

- `src/features/`: Contains all feature-specific logic, components, and hooks.
  - `src/features/<feature-name>/`: Each feature has its own folder.
- `src/shared/`: Shared components, UI primitives, and common API logic.
- `src/lib/`: Low-level utilities, configuration, and shared domain logic.
- `src/App.jsx`: The main application entry point that orchestrates features.
- `api/`: Serverless functions (Vercel).

## Import Boundaries

To maintain a clean architecture, we enforce the following import rules:

1. **Features** can import from:
   - Their own folder (e.g., `features/auth` can import from `features/auth/hooks`).
   - `shared/`
   - `lib/`
2. **Features** cannot import from other features (e.g., `features/auth` cannot import from `features/transactions`).
3. **App.jsx** can import from any feature to orchestrate the application.
4. **Shared/Lib** should not import from features.

These rules are enforced via ESLint using `eslint-plugin-boundaries`.

## State Management

- **Server State**: Use [TanStack Query](https://tanstack.com/query/latest) (React Query) for all asynchronous data fetching, caching, and synchronization.
- **Local State**: Use standard React `useState` and `useContext` for local or UI-specific state.
- **Global UI State**: Use `src/features/ui/UiContext.jsx` for global UI preferences.

## UI Consistency

- **Styling**: Use Vanilla CSS for all styling.
- **Design Principles**:
  - Mobile-first approach.
  - Consistent spacing and interactive feedback.
  - Accessible and visually appealing prototype.

## Linting and Formatting

- **ESLint**: Enforces code quality and architectural boundaries. Run `npm run lint`.
- **Prettier**: Enforces consistent code formatting. Run `npm run format`.
