/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useLayoutEffect, useState } from 'react';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { StaleSourceChecker } from '@/features/stale-sources/services/StaleSourceChecker.ts';

/**
 * Progress indicator for a running stale source check.
 *
 * Mirrors the migration indicator: a running job gets a dismissible chip, while the persistent "entries are behind"
 * state is surfaced by the library toolbar instead.
 */
export const StaleSourceCheckIndicator = () => {
    const { t } = useLingui();
    const navigate = useNavigate();
    const location = useLocation();

    const isRunning = StaleSourceChecker.useIsRunning();
    const progress = StaleSourceChecker.useProgress();

    const [isVisible, setIsVisible] = useState(true);

    useLayoutEffect(() => {
        setIsVisible(true);
    }, [isRunning]);

    const staleSourcesPath = AppRoutes.settings.children.library.children.staleSources.path;

    if (!isRunning || !isVisible || location.pathname.startsWith(staleSourcesPath)) {
        return null;
    }

    return (
        <Chip
            icon={<CircularProgress size={16} color="inherit" />}
            label={t`Checking sources (${progress.completed}/${progress.total})`}
            color="primary"
            onClick={() => navigate(staleSourcesPath)}
            sx={{
                position: 'fixed',
                bottom: (theme) => theme.spacing(2),
                left: (theme) => theme.spacing(2),
                zIndex: (theme) => theme.zIndex.fab,
                cursor: 'pointer',
            }}
            onDelete={() => setIsVisible(false)}
        />
    );
};
