# Context

Glossary of terms for this fork's custom behavior. Definitions only; implementation lives in code, rationale lives in commits/issues.

## Glossary

- **Chapter number**: The numeric value a source assigns to a chapter entry. May be fractional (1.1, 14.5).
- **Integer chapter**: A chapter whose chapter number is a whole number.
- **Decimal chapter**: A chapter whose chapter number has a fractional part. May be a split part of an integer chapter (1.1, 1.2 as parts of 1) or standalone bonus content (a real 14.5 extra).
- **Skippable decimal**: A decimal chapter X.y whose integer chapter X exists in the relevant scope. Scope is the manga's full chapter list for bulk actions and reader navigation, but only the current selection for manually ticked downloads.
- **Skip-decimals rule**: Skippable decimals are excluded from download selection and from the reader's next-chapter navigation. Controlled by a global toggle with a per-manga override. Read/unread state is never mutated by skipping.
- **Duplicate chapters**: Entries of the same manga sharing one chapter number, published by different scanlators.
- **Dupe winner**: The single entry kept when duplicates are collapsed: the anchor chapter's scanlator if present, otherwise the latest listed entry.
- **Source search failure**: A global-search source that returned an error instead of results. Failures are retried automatically a limited number of times, then shown compactly with full details available on demand.
- **Silent entry**: A library entry whose newest chapter is older than the configured silence threshold, or that has no chapters at all. Entries whose status says no more chapters are expected (completed, cancelled, licensed, publishing finished) are never silent.
- **Stale source**: The source of a library entry that another source is ahead of by at least the configured chapter margin, comparing highest chapter numbers regardless of scanlator. An entry whose own source has no chapters counts as stale as soon as any other source has chapters.
- **Stale source check**: Per entry search across every other source the library uses, comparing the highest chapter number of each match against the entry's own. The entry is re-fetched from its own source first so the comparison uses what the source currently offers. The result is stored in the entry's metadata.
- **Check budget**: Upper bound of stale source checks started within a rolling 24 hours. Derived from the stored check timestamps, so it is shared by every client.
- **Rolling check**: The scheduler walks the library over time instead of sweeping it - each run takes the silent entries checked longest ago, up to the remaining check budget. It only runs while the WebUI is open, and one client at a time.
- **Ignored source**: A source dismissed for one entry. It is neither searched nor reported for that entry again.
