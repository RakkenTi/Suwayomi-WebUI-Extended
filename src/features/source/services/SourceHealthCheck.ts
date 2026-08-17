/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import pLimit from 'p-limit';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_SOURCE_MANGAS_FETCH } from '@/lib/graphql/source/SourceMutation.ts';
import { FetchSourceMangaType } from '@/lib/graphql/generated/graphql-base.types.ts';
import type {
    GetSourceMangasFetchMutation,
    GetSourceMangasFetchMutationVariables,
} from '@/lib/graphql/generated/graphql.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import type { SourceIdInfo } from '@/features/source/Source.types.ts';

export enum SourceHealth {
    CHECKING = 'checking',
    HEALTHY = 'healthy',
    NO_RESULTS = 'no_results',
    UNREACHABLE = 'unreachable',
}

export interface SourceHealthResult {
    health: SourceHealth;
    error?: string;
}

const MAX_SOURCES_IN_PARALLEL = 3;

/**
 * Probes each source by fetching the first page of its popular list.
 *
 * A request error means the source is unreachable (site dead, Cloudflare block, broken extension, ...).
 * An empty popular list is reported separately since it usually indicates a silently broken source.
 */
export const checkSourcesHealth = async (
    sourceIds: SourceIdInfo['id'][],
    onResult: (sourceId: SourceIdInfo['id'], result: SourceHealthResult) => void,
    signal: AbortSignal,
): Promise<void> => {
    const sourceQueue = pLimit(MAX_SOURCES_IN_PARALLEL);

    await Promise.allSettled(
        sourceIds.map((sourceId) =>
            sourceQueue(async () => {
                signal.throwIfAborted();

                try {
                    const response = await requestManager.graphQLClient.client.mutate<
                        GetSourceMangasFetchMutation,
                        GetSourceMangasFetchMutationVariables
                    >({
                        mutation: GET_SOURCE_MANGAS_FETCH,
                        variables: {
                            input: {
                                source: sourceId,
                                page: 1,
                                type: FetchSourceMangaType.Popular,
                            },
                        },
                        context: { fetchOptions: { signal } },
                    });

                    const mangas = response.data?.fetchSourceManga?.mangas ?? [];
                    onResult(sourceId, {
                        health: mangas.length ? SourceHealth.HEALTHY : SourceHealth.NO_RESULTS,
                    });
                } catch (error) {
                    if (signal.aborted) {
                        return;
                    }

                    onResult(sourceId, {
                        health: SourceHealth.UNREACHABLE,
                        error: getErrorMessage(error),
                    });
                }
            }),
        ),
    );
};
