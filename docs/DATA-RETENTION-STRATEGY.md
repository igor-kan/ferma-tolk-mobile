# Data Retention, Archival, and Backup Strategy (FT-029)

## 1. Backup Policy & Recovery

The application relies on Supabase's managed infrastructure for database backups.

### Retention Windows

- **Daily Backups:** Retained for 7 days (standard for Free/Pro tiers).
- **Point-in-Time Recovery (PITR):** Available on Pro/Enterprise plans for up to 30 days of granular recovery.
- **Manual Backups:** Recommended before major schema migrations using `supabase db dump`.

### Restoration Process (Drill)

1. Identify the target PITR timestamp or backup file.
2. In the Supabase Dashboard, navigate to Database -> Backups.
3. Select "Restore" to a new temporary project to verify data integrity.
4. Once verified, perform the cutover to the production instance.

## 2. Data Retention & Archival

To ensure performance as the dataset grows, the following archival rules are established:

### Active Data (Hot)

- Transactions from the current year and the previous 2 years are considered "Hot".
- These remain in the primary `public.transactions` table for active analytics and cycle comparisons.

### Cold Data (Archival)

- **Automatic Archival:** Transactions older than 3 years may be moved to a `public.transactions_archive` table or exported to cold storage (S3/Supabase Storage) as compressed JSON/CSV.
- **Soft Deletes:** Records marked as `deleted_at` are retained for 30 days before being permanently purged by a background maintenance task.

## 3. Storage Growth Assumptions

- **Transactions:** ~1,000 - 5,000 rows per farm per year.
- **Growth Rate:** ~10-50MB of relational data per 100 farms per year.
- **Media (Voice):** Audio blobs are processed and discarded; transcripts are stored as text (~1KB per message).
- **Review Cycle:** Storage metrics are reviewed quarterly via Supabase usage reports.
