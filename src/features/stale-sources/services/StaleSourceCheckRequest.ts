/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_MANGAS_LIBRARY } from '@/lib/graphql/manga/MangaQuery.ts';
import type { GetMangasLibraryQuery, GetMangasLibraryQueryVariables } from '@/lib/graphql/generated/graphql.ts';
import { getMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { StaleSourceChecker } from '@/features/stale-sources/services/StaleSourceChecker.ts';

/**
 * Queues entries for a stale source check from anywhere in the app.
 *
 * The library entries and the settings are fetched on demand (served from the cache when they are already loaded) so
 * that a menu offering this action does not have to query the whole library just to be rendered.
 *
 * Manually queued entries ignore the candidate filters and the daily budget - asking for a check is an explicit
 * decision to spend the requests.
 *
 * @returns the number of entries that were actually queued
 * @throws if no entry could be queued
 */
export const requestStaleSourceCheck = async (mangaIds: MangaIdInfo['id'][]): Promise<number> => {
    const [libraryResponse, settings] = await Promise.all([
        requestManager.getMangas<GetMangasLibraryQuery, GetMangasLibraryQueryVariables>(GET_MANGAS_LIBRARY, {
            condition: { inLibrary: true },
        }).response,
        getMetadataServerSettings(),
    ]);

    const libraryMangas = libraryResponse.data?.mangas.nodes ?? [];

    const entries = mangaIds
        .filter((mangaId) => !StaleSourceChecker.isQueued(mangaId))
        .map((mangaId) => libraryMangas.find((manga) => manga.id === mangaId))
        .filter((manga) => manga !== undefined);

    if (!entries.length) {
        const areAllQueued = mangaIds.every((mangaId) => StaleSourceChecker.isQueued(mangaId));

        throw new Error(
            areAllQueued ? 'Already queued for a source check' : 'No matching library entry could be found',
        );
    }

    StaleSourceChecker.enqueue(entries, libraryMangas, settings);

    return entries.length;
};
