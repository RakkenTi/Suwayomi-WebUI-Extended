/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import pLimit from 'p-limit';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { d } from 'koration';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { ZustandUtil } from '@/lib/zustand/ZustandUtil.ts';
import { searchSourceForMangaTitle, SourceRequestQueue } from '@/features/source/services/SourceMangaSearch.ts';
import type { SourceIdInfo } from '@/features/source/Source.types.ts';
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import type {
    MetadataStaleSourceSettings,
    StaleSourceCheckableManga,
    StaleSourceCheckResult,
    StaleSourceMatch,
    StaleSourceProgress,
} from '@/features/stale-sources/StaleSources.types.ts';
import { StaleSourceVerdict } from '@/features/stale-sources/StaleSources.types.ts';
import {
    MAX_STALE_SOURCE_CHECKS_IN_PARALLEL,
    STALE_SOURCE_BUDGET_WINDOW,
    STALE_SOURCE_FINISHED_MANGA_STATUSES,
} from '@/features/stale-sources/StaleSources.constants.ts';
import {
    getStaleSourceMetadata,
    setStaleSourceCheckResult,
} from '@/features/stale-sources/services/StaleSourceMetadata.ts';

/**
 * A failed check is retried much sooner than a successful one - a failure usually means the server or a source was
 * temporarily unavailable, which should not silence an entry for the full re-check interval.
 */
const FAILED_CHECK_RETRY_DELAY = d(1).days.inWholeMilliseconds;

type QueuedCheck = {
    manga: StaleSourceCheckableManga;
    libraryMangas: StaleSourceCheckableManga[];
    settings: MetadataStaleSourceSettings;
};

type StaleSourceCheckerState = {
    isRunning: boolean;
    activeMangaTitle: string | null;
    progress: StaleSourceProgress;
    lastRunAt: number | null;
    lastError: string | null;
};

const DEFAULT_STATE: StaleSourceCheckerState = {
    isRunning: false,
    activeMangaTitle: null,
    progress: { total: 0, completed: 0 },
    lastRunAt: null,
    lastError: null,
};

const checkerStore = create<StaleSourceCheckerState>()(devtools(immer(() => ({ ...DEFAULT_STATE }))));

const useCheckerStore = ZustandUtil.createStoreHook(checkerStore);

const toDays = (days: number): number => d(days).days.inWholeMilliseconds;

/**
 * Rolling check for library entries whose source stopped receiving chapters.
 *
 * Instead of sweeping the whole library it walks it over time: every run picks the entries that have been silent the
 * longest and have not been checked recently, bounded by a daily budget. The budget is derived from the entries'
 * stored check timestamps, so it is shared across devices without extra bookkeeping.
 */
export class StaleSourceChecker {
    private static abortController: AbortController | null = null;

    private static pendingChecks: QueuedCheck[] = [];

    /** Entries queued or in flight - prevents queueing the same entry twice. */
    private static queuedMangaIds = new Set<MangaIdInfo['id']>();

    private static drainPromise: Promise<void> | null = null;

    static getState(): StaleSourceCheckerState {
        return checkerStore.getState();
    }

    private static updateState(updater: (draft: StaleSourceCheckerState) => void): void {
        checkerStore.setState(updater);
    }

    static isRunning(): boolean {
        return StaleSourceChecker.getState().isRunning;
    }

    static abort(reason: unknown = 'aborted'): void {
        StaleSourceChecker.pendingChecks = [];
        StaleSourceChecker.abortController?.abort(reason);
        StaleSourceChecker.abortController = null;
    }

    static isQueued(mangaId: MangaIdInfo['id']): boolean {
        return StaleSourceChecker.queuedMangaIds.has(mangaId);
    }

    /**
     * Sources the entry may be compared against: every source the library uses, minus the entry's own one and the
     * ones dismissed for this entry.
     */
    static getDestinationSourceIds(
        manga: StaleSourceCheckableManga,
        mangas: StaleSourceCheckableManga[],
    ): SourceIdInfo['id'][] {
        const { staleSourceIgnoredSourceIds } = getStaleSourceMetadata(manga);

        const librarySourceIds = new Set(
            mangas.filter((libraryManga) => !!libraryManga.source).map((libraryManga) => libraryManga.sourceId),
        );

        return [...librarySourceIds].filter(
            (sourceId) => sourceId !== manga.sourceId && !staleSourceIgnoredSourceIds.includes(sourceId),
        );
    }

