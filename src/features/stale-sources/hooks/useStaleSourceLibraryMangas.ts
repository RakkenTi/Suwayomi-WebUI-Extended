/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useMemo } from 'react';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_MANGAS_LIBRARY } from '@/lib/graphql/manga/MangaQuery.ts';
import type { GetMangasLibraryQuery, GetMangasLibraryQueryVariables } from '@/lib/graphql/generated/graphql.ts';
import { STABLE_EMPTY_ARRAY } from '@/base/Base.constants.ts';
import type { StaleSourceCheckableManga } from '@/features/stale-sources/StaleSources.types.ts';
import { isEntryBehindOtherSource } from '@/features/stale-sources/services/StaleSourceMetadata.ts';

/**
 * All library entries including their metadata - the input of every stale source computation (candidates, budget,
 * results screen and the library badge count).
 */
export const useStaleSourceLibraryMangas = (
    skip: boolean = false,
): {
    mangas: StaleSourceCheckableManga[];
    request: ReturnType<typeof requestManager.useGetMangas<GetMangasLibraryQuery, GetMangasLibraryQueryVariables>>;
} => {
    const request = requestManager.useGetMangas<GetMangasLibraryQuery, GetMangasLibraryQueryVariables>(
        GET_MANGAS_LIBRARY,
        { condition: { inLibrary: true } },
        { skip },
    );

    const mangas = request.data?.mangas.nodes ?? (STABLE_EMPTY_ARRAY as StaleSourceCheckableManga[]);

    return useMemo(() => ({ mangas, request }), [mangas, request]);
};

/**
 * Library entries whose last check found another source that is ahead.
 */
export const useEntriesBehindOtherSource = (skip: boolean = false): StaleSourceCheckableManga[] => {
    const { mangas } = useStaleSourceLibraryMangas(skip);

    return useMemo(() => mangas.filter(isEntryBehindOtherSource), [mangas]);
};
