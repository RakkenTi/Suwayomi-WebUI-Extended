/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useLingui } from '@lingui/react/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { translateExtensionLanguage } from '@/features/extension/Extensions.utils.ts';
import { MigrationManager } from '@/features/migration/MigrationManager.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Sources } from '@/features/source/services/Sources';
import { SourceHealth, type SourceHealthResult } from '@/features/source/services/SourceHealthCheck.ts';
import type { TMigratableSource } from '@/features/migration/Migration.types.ts';
import { ReactRouter } from '@/lib/react-router/ReactRouter.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { memo } from 'react';

const HealthChip = ({ health }: { health: SourceHealthResult }) => {
    const { t } = useLingui();

    switch (health.health) {
        case SourceHealth.CHECKING:
            return <CircularProgress size={16} />;
        case SourceHealth.HEALTHY:
            return <Chip sx={{ borderRadius: 1 }} size="small" color="success" variant="outlined" label={t`OK`} />;
        case SourceHealth.NO_RESULTS:
            return <Chip sx={{ borderRadius: 1 }} size="small" color="warning" label={t`No results`} />;
        case SourceHealth.UNREACHABLE:
            return (
                <CustomTooltip title={health.error ?? ''}>
                    <Chip sx={{ borderRadius: 1 }} size="small" color="error" label={t`Unreachable`} />
                </CustomTooltip>
            );
        default:
            return null;
    }
};

export const MigrationCard = memo(
    ({ source, health }: { source: TMigratableSource; health: SourceHealthResult | undefined }) => {
        const { id, name, lang, iconUrl, mangaCount, extension } = source;
        const { t } = useLingui();

        const sourceName = Sources.isLocalSource(source) ? t`Local source` : name;
        const isExtensionMissing = !extension;

        return (
            <Card>
                <CardActionArea
                    onClick={() => {
                        MigrationManager.selectSources([id]);
                        ReactRouter.navigate(AppRoutes.migrate.path);
                    }}
                >
                    <ListCardContent sx={{ justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <ListCardAvatar
                                iconUrl={requestManager.getValidImgUrlFor(iconUrl)}
                                alt={sourceName}
                                slots={{
                                    spinnerImageProps: {
                                        ignoreQueue: true,
                                    },
                                }}
                            />
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Typography variant="h6" component="h3">
                                    {sourceName}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        display: 'block',
                                    }}
                                >
                                    {translateExtensionLanguage(lang)}
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isExtensionMissing && (
                                <CustomTooltip title={t`The extension of this source is not installed`}>
                                    <Chip
                                        sx={{ borderRadius: 1 }}
                                        size="small"
                                        color="error"
                                        label={t`Not installed`}
                                    />
                                </CustomTooltip>
                            )}
                            {extension?.isObsolete && (
                                <CustomTooltip title={t`The extension of this source was removed from its repo`}>
                                    <Chip sx={{ borderRadius: 1 }} size="small" color="warning" label={t`Obsolete`} />
                                </CustomTooltip>
                            )}
                            {health && <HealthChip health={health} />}
                            <Chip sx={{ borderRadius: 1 }} size="small" label={mangaCount} />
                        </Box>
                    </ListCardContent>
                </CardActionArea>
            </Card>
        );
    },
);
