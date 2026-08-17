/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import TagIcon from '@mui/icons-material/Tag';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CancelIcon from '@mui/icons-material/Cancel';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { MigrationCard } from '@/features/migration/components/MigrationCard.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { sortByToTranslation, sortOrderToTranslation } from '@/features/migration/Migration.constants.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { Sources } from '@/features/source/services/Sources';
import {
    checkSourcesHealth,
    SourceHealth,
    type SourceHealthResult,
} from '@/features/source/services/SourceHealthCheck.ts';
import type { SourceIdInfo } from '@/features/source/Source.types.ts';
import { OffsetComponent } from '@/base/OffsetComponent.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { MigrationManager } from '@/features/migration/MigrationManager.ts';
import { ReactRouter } from '@/lib/react-router/ReactRouter.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { GET_MIGRATABLE_SOURCE_MANGAS } from '@/lib/graphql/manga/MangaQuery.ts';
import type {
    GetMigratableSourceMangasQuery,
    GetMigratableSourceMangasQueryVariables,
} from '@/lib/graphql/generated/graphql.ts';
import { MangaOrderBy, SortOrder as GqlSortOrder } from '@/lib/graphql/generated/graphql-base.types.ts';

export const MigrationSelectSource = () => {
    const { t } = useLingui();

    const {
        settings: { migrateSortSettings },
    } = useMetadataServerSettings();
    const updateMetadataServerSettings = createUpdateMetadataServerSettings<'migrateSortSettings'>((e) =>
        makeToast(t`Failed to save changes`, 'error', getErrorMessage(e)),
    );

    const { sortBy, sortOrder } = migrateSortSettings;

    const {
        sources: migratableSources,
        request: { loading, error, refetch },
    } = Sources.useGetMigratableSources(migrateSortSettings);

    const [healthBySourceId, setHealthBySourceId] = useState<Record<SourceIdInfo['id'], SourceHealthResult>>({});
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const healthCheckAbortRef = useRef<AbortController>(null);

    useEffect(() => () => healthCheckAbortRef.current?.abort(), []);

    const startHealthCheck = () => {
        const abortController = new AbortController();
        healthCheckAbortRef.current = abortController;

        const sourceIds = migratableSources
            .filter((source) => !!source.extension && !Sources.isLocalSource(source))
            .map(({ id }) => id);

        setHealthBySourceId(
            Object.fromEntries(sourceIds.map((sourceId) => [sourceId, { health: SourceHealth.CHECKING }])),
        );
        setIsCheckingHealth(true);

        let brokenSourcesCount = 0;
        checkSourcesHealth(
            sourceIds,
            (sourceId, result) => {
                brokenSourcesCount += Number(result.health !== SourceHealth.HEALTHY);
                setHealthBySourceId((prevHealthBySourceId) => ({ ...prevHealthBySourceId, [sourceId]: result }));
            },
            abortController.signal,
        ).finally(() => {
            if (abortController.signal.aborted) {
                return;
            }

            setIsCheckingHealth(false);
            makeToast(
                brokenSourcesCount ? t`Some sources are broken or unreachable` : t`All sources are reachable`,
                brokenSourcesCount ? 'warning' : 'success',
            );
        });
    };

    const stopHealthCheck = () => {
        healthCheckAbortRef.current?.abort();
        setIsCheckingHealth(false);
        setHealthBySourceId((prevHealthBySourceId) =>
            Object.fromEntries(
                Object.entries(prevHealthBySourceId).filter(([, result]) => result.health !== SourceHealth.CHECKING),
            ),
        );
    };

    const deadSources = useMemo(
        () =>
            migratableSources.filter(
                (source) =>
                    !Sources.isLocalSource(source) &&
                    (!source.extension ||
                        source.extension.isObsolete ||
                        healthBySourceId[source.id]?.health === SourceHealth.UNREACHABLE ||
                        healthBySourceId[source.id]?.health === SourceHealth.NO_RESULTS),
            ),
        [migratableSources, healthBySourceId],
    );

    const [isPreparingDeadSourceMigration, setIsPreparingDeadSourceMigration] = useState(false);

    const migrateDeadSources = async () => {
        if (MigrationManager.isActive()) {
            makeToast(t`A migration is already in progress`, 'error');
            return;
        }

        setIsPreparingDeadSourceMigration(true);
        try {
            const { data } = await requestManager.graphQLClient.client.query<
                GetMigratableSourceMangasQuery,
                GetMigratableSourceMangasQueryVariables
            >({
                query: GET_MIGRATABLE_SOURCE_MANGAS,
                variables: {
                    condition: { inLibrary: true },
                    filter: { sourceId: { in: deadSources.map(({ id }) => id) } },
                    order: [
                        { by: MangaOrderBy.Title, byType: GqlSortOrder.Asc },
                        { by: MangaOrderBy.InLibraryAt, byType: GqlSortOrder.Desc },
                    ],
                },
                fetchPolicy: 'network-only',
            });

            const mangas = data?.mangas.nodes ?? [];
            if (!mangas.length) {
                return;
            }

            MigrationManager.selectSources(deadSources.map(({ id }) => id));
            MigrationManager.selectMangas(mangas);

            const isBulkMigration = mangas.length > 1;
            if (isBulkMigration) {
                ReactRouter.navigate(AppRoutes.migrate.path);
            }
        } catch (e) {
            makeToast(t`Unable to load data`, 'error', getErrorMessage(e));
        } finally {
            setIsPreparingDeadSourceMigration(false);
        }
    };

    if (loading) {
        return <LoadingPlaceholder />;
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t`Unable to load data`}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('Migration::refetch'))}
            />
        );
    }

    return (
        <>
            <OffsetComponent>
                <Stack
                    sx={{
                        flexDirection: 'row',
                        justifyContent: 'end',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        backgroundColor: 'background.default',
                    }}
                >
                    {!!deadSources.length && !isCheckingHealth && (
                        <Button
                            size="small"
                            startIcon={
                                isPreparingDeadSourceMigration ? <CircularProgress size={16} /> : <AutoFixHighIcon />
                            }
                            disabled={isPreparingDeadSourceMigration}
                            onClick={migrateDeadSources}
                        >
                            {t`Migrate dead sources (${deadSources.length})`}
                        </Button>
                    )}
                    <CustomTooltip title={isCheckingHealth ? t`Stop health check` : t`Check source health`}>
                        <IconButton
                            color="inherit"
                            onClick={() => (isCheckingHealth ? stopHealthCheck() : startHealthCheck())}
                        >
                            {isCheckingHealth ? <CancelIcon /> : <TroubleshootIcon />}
                        </IconButton>
                    </CustomTooltip>
                    <CustomTooltip title={t(sortByToTranslation[sortBy])}>
                        <IconButton
                            color="inherit"
                            onClick={() =>
                                updateMetadataServerSettings('migrateSortSettings', {
                                    sortBy: (sortBy + 1) % 2,
                                    sortOrder,
                                })
                            }
                        >
                            {sortBy ? <TagIcon /> : <SortByAlphaIcon />}
                        </IconButton>
                    </CustomTooltip>
                    <CustomTooltip title={t(sortOrderToTranslation[sortOrder])}>
                        <IconButton
                            color="inherit"
                            onClick={() =>
                                updateMetadataServerSettings('migrateSortSettings', {
                                    sortBy,
                                    sortOrder: (sortOrder + 1) % 2,
                                })
                            }
                        >
                            {sortOrder ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
                        </IconButton>
                    </CustomTooltip>
                </Stack>
            </OffsetComponent>

            <List sx={{ p: 0 }}>
                {migratableSources.map((migratableSource) => (
                    <StyledGroupItemWrapper key={migratableSource.id}>
                        <MigrationCard
                            source={migratableSource}
                            health={healthBySourceId[migratableSource.id]}
                            onEntriesChanged={() =>
                                refetch().catch(defaultPromiseErrorHandler('MigrationSelectSource::refetch'))
                            }
                        />
                    </StyledGroupItemWrapper>
                ))}
            </List>
        </>
    );
};
