# State Ownership Rules (FT-017)

This document defines where state lives in Ferma.Tolk and how it should be accessed.

## 1. Local UI State

**Location:** `src/context/UiContext.jsx`
**Access:** `useUiContext()`

- **language**: Current display language (ru/en). Not persisted to DB.
- **selectedMonth / selectedYear**: The global period filter used for Dashboard and Reports. Persisted to `localStorage` via `useUiPrefs`.
- **UI Toggles**: Any temporary UI state (modals, active tabs) that needs to span more than one component should live here if not managed locally in a parent component.

## 2. Remote Server State (Persistent Entities)

**Location:** TanStack Query Cache
**Access:** Domain-specific hooks in `src/hooks/`

- **Transactions**: `useTransactions(userId)`
- **Projects**: `useTransactions(userId)`
- **Description Mappings**: `useTransactions(userId)`
- **Forecast Adjustments**: `useForecast(userId, year, month)`
- **Chat History**: `useChatMessages(userId)`

### Ownership Rules:

1. **Source of Truth**: The Supabase database is the final source of truth. TanStack Query manages the local cache, invalidation, and synchronization.
2. **Direct Access**: Components should call the specific domain hook they need. Avoid passing business entities through generic contexts.
3. **Mutations**: Use the mutation functions returned by the hooks (e.g., `addTransaction`). They handle server communication and cache invalidation.

## 3. Derived State (Analytics)

**Location:** Memoized Computation
**Access:** `useAppAnalytics()`

- **Analytics**: Computed fields like `totalIncome`, `balance`, `opexBreakdown`, etc.
- This hook composes multiple domain hooks and UI state to produce a unified view of the data.
- It is read-only.

## 4. Authentication State

**Location:** `src/context/AuthContext.jsx`
**Access:** `useAuth()`

- **currentUser**: The authenticated Supabase user.
- **session**: The current Supabase session.
- **logout / signIn / signUp**: Auth actions.
