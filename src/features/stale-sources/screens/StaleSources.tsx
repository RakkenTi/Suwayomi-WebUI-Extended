/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { Collapsable } from '@/base/components/Collapsable.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { StaleSourceChecker } from '@/features/stale-sources/services/StaleSourceChecker.ts';
import { useStaleSourceLibraryMangas } from '@/features/stale-sources/hooks/useStaleSourceLibraryMangas.ts';
import { StaleSourceEntryCard } from '@/features/stale-sources/components/StaleSourceEntryCard.tsx';
import type { StaleSourceCheckableManga, StaleSourceCheckResult } from '@/features/stale-sources/StaleSources.types.ts';
import { StaleSourceVerdict } from '@/features/stale-sources/StaleSources.types.ts';
import {
    clearStaleSourceCheckResult,
    getStaleSourceCheckResult,
    ignoreStaleSourceForManga,
    isEntryBehindOtherSource,
} from '@/features/stale-sources/services/StaleSourceMetadata.ts';

type CheckedEntry = { manga: StaleSourceCheckableManga; result: StaleSourceCheckResult };

export const StaleSources = () => {
    const { t } = useLingui();

    const {
        settings,
        loading: areSettingsLoading,
        request: { error: settingsError, refetch: refetchSettings },
    } = useMetadataServerSettings();
    const { mangas, request } = useStaleSourceLibraryMangas();

    const isRunning = StaleSourceChecker.useIsRunning();
    const progress = StaleSourceChecker.useProgress();
    const activeMangaTitle = StaleSourceChecker.useActiveMangaTitle();

    const { behind, silentEverywhere, noMatch, failed, checkedCount } = useMemo(() => {
        const checkedEntries = mangas
            .map((manga) => ({ manga, result: getStaleSourceCheckResult(manga) }))
            .filter((entry): entry is CheckedEntry => !!entry.result);

        return {
            checkedCount: checkedEntries.length,
            behind: checkedEntries.filter((entry) => isEntryBehindOtherSource(entry.manga)),
            silentEverywhere: checkedEntries.filter(
                (entry) => entry.result.verdict === StaleSourceVerdict.UP_TO_DATE && !!entry.result.match,
            ),
            noMatch: checkedEntries.filter((entry) => entry.result.verdict === StaleSourceVerdict.NO_MATCH),
            failed: checkedEntries.filter((entry) => entry.result.verdict === StaleSourceVerdict.FAILED),
        };
    }, [mangas]);

    const remainingBudget = useMemo(() => StaleSourceChecker.getRemainingBudget(mangas, settings), [mangas, settings]);
    const candidateCount = useMemo(() => StaleSourceChecker.getCandidates(mangas, settings).length, [mangas, settings]);

    const startCheck = useCallback(() => {
        StaleSourceChecker.run(mangas, settings).catch((e) =>
            makeToast(t`Stale source check failed`, 'error', getErrorMessage(e)),
        );
    }, [mangas, settings]);

    const recheckEntry = useCallback(
        (manga: StaleSourceCheckableManga) => {
            StaleSourceChecker.enqueue([manga], mangas, settings).catch((e) =>
                makeToast(t`Stale source check failed`, 'error', getErrorMessage(e)),
            );
        },
        [mangas, settings],
    );

    useAppTitleAndAction(
        t`Stale sources`,
        <CustomTooltip title={isRunning ? t`Stop check` : t`Check now`}>
            <span>
                <IconButton
                    color="inherit"
                    disabled={
                        !settings.staleSourceCheckEnabled || (!isRunning && (!remainingBudget || !candidateCount))
                    }
                    onClick={() => (isRunning ? StaleSourceChecker.abort('user') : startCheck())}
                >
                    {isRunning ? <StopIcon /> : <PlayArrowIcon />}
                </IconButton>
            </span>
        </CustomTooltip>,
        [t, isRunning, remainingBudget, candidateCount, settings.staleSourceCheckEnabled, startCheck],
    );

    if (request.loading || areSettingsLoading) {
        return <LoadingPlaceholder />;
    }

    const error = request.error ?? settingsError;
    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t`Unable to load data`}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (request.error) {
                        request.refetch().catch(defaultPromiseErrorHandler('StaleSources::refetch'));
                    }

                    if (settingsError) {
                        refetchSettings().catch(defaultPromiseErrorHandler('StaleSources::refetchSettings'));
                    }
                }}
            />
        );
    }

    const renderEntries = (entries: CheckedEntry[]) =>
        entries.map(({ manga, result }) => (
            <Box key={manga.id} sx={{ mb: 1 }}>
                <StaleSourceEntryCard
                    manga={manga}
                    result={result}
                    isCheckDisabled={StaleSourceChecker.isQueued(manga.id)}
                    onRecheck={() => recheckEntry(manga)}
                    onIgnoreSource={() => {
                        if (!result.match) {
                            return;
                        }

                        ignoreStaleSourceForManga(manga, result.match.sourceId).catch((e) =>
                            makeToast(t`Could not save changes`, 'error', getErrorMessage(e)),
                        );
                    }}
                    onClearResult={() => {
                        clearStaleSourceCheckResult(manga).catch((e) =>
                            makeToast(t`Could not save changes`, 'error', getErrorMessage(e)),
                        );
                    }}
                />
            </Box>
        ));

    return (
        <Stack sx={{ p: 1, gap: 2 }}>
            <Stack sx={{ gap: 0.5 }}>
                <Typography variant="body2" color="textSecondary">
                    {t`${checkedCount} of ${mangas.length} entries checked · ${candidateCount} due · ${remainingBudget} checks left today`}
                </Typography>
                {!settings.staleSourceCheckEnabled && (
                    <Typography variant="body2" color="warning.main">
                        {t`The rolling check is disabled. Enable it in the library settings or start a check manually.`}
                    </Typography>
                )}
                {isRunning && (
                    <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="textSecondary">
                            {t`Checking ${activeMangaTitle ?? ''} (${progress.completed}/${progress.total})`}
                        </Typography>
                    </Stack>
                )}
            </Stack>

            {!behind.length && !checkedCount && (
                <EmptyViewAbsoluteCentered
                    message={t`No entry has been checked yet`}
                    messageExtra={t`Entries are checked a few at a time once they have been silent for a while.`}
                />
            )}

            {!!behind.length && (
                <Stack sx={{ gap: 1 }}>
                    <Typography variant="h6">
                        {plural(behind.length, {
                            one: '# entry is behind another source',
                            other: '# entries are behind another source',
                        })}
                    </Typography>
                    {renderEntries(behind)}
                </Stack>
            )}

            {!!silentEverywhere.length && (
                <Collapsable
                    header={t`Silent on every source (${silentEverywhere.length})`}
                    collapse={renderEntries(silentEverywhere)}
                    initialState={false}
                />
            )}

            {!!noMatch.length && (
                <Collapsable
                    header={t`No other source has the entry (${noMatch.length})`}
                    collapse={renderEntries(noMatch)}
                    initialState={false}
                />
            )}

            {!!failed.length && (
                <Collapsable
                    header={t`Checks that failed (${failed.length})`}
                    collapse={renderEntries(failed)}
                    initialState={false}
                />
            )}
        </Stack>
    );
};
