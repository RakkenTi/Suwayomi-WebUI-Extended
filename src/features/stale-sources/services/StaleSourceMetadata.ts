/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { getMangaMetadata, updateMangaMetadata } from '@/features/manga/services/MangaMetadata.ts';
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import type { GqlMetaHolder } from '@/features/metadata/Metadata.types.ts';
import type { SourceIdInfo } from '@/features/source/Source.types.ts';
import type { StaleSourceCheckResult, StaleSourceMangaMetadata } from '@/features/stale-sources/StaleSources.types.ts';
import { StaleSourceVerdict } from '@/features/stale-sources/StaleSources.types.ts';

export type StaleSourceMetadataHolder = MangaIdInfo & GqlMetaHolder;

export const getStaleSourceMetadata = (manga: StaleSourceMetadataHolder): StaleSourceMangaMetadata => {
    const { staleSourceCheck, staleSourceIgnoredSourceIds } = getMangaMetadata(manga);

    return { staleSourceCheck, staleSourceIgnoredSourceIds };
};

export const getStaleSourceCheckResult = (manga: StaleSourceMetadataHolder): StaleSourceCheckResult | null =>
    getStaleSourceMetadata(manga).staleSourceCheck;

/**
 * Whether the last check found a source that is ahead and the reported source has not been dismissed since.
 */
export const isEntryBehindOtherSource = (manga: StaleSourceMetadataHolder): boolean => {
    const { staleSourceCheck, staleSourceIgnoredSourceIds } = getStaleSourceMetadata(manga);

    if (!staleSourceCheck) {
        return false;
    }

    const isBehindVerdict =
        staleSourceCheck.verdict === StaleSourceVerdict.BEHIND ||
        staleSourceCheck.verdict === StaleSourceVerdict.NO_CHAPTERS;

    if (!isBehindVerdict || !staleSourceCheck.match) {
        return false;
    }

    return !staleSourceIgnoredSourceIds.includes(staleSourceCheck.match.sourceId);
};

export const setStaleSourceCheckResult = async (
    manga: StaleSourceMetadataHolder,
    result: StaleSourceCheckResult,
): Promise<void> => updateMangaMetadata(manga, 'staleSourceCheck', result);

export const clearStaleSourceCheckResult = async (manga: StaleSourceMetadataHolder): Promise<void> =>
    updateMangaMetadata(manga, 'staleSourceCheck', null);

/**
 * Dismisses a source for an entry. It is neither searched nor reported again until it gets un-ignored.
 */
export const ignoreStaleSourceForManga = async (
    manga: StaleSourceMetadataHolder,
    sourceId: SourceIdInfo['id'],
): Promise<void> => {
    const { staleSourceIgnoredSourceIds } = getStaleSourceMetadata(manga);

    if (staleSourceIgnoredSourceIds.includes(sourceId)) {
        return;
    }

    await updateMangaMetadata(manga, 'staleSourceIgnoredSourceIds', [...staleSourceIgnoredSourceIds, sourceId]);
};

export const unignoreStaleSourcesForManga = async (manga: StaleSourceMetadataHolder): Promise<void> =>
    updateMangaMetadata(manga, 'staleSourceIgnoredSourceIds', []);
