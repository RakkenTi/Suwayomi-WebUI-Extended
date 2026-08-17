/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useLingui } from '@lingui/react/macro';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import type { AwaitableComponentProps } from 'awaitable-component';
import Typography from '@mui/material/Typography';
import WarningIcon from '@mui/icons-material/Warning';
import { useState } from 'react';
import type { MigrationBulkSearchSettings } from '@/features/migration/Migration.types.ts';

export const MigrationBulkSearchOptionsDialog = ({
    isVisible,
    onDismiss,
    onSubmit,
    onExitComplete,
}: AwaitableComponentProps<MigrationBulkSearchSettings>) => {
    const { t } = useLingui();

    const [selectHighestChapterNumberSource, setSelectHighestChapterNumberSource] = useState(false);
    const [ignoreOutdatedMatches, setIgnoreOutdatedMatches] = useState(true);
    const [ignoreWithMissingChapters, setIgnoreWithMissingChapters] = useState(false);
    const [requireAdditionalChapters, setRequireAdditionalChapters] = useState(false);
    const [performAdvancedSearch, setPerformAdvancedSearch] = useState(false);

    return (
        <Dialog open={isVisible} fullWidth onClose={onDismiss} onTransitionExited={onExitComplete}>
            <DialogTitle>{t`Search options`}</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t`Matches fulfilling all criteria get selected automatically. Entries without an automatic selection get listed for manual review.`}
                </Typography>
                <CheckboxInput
                    primaryText={t`Require at least the same latest chapter`}
                    secondaryText={t`Do not automatically select matches that are behind the current source's latest chapter`}
                    sx={{
                        alignItems: 'start',
                    }}
                    checked={ignoreOutdatedMatches}
                    onChange={(_, checked) => setIgnoreOutdatedMatches(checked)}
                />
                <CheckboxInput
                    primaryText={t`Require newer chapters`}
                    secondaryText={t`Only automatically select matches that have more chapters than the current source`}
                    sx={{
                        alignItems: 'start',
                    }}
                    checked={requireAdditionalChapters}
                    onChange={(_, checked) => setRequireAdditionalChapters(checked)}
                />
                <CheckboxInput
                    primaryText={t`Require no missing chapters`}
                    secondaryText={t`Only automatically select matches whose chapter list has no gaps`}
                    sx={{
                        alignItems: 'start',
                    }}
                    checked={ignoreWithMissingChapters}
                    onChange={(_, checked) => setIgnoreWithMissingChapters(checked)}
                />
            </DialogContent>
            <DialogContent dividers>
                <Stack
                    direction="row"
                    sx={{
                        alignItems: 'center',
                    }}
                >
                    <WarningIcon color="warning" />
                    <Typography
                        variant="body1"
                        sx={{
                            marginLeft: '10px',
                            marginTop: '5px',
                            whiteSpace: 'pre-line',
                        }}
                        color="error"
                    >
                        {t`These options are slow and dangerous and may lead to restrictions from sources`}
                    </Typography>
                </Stack>
                <CheckboxInput
                    primaryText={t`Advanced search mode`}
                    secondaryText={t`Additionally search with the single keywords of the title to find more matches (causes many additional requests per entry)`}
                    sx={{
                        alignItems: 'start',
                    }}
                    checked={performAdvancedSearch}
                    onChange={(_, checked) => setPerformAdvancedSearch(checked)}
                />
                <CheckboxInput
                    primaryText={t`Pick the match that is furthest ahead`}
                    secondaryText={t`Search all selected sources and pick the match with the highest chapter number.\nOtherwise, the first match in source order gets picked and the remaining sources get skipped.`}
                    sx={{
                        alignItems: 'start',
                    }}
                    checked={selectHighestChapterNumberSource}
                    onChange={(_, checked) => setSelectHighestChapterNumberSource(checked)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onDismiss}>{t`Cancel`}</Button>
                <Button
                    variant="contained"
                    onClick={() =>
                        onSubmit({
                            selectHighestChapterNumberSource,
                            ignoreOutdatedMatches,
                            requireAdditionalChapters,
                            ignoreWithMissingChapters,
                            performAdvancedSearch,
                        })
                    }
                >
                    {t`Search`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
