/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useStaleSourceScheduler } from '@/features/stale-sources/hooks/useStaleSourceScheduler.ts';

/**
 * Drives the rolling stale source check for as long as the client is open.
 */
export const StaleSourceCheckScheduler = () => {
    useStaleSourceScheduler();

    return null;
};
