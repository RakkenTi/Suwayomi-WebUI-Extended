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
