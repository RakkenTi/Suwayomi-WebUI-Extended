/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { d } from 'koration';
import { MangaStatus } from '@/lib/graphql/generated/graphql-base.types.ts';
import type {
    MetadataStaleSourceSettings,
    StaleSourceMangaMetadata,
} from '@/features/stale-sources/StaleSources.types.ts';
import { StaleSourceVerdict } from '@/features/stale-sources/StaleSources.types.ts';

export const STALE_SOURCE_SETTINGS_DEFAULT: MetadataStaleSourceSettings = {
    staleSourceCheckEnabled: false,
    staleSourceChecksPerDay: 10,
    staleSourceSilentDays: 30,
    staleSourceMinChapterDelta: 1,
    staleSourceRecheckDays: 14,
    showStaleSourceBadge: false,
};

export const STALE_SOURCE_MANGA_METADATA_DEFAULT: StaleSourceMangaMetadata = {
    staleSourceCheck: null,
    staleSourceIgnoredSourceIds: [],
};

export const STALE_SOURCE_CHECKS_PER_DAY = {
    min: 1,
    max: 100,
    step: 1,
};

export const STALE_SOURCE_SILENT_DAYS = {
    min: 0,
    max: 365,
    step: 1,
};

export const STALE_SOURCE_MIN_CHAPTER_DELTA = {
    min: 1,
    max: 50,
    step: 1,
};

export const STALE_SOURCE_RECHECK_DAYS = {
    min: 1,
    max: 365,
    step: 1,
};

/**
 * How many entries are checked at the same time. Kept low on purpose - the per source queues are shared with the
 * migration search and every check fans out over all library sources.
 */
export const MAX_STALE_SOURCE_CHECKS_IN_PARALLEL = 2;

/** Rolling window the daily check budget is measured over. */
export const STALE_SOURCE_BUDGET_WINDOW = d(1).days.inWholeMilliseconds;

/** How often the scheduler looks for candidates while the client is open. */
export const STALE_SOURCE_SCHEDULER_INTERVAL = d(30).minutes.inWholeMilliseconds;

/**
 * Entry states that mean "no more chapters are expected", so a source not delivering any is not suspicious.
 */
export const STALE_SOURCE_FINISHED_MANGA_STATUSES: MangaStatus[] = [
    MangaStatus.Completed,
    MangaStatus.Cancelled,
    MangaStatus.Licensed,
    MangaStatus.PublishingFinished,
];

export const STALE_SOURCE_VERDICT_TRANSLATION: Record<StaleSourceVerdict, MessageDescriptor> = {
    [StaleSourceVerdict.UP_TO_DATE]: msg`No source is ahead`,
    [StaleSourceVerdict.BEHIND]: msg`Another source is ahead`,
    [StaleSourceVerdict.NO_CHAPTERS]: msg`Source has no chapters`,
    [StaleSourceVerdict.NO_MATCH]: msg`No other source has this entry`,
    [StaleSourceVerdict.FAILED]: msg`Check failed`,
};
