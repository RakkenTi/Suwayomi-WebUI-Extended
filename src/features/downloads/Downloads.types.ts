/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export type MetadataDownloadSettings = {
    deleteChaptersManuallyMarkedRead: boolean;
    deleteChaptersWhileReading: number;
    deleteChaptersWithBookmark: boolean;
    downloadAheadLimit: number;
    /**
     * Whether decimal chapters (e.g. 10.5) should be skipped for download selection and the reader's next chapter
     * navigation in case their integer chapter (e.g. 10) exists.
     *
     * Can be overridden per manga via {@link ChapterListOptions#skipDecimalChapters}.
     */
    shouldSkipDecimalChapters: boolean;
    /**
     * Whether failed downloads whose chapter no longer exists at the source (e.g. due to a re-upload) should
     * automatically be recovered by refreshing the chapter list and downloading the replacement chapter instead.
     */
    shouldRecoverBrokenDownloads: boolean;
};
