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
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { useLingui } from '@lingui/react/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { translateExtensionLanguage, updateExtension } from '@/features/extension/Extensions.utils.ts';
import { ExtensionAction } from '@/features/extension/Extensions.types.ts';
import { MigrationManager } from '@/features/migration/MigrationManager.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Sources } from '@/features/source/services/Sources';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { SourceHealth, type SourceHealthResult } from '@/features/source/services/SourceHealthCheck.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
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
    ({
        source,
        health,
        onEntriesChanged,
    }: {
        source: TMigratableSource;
        health: SourceHealthResult | undefined;
        onEntriesChanged: () => void;
    }) => {
        const { id, name, lang, iconUrl, mangaCount, mangaIds, extension } = source;
        const { t } = useLingui();

        const sourceName = Sources.isLocalSource(source) ? t`Local source` : name;
        const isExtensionMissing = !extension;

        const startMigration = () => {
            MigrationManager.selectSources([id]);
            ReactRouter.navigate(AppRoutes.migrate.path);
        };

        const removeEntriesFromLibrary = async () => {
            try {
                await Mangas.removeFromLibrary(mangaIds);
                onEntriesChanged();
            } catch (e) {
                defaultPromiseErrorHandler('MigrationCard::removeEntriesFromLibrary')(e);
            }
        };

        const uninstallExtension = async () => {
            if (!extension) {
                return;
            }

            try {
                await updateExtension(extension.pkgName, extension.isObsolete, ExtensionAction.UNINSTALL);
                onEntriesChanged();
            } catch (e) {
                defaultPromiseErrorHandler('MigrationCard::uninstallExtension')(e);
            }
        };

        return (
            <Card>
                <Stack sx={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CardActionArea onClick={startMigration}>
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
                                        <Chip
                                            sx={{ borderRadius: 1 }}
                                            size="small"
                                            color="warning"
                                            label={t`Obsolete`}
                                        />
                                    </CustomTooltip>
                                )}
                                {health && <HealthChip health={health} />}
                                <Chip sx={{ borderRadius: 1 }} size="small" label={mangaCount} />
                            </Box>
                        </ListCardContent>
                    </CardActionArea>
                    <PopupState variant="popover" popupId={`migration-card-menu-${id}`}>
                        {(popupState) => (
                            <>
                                <CustomTooltip title={t`Options`}>
                                    <IconButton {...bindTrigger(popupState)} sx={{ mx: 0.5 }}>
                                        <MoreVertIcon />
                                    </IconButton>
                                </CustomTooltip>
                                <Menu {...bindMenu(popupState)}>
                                    <MenuItem
                                        onClick={() => {
                                            popupState.close();
                                            startMigration();
                                        }}
                                    >
                                        {t`Migrate entries`}
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            popupState.close();
                                            removeEntriesFromLibrary();
                                        }}
                                    >
                                        {t`Remove entries from library`}
                                    </MenuItem>
                                    {!isExtensionMissing && (
                                        <MenuItem
                                            onClick={() => {
                                                popupState.close();
                                                uninstallExtension();
                                            }}
                                        >
                                            {t`Uninstall extension`}
                                        </MenuItem>
                                    )}
                                </Menu>
                            </>
                        )}
                    </PopupState>
                </Stack>
            </Card>
        );
    },
);