    private static isCheckDue(manga: StaleSourceCheckableManga, recheckDays: number, now: number): boolean {
        const { staleSourceCheck } = getStaleSourceMetadata(manga);

        if (!staleSourceCheck) {
            return true;
        }

        const age = now - staleSourceCheck.checkedAt;
        const isFailedCheck = staleSourceCheck.verdict === StaleSourceVerdict.FAILED;

        return age >= (isFailedCheck ? FAILED_CHECK_RETRY_DELAY : toDays(recheckDays));
    }

    /**
     * Entries that are worth spending source requests on: still releasing according to the source, but silent for a
     * while (or without any chapter at all), and not checked recently.
     */
    static getCandidates(
        mangas: StaleSourceCheckableManga[],
        { staleSourceSilentDays, staleSourceRecheckDays }: MetadataStaleSourceSettings,
        now: number = Date.now(),
    ): StaleSourceCheckableManga[] {
        const silentThreshold = toDays(staleSourceSilentDays);

        return mangas
            .filter((manga) => {
                if (!manga.inLibrary) {
                    return false;
                }

                if (manga.status && STALE_SOURCE_FINISHED_MANGA_STATUSES.includes(manga.status)) {
                    return false;
                }

                const hasNoChapters = !manga.chapters.totalCount;
                const lastUploadedAt = Number(manga.latestUploadedChapter?.uploadDate ?? 0);
                const isSilent = now - lastUploadedAt >= silentThreshold;

                if (!hasNoChapters && !isSilent) {
                    return false;
                }

                return StaleSourceChecker.isCheckDue(manga, staleSourceRecheckDays, now);
            })
            .toSorted((a, b) => {
                const checkedAtA = getStaleSourceMetadata(a).staleSourceCheck?.checkedAt ?? 0;
                const checkedAtB = getStaleSourceMetadata(b).staleSourceCheck?.checkedAt ?? 0;

                if (checkedAtA !== checkedAtB) {
                    return checkedAtA - checkedAtB;
                }

                const uploadedAtA = Number(a.latestUploadedChapter?.uploadDate ?? 0);
                const uploadedAtB = Number(b.latestUploadedChapter?.uploadDate ?? 0);

                return uploadedAtA - uploadedAtB;
            });
    }

    /**
     * How many entries may still be checked within the current rolling window.
     */
    static getRemainingBudget(
        mangas: StaleSourceCheckableManga[],
        { staleSourceChecksPerDay }: MetadataStaleSourceSettings,
        now: number = Date.now(),
    ): number {
        const checksInWindow = mangas.filter((manga) => {
            const { staleSourceCheck } = getStaleSourceMetadata(manga);

            return !!staleSourceCheck && now - staleSourceCheck.checkedAt < STALE_SOURCE_BUDGET_WINDOW;
        }).length;

        return Math.max(0, staleSourceChecksPerDay - checksInWindow);
    }

    /**
     * Re-fetches the entry from its own source so the comparison is made against what the source currently offers
     * instead of a potentially outdated local copy.
     */
    private static async refreshOwnEntry(
        manga: StaleSourceCheckableManga,
        signal: AbortSignal,
    ): Promise<number | null> {
        try {
            const response = await SourceRequestQueue.getSourceQueue(manga.sourceId)(
                () =>
                    requestManager.refreshManga(manga.id, {
                        awaitRefetchQueries: true,
                        context: { fetchOptions: { signal } },
                    }).response,
            );

            const refreshedManga = response.data?.fetchMangaAndChapters?.manga;

            if (refreshedManga) {
                return refreshedManga.highestNumberedChapter?.chapterNumber ?? null;
            }
        } catch (e) {
            // the entry's own source being unreachable is itself a finding - fall back to the stored chapter number
        }

        return manga.highestNumberedChapter?.chapterNumber ?? null;
    }

