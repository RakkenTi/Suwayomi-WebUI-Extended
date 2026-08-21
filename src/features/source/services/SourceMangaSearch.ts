/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { LimitFunction } from 'p-limit';
import pLimit from 'p-limit';
import uniqBy from 'lodash/fp/uniqBy';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_MIGRATION_SOURCE_MANGAS_FETCH } from '@/lib/graphql/source/SourceMutation.ts';
import { GET_SERVER_SETTINGS } from '@/lib/graphql/settings/SettingsQuery.ts';
import { FetchSourceMangaType } from '@/lib/graphql/generated/graphql-base.types.ts';
import type {
    ChapterListFieldsFragment,
    GetMigrationSourceMangasFetchMutation,
    GetMigrationSourceMangasFetchMutationVariables,
    GetServerSettingsQuery,
    GetServerSettingsQueryVariables,
    MangaMigrationFieldsFragment,
} from '@/lib/graphql/generated/graphql.ts';
import { enhancedCleanup } from '@/base/utils/Strings.ts';
import type { SourceIdInfo } from '@/features/source/Source.types.ts';
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';

export type SourceMangaSearchMatch = {
    manga: MangaMigrationFieldsFragment;
    chapters: ChapterListFieldsFragment[] | null;
};

export type SourceMangaSearchOptions = {
    /**
     * Additionally searches for each word of the title, which finds matches in sources with a weak search
     * implementation at the cost of one request per word.
     */
    performAdvancedSearch?: boolean;
    /**
     * Entry to never match against - used to prevent an entry from matching itself.
     */
    excludeMangaId?: MangaIdInfo['id'];
};

const DEFAULT_MAX_SOURCES_IN_PARALLEL = 6;

/**
 * Request queues shared by every consumer that searches sources for entries (bulk migration search, stale source
 * check, ...).
 *
 * They are intentionally global: sources are rate limited (and in some cases Cloudflare protected) per host, so two
 * features running at the same time must not each get their own budget of parallel requests.
 */
export class SourceRequestQueue {
    private static parallelSourcesQueue: LimitFunction | undefined;

    private static queueBySource = new Map<SourceIdInfo['id'], LimitFunction>();

    /**
     * Limits how many different sources are queried at the same time, based on the server setting.
     */
    static getParallelSourceQueue(): LimitFunction {
        if (SourceRequestQueue.parallelSourcesQueue) {
            return SourceRequestQueue.parallelSourcesQueue;
        }

        try {
            const result = requestManager.graphQLClient.client.readQuery<
                GetServerSettingsQuery,
                GetServerSettingsQueryVariables
            >({
                query: GET_SERVER_SETTINGS,
            });

            SourceRequestQueue.parallelSourcesQueue = pLimit(
                result?.settings.maxSourcesInParallel ?? DEFAULT_MAX_SOURCES_IN_PARALLEL,
            );
        } catch (error) {
            SourceRequestQueue.parallelSourcesQueue = pLimit(DEFAULT_MAX_SOURCES_IN_PARALLEL);
        }

        return SourceRequestQueue.parallelSourcesQueue!;
    }

    /**
     * Limits a single source to one request at a time.
     */
    static getSourceQueue(sourceId: SourceIdInfo['id']): LimitFunction {
        const existingQueue = SourceRequestQueue.queueBySource.get(sourceId);
        if (existingQueue) {
            return existingQueue;
        }

        const queue = pLimit(1);
        SourceRequestQueue.queueBySource.set(sourceId, queue);

        return queue;
    }
}

/**
 * Searches a source for entries whose title matches {@link mangaTitle} and fetches the chapter list of every match.
 *
 * The returned matches carry the up-to-date manga (including "highestNumberedChapter") and, unless the refresh
 * failed, its chapters - everything a caller needs to compare a source against another one.
 *
 * @throws if every search request failed
 */
export const searchSourceForMangaTitle = async (
    sourceId: SourceIdInfo['id'],
    mangaTitle: string,
    signal: AbortSignal,
    { performAdvancedSearch = false, excludeMangaId }: SourceMangaSearchOptions = {},
): Promise<SourceMangaSearchMatch[]> => {
    signal.throwIfAborted();

    const searchQueries = performAdvancedSearch
        ? [
              mangaTitle,
              ...enhancedCleanup(mangaTitle)
                  .split(' ')
                  .filter((query) => query.length >= 3),
          ]
        : [mangaTitle];

    const searchRequests = searchQueries.map((query) =>
        SourceRequestQueue.getSourceQueue(sourceId)(() =>
            requestManager.graphQLClient.client.mutate<
                GetMigrationSourceMangasFetchMutation,
                GetMigrationSourceMangasFetchMutationVariables
            >({
                mutation: GET_MIGRATION_SOURCE_MANGAS_FETCH,
                variables: {
                    input: {
                        source: sourceId,
                        query,
                        page: 1,
                        type: FetchSourceMangaType.Search,
                    },
                },
                context: { fetchOptions: { signal } },
            }),
        ),
    );

    const searchResponses = await Promise.allSettled(searchRequests);
    const successfulSearchResponses = searchResponses
        .filter((response) => response.status === 'fulfilled')
        .map((response) => response.value);

    if (!successfulSearchResponses.length) {
        const failureReasons = searchResponses.map((response) => (response as PromiseRejectedResult).reason);

        throw new Error(`Search failed due to:${failureReasons.join('\n\n')}`);
    }

    const searchResults = successfulSearchResponses.flatMap(
        (response) => response?.data?.fetchSourceManga?.mangas ?? [],
    );
    const uniqueSearchResults = uniqBy('id', searchResults);
    const matches = uniqueSearchResults.filter(
        (searchMatch) =>
            searchMatch.id !== excludeMangaId && enhancedCleanup(searchMatch.title) === enhancedCleanup(mangaTitle),
    );

    return Promise.all(
        matches.map(async (match) => {
            signal.throwIfAborted();

            try {
                const updatedMatch = await SourceRequestQueue.getSourceQueue(sourceId)(
                    () =>
                        requestManager.refreshManga(match.id, {
                            awaitRefetchQueries: true,
                            context: { fetchOptions: { signal } },
                        }).response,
                );

                if (updatedMatch.data?.fetchMangaAndChapters?.manga) {
                    return {
                        manga: updatedMatch.data.fetchMangaAndChapters.manga,
                        chapters: updatedMatch.data.fetchMangaAndChapters?.chapters ?? null,
                    };
                }
            } catch (e) {
                // ignore - fall back to the entry as returned by the search
            }

            return {
                manga: match,
                chapters: null,
            };
        }),
    );
};
