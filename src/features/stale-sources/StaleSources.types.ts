/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { MangaLibraryFieldsFragment } from '@/lib/graphql/generated/graphql.ts';
import type { SourceIdInfo } from '@/features/source/Source.types.ts';
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';

export enum StaleSourceVerdict {
    /** No other source carries more chapters than the entry's own source. */
    UP_TO_DATE = 'up_to_date',
    /** At least one other source is ahead by the configured chapter margin. */
    BEHIND = 'behind',
    /** The entry's own source has no chapters at all - the entry is broken, not just behind. */
    NO_CHAPTERS = 'no_chapters',
    /** No other source has an entry with a matching title. */
    NO_MATCH = 'no_match',
    /** Every searched source failed to respond. */
    FAILED = 'failed',
}

export type StaleSourceMatch = {
    sourceId: SourceIdInfo['id'];
    sourceName: string;
    mangaId: MangaIdInfo['id'];
    title: string;
    latestChapterNumber: number;
    /** Chapters the source lists, which can differ a lot from the highest chapter number. */
    chapterCount: number;
    /**
     * Chapters missing between the entry's read progress and the source's newest chapter. A source that is ahead but
     * full of holes is usually not worth migrating to.
     */
    missingChapters: number;
    /** Newest chapter's upload date - tells apart a source that is ahead from one that is also still active. */
    latestUploadDate: number | null;
};

/** The entry's own source, described the same way as the candidates so both can be compared side by side. */
export type StaleSourceOwnStats = {
    latestChapterNumber: number | null;
    chapterCount: number;
    latestUploadDate: number | null;
};

export type StaleSourceCheckResult = {
    checkedAt: number;
    verdict: StaleSourceVerdict;
    /** Highest chapter number of the entry's own source at the time of the check. */
    latestChapterNumber: number | null;
    /** The entry's own source at the time of the check. Absent on results stored before this was recorded. */
    own?: StaleSourceOwnStats;
    /** Best match found in another source, if any. */
    match: StaleSourceMatch | null;
    /**
     * Best match per source, so the result can be judged instead of taken on faith. Empty on results stored before
     * per source stats were recorded.
     */
    matches?: StaleSourceMatch[];
    /** Sources that were searched, whether or not they returned a match. */
    checkedSourceIds: SourceIdInfo['id'][];
    error?: string;
};

/**
 * Per entry stale source check state.
 *
 * Stored in the entry's server side metadata so that the result is shared across devices and browsers instead of
 * being re-computed (and re-requested from the sources) per client.
 */
export type StaleSourceMangaMetadata = {
    staleSourceCheck: StaleSourceCheckResult | null;
    /** Sources dismissed for this entry - never searched again and never reported as being ahead. */
    staleSourceIgnoredSourceIds: SourceIdInfo['id'][];
};

export type MetadataStaleSourceSettings = {
    /** Master switch - while disabled nothing is requested from any source. */
    staleSourceCheckEnabled: boolean;
    /** How many entries may be checked within a rolling 24 hours, across all devices. */
    staleSourceChecksPerDay: number;
    /** Only entries without a new chapter for this many days become check candidates. */
    staleSourceSilentDays: number;
    /** How many chapters another source has to be ahead by before the entry counts as behind. */
    staleSourceMinChapterDelta: number;
    /** How long a checked entry is left alone before it becomes a candidate again. */
    staleSourceRecheckDays: number;
    /** Show a badge on library entries that are behind another source. */
    showStaleSourceBadge: boolean;
};

export type StaleSourceCheckableManga = MangaLibraryFieldsFragment;

export type StaleSourceProgress = {
    total: number;
    completed: number;
};