    /**
     * Searches every destination source for the entry and reports the source that carries the most chapters.
     */
    static async checkEntry(
        manga: StaleSourceCheckableManga,
        destinationSourceIds: SourceIdInfo['id'][],
        settings: MetadataStaleSourceSettings,
        signal: AbortSignal,
    ): Promise<StaleSourceCheckResult> {
        signal.throwIfAborted();

        const ownLatestChapterNumber = await StaleSourceChecker.refreshOwnEntry(manga, signal);

        const searchResults = await Promise.allSettled(
            destinationSourceIds.map((sourceId) =>
                SourceRequestQueue.getParallelSourceQueue()(async () => {
                    signal.throwIfAborted();

                    const matches = await searchSourceForMangaTitle(sourceId, manga.title, signal, {
                        excludeMangaId: manga.id,
                    });

                    return { sourceId, matches };
                }),
            ),
        );

        const successfulSearches = searchResults
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value);

        if (!successfulSearches.length && destinationSourceIds.length) {
            const failureReasons = searchResults.map((result) =>
                getErrorMessage((result as PromiseRejectedResult).reason),
            );

            return {
                checkedAt: Date.now(),
                verdict: StaleSourceVerdict.FAILED,
                latestChapterNumber: ownLatestChapterNumber,
                match: null,
                checkedSourceIds: destinationSourceIds,
                error: [...new Set(failureReasons)].join('\n'),
            };
        }

        const checkedSourceIds = successfulSearches.map(({ sourceId }) => sourceId);

        const bestMatch = successfulSearches
            .flatMap(({ sourceId, matches }) =>
                matches.map(
                    ({ manga: matchedManga }): StaleSourceMatch => ({
                        sourceId,
                        sourceName: matchedManga.source?.displayName ?? sourceId,
                        mangaId: matchedManga.id,
                        title: matchedManga.title,
                        latestChapterNumber: matchedManga.highestNumberedChapter?.chapterNumber ?? 0,
                    }),
                ),
            )
            .reduce<StaleSourceMatch | null>(
                (best, match) => (!best || match.latestChapterNumber > best.latestChapterNumber ? match : best),
                null,
            );

        if (!bestMatch) {
            return {
                checkedAt: Date.now(),
                verdict: StaleSourceVerdict.NO_MATCH,
                latestChapterNumber: ownLatestChapterNumber,
                match: null,
                checkedSourceIds,
            };
        }

        const verdict = (() => {
            if (ownLatestChapterNumber == null) {
                return bestMatch.latestChapterNumber > 0
                    ? StaleSourceVerdict.NO_CHAPTERS
                    : StaleSourceVerdict.UP_TO_DATE;
            }

            const isBehind =
                bestMatch.latestChapterNumber >= ownLatestChapterNumber + settings.staleSourceMinChapterDelta;

            return isBehind ? StaleSourceVerdict.BEHIND : StaleSourceVerdict.UP_TO_DATE;
        })();

