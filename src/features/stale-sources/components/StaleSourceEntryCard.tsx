/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import PopupState, { bindMenu, bindTrigger } from 'material-ui-popup-state';
import { Link as RouterLink } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { ListCardAvatar } from '@/base/components/lists/cards/ListCardAvatar.tsx';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { getDateString } from '@/base/utils/DateHelper.ts';
import type { StaleSourceCheckableManga, StaleSourceCheckResult } from '@/features/stale-sources/StaleSources.types.ts';
import { StaleSourceVerdict } from '@/features/stale-sources/StaleSources.types.ts';
import { STALE_SOURCE_VERDICT_TRANSLATION } from '@/features/stale-sources/StaleSources.constants.ts';

const ChapterComparison = ({ result, ownSourceName }: { result: StaleSourceCheckResult; ownSourceName: string }) => {
    const { t } = useLingui();

    const ownChapter = result.latestChapterNumber;
    const { match } = result;

    if (!match) {
        return null;
    }

    const delta = ownChapter == null ? null : match.latestChapterNumber - ownChapter;

    return (
        <Stack sx={{ gap: 0.25 }}>
            <Typography variant="body2" color="textSecondary">
                {ownChapter == null ? t`${ownSourceName}: no chapters` : t`${ownSourceName}: chapter ${ownChapter}`}
            </Typography>
            <Typography variant="body2" color="warning.main">
                {t`${match.sourceName}: chapter ${match.latestChapterNumber}`}
                {delta != null && delta > 0 ? ` (+${Number(delta.toFixed(2))})` : ''}
            </Typography>
        </Stack>
    );
};

export const StaleSourceEntryCard = memo(
    ({
        manga,
        result,
        onIgnoreSource,
        onRecheck,
        onClearResult,
        isCheckDisabled,
    }: {
        manga: StaleSourceCheckableManga;
        result: StaleSourceCheckResult;
        onIgnoreSource: () => void;
        onRecheck: () => void;
        onClearResult: () => void;
        isCheckDisabled: boolean;
    }) => {
        const { t } = useLingui();

        const ownSourceName = manga.source?.displayName ?? manga.sourceId;
        const isBehind =
            result.verdict === StaleSourceVerdict.BEHIND || result.verdict === StaleSourceVerdict.NO_CHAPTERS;

        return (
            <Card>
                <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Link component={RouterLink} to={AppRoutes.manga.path(manga.id)}>
                        <ListCardAvatar
                            iconUrl={Mangas.getThumbnailUrl(manga)}
                            alt={manga.title}
                            slots={{
                                avatarProps: {
                                    sx: {
                                        width: 'unset',
                                        height: 112,
                                        aspectRatio: '3 / 4',
                                    },
                                },
                            }}
                        />
                    </Link>
                    <Stack sx={{ minWidth: 0, flex: 1, gap: 0.5 }}>
                        <Typography variant="overline" color="textSecondary">
                            {t(STALE_SOURCE_VERDICT_TRANSLATION[result.verdict])}
                        </Typography>
                        <Link
                            component={RouterLink}
                            to={AppRoutes.manga.path(manga.id)}
                            sx={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <TypographyMaxLines variant="h6" component="h3" title={manga.title}>
                                {manga.title}
                            </TypographyMaxLines>
                        </Link>

                        <ChapterComparison result={result} ownSourceName={ownSourceName} />

                        {!!result.error && (
                            <Typography variant="body2" color="error">
                                {result.error}
                            </Typography>
                        )}

                        <Typography variant="caption" color="textSecondary">
                            {t`Checked ${getDateString(result.checkedAt, true)} · ${result.checkedSourceIds.length} sources`}
                        </Typography>

                        {isBehind && !!result.match && (
                            <Box sx={{ mt: 1 }}>
                                <Button
                                    component={RouterLink}
                                    to={AppRoutes.migrate.children.singleMangaSearch.path(
                                        manga.sourceId,
                                        manga.id,
                                        manga.title,
                                    )}
                                    state={AppRoutes.migrate.children.singleMangaSearch.state({
                                        title: t`Migrate "${manga.title}"`,
                                        mode: 'migrate.select.single',
                                    })}
                                    startIcon={<SyncAltIcon />}
                                    variant="contained"
                                    size="small"
                                >
                                    {t`Migrate`}
                                </Button>
                            </Box>
                        )}
                    </Stack>

                    <PopupState variant="popover" popupId={`stale-source-entry-${manga.id}`}>
                        {(popupState) => (
                            <>
                                <IconButton {...bindTrigger(popupState)} color="inherit">
                                    <MoreVertIcon />
                                </IconButton>
                                <Menu {...bindMenu(popupState)}>
                                    <MenuItem
                                        disabled={isCheckDisabled}
                                        onClick={() => {
                                            popupState.close();
                                            onRecheck();
                                        }}
                                    >
                                        <ListItemText primary={t`Check again`} />
                                    </MenuItem>
                                    {!!result.match && (
                                        <MenuItem
                                            onClick={() => {
                                                popupState.close();
                                                onIgnoreSource();
                                            }}
                                        >
                                            <ListItemText
                                                primary={t`Ignore "${result.match.sourceName}"`}
                                                secondary={t`Never report or search this source for this entry`}
                                            />
                                        </MenuItem>
                                    )}
                                    <MenuItem
                                        onClick={() => {
                                            popupState.close();
                                            onClearResult();
                                        }}
                                    >
                                        <ListItemText primary={t`Dismiss result`} />
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </PopupState>
                </CardContent>
            </Card>
        );
    },
);
