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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
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
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';

const SourceStatsRow = ({
    label,
    latestChapterNumber,
    chapterCount,
    missingChapters,
    latestUploadDate,
    isOwn,
    isAhead,
    mangaId,
}: {
    label: string;
    latestChapterNumber: number | null;
    chapterCount: number | null;
    missingChapters: number | null;
    latestUploadDate: number | null;
    isOwn: boolean;
    isAhead: boolean;
    mangaId?: MangaIdInfo['id'];
}) => {
    const { t } = useLingui();

    const color = (() => {
        if (isOwn) {
            return 'textPrimary';
        }

        return isAhead ? 'warning.main' : 'textSecondary';
    })();

    return (
        <TableRow>
            <TableCell sx={{ borderBottom: 'none', pl: 0, py: 0.5 }}>
                <Typography variant="body2" color={color} sx={{ fontWeight: isOwn ? 'bold' : undefined }}>
                    {isOwn ? (
                        t`${label} (current)`
                    ) : (
                        // opens the candidate so its chapter list can be inspected before committing to a migration
                        <Link component={RouterLink} to={AppRoutes.manga.path(mangaId!)} color="inherit">
                            {label}
                        </Link>
                    )}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ borderBottom: 'none', py: 0.5 }}>
                <Typography variant="body2" color={color}>
                    {latestChapterNumber == null ? '—' : latestChapterNumber}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ borderBottom: 'none', py: 0.5 }}>
                <Typography variant="body2" color="textSecondary">
                    {chapterCount ?? '—'}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ borderBottom: 'none', py: 0.5 }}>
                <Typography variant="body2" color={missingChapters ? 'error' : 'textSecondary'}>
                    {isOwn || missingChapters == null ? '—' : missingChapters}
                </Typography>
            </TableCell>
            <TableCell align="right" sx={{ borderBottom: 'none', pr: 0, py: 0.5 }}>
                <Typography variant="body2" color="textSecondary">
                    {latestUploadDate ? getDateString(latestUploadDate) : '—'}
                </Typography>
            </TableCell>
        </TableRow>
    );
};

/**
 * Side by side comparison of the entry's own source and every source that carries it, so migrating is a decision
 * rather than a leap of faith - a source can lead on chapter number while having fewer chapters overall, gaps above
 * the read progress, or a last upload just as old as the current one.
 */
const SourceComparison = ({ result, ownSourceName }: { result: StaleSourceCheckResult; ownSourceName: string }) => {
    const { t } = useLingui();

    const matches = result.matches?.length ? result.matches : [result.match].filter((match) => match !== null);

    if (!matches.length) {
        return null;
    }

    const ownLatestChapterNumber = result.latestChapterNumber;

    return (
        <TableContainer sx={{ mt: 1, overflowX: 'auto' }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ pl: 0, py: 0.5 }}>{t`Source`}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>{t`Latest`}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>{t`Chapters`}</TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>{t`Gaps`}</TableCell>
                        <TableCell align="right" sx={{ pr: 0, py: 0.5 }}>{t`Last upload`}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <SourceStatsRow
                        label={ownSourceName}
                        latestChapterNumber={ownLatestChapterNumber}
                        chapterCount={result.own?.chapterCount ?? null}
                        missingChapters={null}
                        latestUploadDate={result.own?.latestUploadDate ?? null}
                        isOwn
                        isAhead={false}
                    />
                    {matches.map((match) => (
                        <SourceStatsRow
                            key={match.sourceId}
                            label={match.sourceName}
                            latestChapterNumber={match.latestChapterNumber}
                            chapterCount={match.chapterCount || null}
                            missingChapters={match.missingChapters}
                            latestUploadDate={match.latestUploadDate}
                            isOwn={false}
                            mangaId={match.mangaId}
                            isAhead={
                                ownLatestChapterNumber == null || match.latestChapterNumber > ownLatestChapterNumber
                            }
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
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

                        <SourceComparison result={result} ownSourceName={ownSourceName} />

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
