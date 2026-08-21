/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import { Link } from 'react-router-dom';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useEntriesBehindOtherSource } from '@/features/stale-sources/hooks/useStaleSourceLibraryMangas.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';

/**
 * Entry point to the stale source results.
 *
 * Only rendered while at least one entry is known to be behind another source - an empty result set should not add
 * permanent noise to the library toolbar.
 */
export const StaleSourceToolbarButton = () => {
    const { t } = useLingui();

    const {
        settings: { staleSourceCheckEnabled },
    } = useMetadataServerSettings();

    const entriesBehind = useEntriesBehindOtherSource(!staleSourceCheckEnabled);

    if (!entriesBehind.length) {
        return null;
    }

    return (
        <CustomTooltip
            title={plural(entriesBehind.length, {
                one: '# entry is behind another source',
                other: '# entries are behind another source',
            })}
        >
            <IconButton
                component={Link}
                to={AppRoutes.settings.children.library.children.staleSources.path}
                color="inherit"
                aria-label={t`Stale sources`}
            >
                <Badge badgeContent={entriesBehind.length} color="warning">
                    <NewReleasesIcon />
                </Badge>
            </IconButton>
        </CustomTooltip>
    );
};