        return {
            checkedAt: Date.now(),
            verdict,
            latestChapterNumber: ownLatestChapterNumber,
            match: bestMatch,
            checkedSourceIds,
        };
    }

    /**
     * Checks one queued entry and stores the result in its metadata.
     */
    private static async processQueuedCheck(
        { manga, libraryMangas, settings }: QueuedCheck,
        signal: AbortSignal,
    ): Promise<void> {
        signal.throwIfAborted();

        StaleSourceChecker.updateState((draft) => {
            draft.activeMangaTitle = manga.title;
        });

        try {
            const destinationSourceIds = StaleSourceChecker.getDestinationSourceIds(manga, libraryMangas);

            const result = await StaleSourceChecker.checkEntry(manga, destinationSourceIds, settings, signal);

            await setStaleSourceCheckResult(manga, result);
        } catch (e) {
            if (signal.aborted) {
                throw e;
            }

            await setStaleSourceCheckResult(manga, {
                checkedAt: Date.now(),
                verdict: StaleSourceVerdict.FAILED,
                latestChapterNumber: manga.highestNumberedChapter?.chapterNumber ?? null,
                match: null,
                checkedSourceIds: [],
                error: getErrorMessage(e),
            });
        } finally {
            StaleSourceChecker.queuedMangaIds.delete(manga.id);

            StaleSourceChecker.updateState((draft) => {
                draft.progress.completed += 1;
            });
        }
    }

    /**
     * Works through the queue until it runs dry. Entries added while a batch is in flight are picked up by the next
     * iteration instead of starting a second run.
     */
    private static async drain(): Promise<void> {
        const abortController = new AbortController();
        StaleSourceChecker.abortController = abortController;
        const { signal } = abortController;

        StaleSourceChecker.updateState((draft) => {
            draft.isRunning = true;
            draft.lastError = null;
            draft.activeMangaTitle = null;
        });

        try {
            while (StaleSourceChecker.pendingChecks.length && !signal.aborted) {
                const batch = StaleSourceChecker.pendingChecks.splice(0, StaleSourceChecker.pendingChecks.length);
                const checkQueue = pLimit(MAX_STALE_SOURCE_CHECKS_IN_PARALLEL);

                // oxlint-disable-next-line no-await-in-loop
                await Promise.allSettled(
                    batch.map((queuedCheck) =>
                        checkQueue(() => StaleSourceChecker.processQueuedCheck(queuedCheck, signal)),
                    ),
                );
            }
        } catch (e) {
            StaleSourceChecker.updateState((draft) => {
                draft.lastError = getErrorMessage(e);
            });
        } finally {
            StaleSourceChecker.abortController = null;
            StaleSourceChecker.pendingChecks = [];
            StaleSourceChecker.queuedMangaIds.clear();

            StaleSourceChecker.updateState((draft) => {
                draft.isRunning = false;
                draft.activeMangaTitle = null;
                draft.lastRunAt = Date.now();
                draft.progress = { total: 0, completed: 0 };
            });
        }
    }

    /**
     * Queues entries for a check, ignoring the candidate filters and the daily budget.
     *
     * Entries already queued or in flight are skipped, so triggering the same entry twice does not check it twice.
     * The returned promise resolves once the whole queue - not just these entries - has been worked through.
     */
    static enqueue(
        entries: StaleSourceCheckableManga[],
        libraryMangas: StaleSourceCheckableManga[],
        settings: MetadataStaleSourceSettings,
    ): Promise<void> {
        const newEntries = entries.filter((manga) => !StaleSourceChecker.queuedMangaIds.has(manga.id));

        if (newEntries.length) {
            newEntries.forEach((manga) => StaleSourceChecker.queuedMangaIds.add(manga.id));
            StaleSourceChecker.pendingChecks.push(...newEntries.map((manga) => ({ manga, libraryMangas, settings })));

            StaleSourceChecker.updateState((draft) => {
                draft.progress.total += newEntries.length;
            });
        }

        if (!StaleSourceChecker.drainPromise) {
            StaleSourceChecker.drainPromise = StaleSourceChecker.drain().finally(() => {
                StaleSourceChecker.drainPromise = null;
            });
        }

        return StaleSourceChecker.drainPromise;
    }

    /**
     * Queues one rolling batch. Does nothing when the budget is used up or no entry is due for a check.
     *
     * @param limit overrides the remaining daily budget - used by the manual "check now" action.
     */
    static async run(
        mangas: StaleSourceCheckableManga[],
        settings: MetadataStaleSourceSettings,
        limit?: number,
    ): Promise<void> {
        const budget = limit ?? StaleSourceChecker.getRemainingBudget(mangas, settings);
        if (budget <= 0) {
            return;
        }

        const entriesToCheck = StaleSourceChecker.getCandidates(mangas, settings).slice(0, budget);
        if (!entriesToCheck.length) {
            return;
        }

        await StaleSourceChecker.enqueue(entriesToCheck, mangas, settings);
    }

    static useIsRunning(): boolean {
        return useCheckerStore((state) => state.isRunning);
    }

    static useProgress(): StaleSourceProgress {
        return useCheckerStore((state) => state.progress);
    }

    static useActiveMangaTitle(): string | null {
        return useCheckerStore((state) => state.activeMangaTitle);
    }
}
