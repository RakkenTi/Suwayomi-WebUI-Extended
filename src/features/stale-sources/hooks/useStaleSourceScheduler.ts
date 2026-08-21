/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useRef } from 'react';
import { d } from 'koration';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { StaleSourceChecker } from '@/features/stale-sources/services/StaleSourceChecker.ts';
import { useStaleSourceLibraryMangas } from '@/features/stale-sources/hooks/useStaleSourceLibraryMangas.ts';
import { STALE_SOURCE_SCHEDULER_INTERVAL } from '@/features/stale-sources/StaleSources.constants.ts';

const LEASE_STORAGE_KEY = 'stale_source_check_lease';
const LEASE_DURATION = d(10).minutes.inWholeMilliseconds;

/**
 * Prevents two open clients from spending the same daily budget twice. The lease is deliberately short lived so a
 * closed tab cannot block the check for long.
 */
const tryAcquireLease = (): boolean => {
    const lease = AppStorage.local.getItemParsed<number>(LEASE_STORAGE_KEY, 0);

    if (Date.now() - lease < LEASE_DURATION) {
        return false;
    }

    AppStorage.local.setItem(LEASE_STORAGE_KEY, Date.now());

    return true;
};

const releaseLease = (): void => {
    AppStorage.local.setItem(LEASE_STORAGE_KEY, 0);
};

/**
 * Keeps the rolling stale source check going while the client is open.
 *
 * The check is client side - there is no server side scheduler - so it runs on mount and then on an interval, always
 * bounded by the daily budget stored with the entries themselves.
 */
export const useStaleSourceScheduler = (): void => {
    const { settings } = useMetadataServerSettings();
    const isEnabled = settings.staleSourceCheckEnabled;

    const { mangas } = useStaleSourceLibraryMangas(!isEnabled);
    const hasMangas = !!mangas.length;

    const mangasRef = useRef(mangas);
    mangasRef.current = mangas;

    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    useEffect(() => {
        if (!isEnabled || !hasMangas) {
            return () => {};
        }

        const tick = async () => {
            if (StaleSourceChecker.isRunning() || !tryAcquireLease()) {
                return;
            }

            try {
                await StaleSourceChecker.run(mangasRef.current, settingsRef.current);
            } finally {
                releaseLease();
            }
        };

        tick().catch(defaultPromiseErrorHandler('useStaleSourceScheduler::tick'));

        const interval = setInterval(
            () => tick().catch(defaultPromiseErrorHandler('useStaleSourceScheduler::tick')),
            STALE_SOURCE_SCHEDULER_INTERVAL,
        );

        return () => clearInterval(interval);
    }, [isEnabled, hasMangas]);
};
