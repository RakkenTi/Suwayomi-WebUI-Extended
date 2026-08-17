/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { t } from '@lingui/core/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DownloadUpdateType } from '@/lib/graphql/generated/graphql-base.types.ts';
import type { DownloadStatusSubscription } from '@/lib/graphql/generated/graphql.ts';
import { getMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';

type TDownloadUpdates = DownloadStatusSubscription['downloadStatusChanged'];
type TErroredDownload = TDownloadUpdates['updates'][number]['download'];

const handledChapterIds = new Set<number>();

/**
 * Sources sometimes delete and re-upload chapters. The server's chapter entry then points at a dead upload whose
 * download fails partway through once its images got purged. Refreshing the chapter list replaces the entry with the
 * new upload, for which the download succeeds again.
 */
const recoverBrokenDownload = async (download: TErroredDownload): Promise<void> => {
    const { chapter, manga } = download;

    const { shouldRecoverBrokenDownloads } = await getMetadataServerSettings();
    if (!shouldRecoverBrokenDownloads) {
        return;
    }

    const refreshedManga = await requestManager.refreshManga(manga.id, { fetchManga: false }).response;
    const refreshedChapters = refreshedManga.data?.fetchMangaAndChapters?.chapters ?? [];

    const doesChapterStillExist = refreshedChapters.some(({ id }) => id === chapter.id);
    if (doesChapterStillExist) {
        // the source still lists the exact same chapter - the download failure has a different cause
        return;
    }

    await requestManager.removeChapterFromDownloadQueue(chapter.id).response;

    const replacementChapter =
        refreshedChapters.find(
            ({ chapterNumber, scanlator }) =>
                chapterNumber === chapter.chapterNumber && scanlator === chapter.scanlator,
        ) ?? refreshedChapters.find(({ chapterNumber }) => chapterNumber === chapter.chapterNumber);

    if (!replacementChapter) {
        makeToast(t`"${chapter.name}" (${manga.title}) no longer exists at the source`, 'warning');
        return;
    }

    await requestManager.addChapterToDownloadQueue(replacementChapter.id).response;
    await requestManager.startDownloads().response;

    makeToast(t`Re-queued "${chapter.name}" (${manga.title}) for its updated chapter entry`, 'info');
};

export const useBrokenDownloadRecovery = (downloadUpdates: TDownloadUpdates | undefined): void => {
    useEffect(() => {
        const erroredDownloads = (downloadUpdates?.updates ?? []).filter(
            ({ type }) => type === DownloadUpdateType.Error,
        );

        erroredDownloads.forEach(({ download }) => {
            const isAlreadyHandled = handledChapterIds.has(download.chapter.id);
            if (isAlreadyHandled) {
                return;
            }
            handledChapterIds.add(download.chapter.id);

            recoverBrokenDownload(download).catch((e) => {
                defaultPromiseErrorHandler('useBrokenDownloadRecovery')(e);
                makeToast(t`Failed to recover broken download`, 'error', getErrorMessage(e));
            });
        });
    }, [downloadUpdates]);
};
