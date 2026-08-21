/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Switch from '@mui/material/Switch';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { NumberSetting } from '@/base/components/settings/NumberSetting.tsx';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import type { MetadataStaleSourceSettings } from '@/features/stale-sources/StaleSources.types.ts';
import {
    STALE_SOURCE_CHECKS_PER_DAY,
    STALE_SOURCE_MIN_CHAPTER_DELTA,
    STALE_SOURCE_RECHECK_DAYS,
    STALE_SOURCE_SETTINGS_DEFAULT,
    STALE_SOURCE_SILENT_DAYS,
} from '@/features/stale-sources/StaleSources.constants.ts';

export const StaleSourceSettings = () => {
    const { t } = useLingui();

    const { settings } = useMetadataServerSettings();
    const setSettingValue = createUpdateMetadataServerSettings<keyof MetadataStaleSourceSettings>((e) =>
        makeToast(t`Could not save the settings to the server`, 'error', getErrorMessage(e)),
    );

    return (
        <List
            subheader={
                <ListSubheader component="div" id="library-stale-source-settings">
                    {t`Stale sources`}
                </ListSubheader>
            }
        >
            <ListItem>
                <ListItemText
                    primary={t`Check for stale sources`}
                    secondary={t`Periodically search other sources for entries that stopped receiving chapters. Runs on this device while the WebUI is open and sends requests to your sources.`}
                />
                <Switch
                    edge="end"
                    checked={settings.staleSourceCheckEnabled}
                    onChange={(e) => setSettingValue('staleSourceCheckEnabled', e.target.checked)}
                />
            </ListItem>
            <NumberSetting
                settingTitle={t`Entries per day`}
                settingValue={plural(settings.staleSourceChecksPerDay, {
                    one: '# entry',
                    other: '# entries',
                })}
                value={settings.staleSourceChecksPerDay}
                defaultValue={STALE_SOURCE_SETTINGS_DEFAULT.staleSourceChecksPerDay}
                minValue={STALE_SOURCE_CHECKS_PER_DAY.min}
                maxValue={STALE_SOURCE_CHECKS_PER_DAY.max}
                stepSize={STALE_SOURCE_CHECKS_PER_DAY.step}
                valueUnit={t`Entries`}
                dialogDescription={t`How many entries may be checked within 24 hours. Every checked entry is searched in each of your library's other sources, so a high value means a lot of source requests.`}
                showSlider
                handleUpdate={(value) => setSettingValue('staleSourceChecksPerDay', value)}
                disabled={!settings.staleSourceCheckEnabled}
            />
            <NumberSetting
                settingTitle={t`Silent for`}
                settingValue={plural(settings.staleSourceSilentDays, {
                    one: '# day',
                    other: '# days',
                })}
                value={settings.staleSourceSilentDays}
                defaultValue={STALE_SOURCE_SETTINGS_DEFAULT.staleSourceSilentDays}
                minValue={STALE_SOURCE_SILENT_DAYS.min}
                maxValue={STALE_SOURCE_SILENT_DAYS.max}
                stepSize={STALE_SOURCE_SILENT_DAYS.step}
                valueUnit={t`Days`}
                dialogDescription={t`Only entries whose newest chapter is at least this old become candidates. Entries without any chapter are always checked.`}
                showSlider
                handleUpdate={(value) => setSettingValue('staleSourceSilentDays', value)}
                disabled={!settings.staleSourceCheckEnabled}
            />
            <NumberSetting
                settingTitle={t`Re-check after`}
                settingValue={plural(settings.staleSourceRecheckDays, {
                    one: '# day',
                    other: '# days',
                })}
                value={settings.staleSourceRecheckDays}
                defaultValue={STALE_SOURCE_SETTINGS_DEFAULT.staleSourceRecheckDays}
                minValue={STALE_SOURCE_RECHECK_DAYS.min}
                maxValue={STALE_SOURCE_RECHECK_DAYS.max}
                stepSize={STALE_SOURCE_RECHECK_DAYS.step}
                valueUnit={t`Days`}
                dialogDescription={t`How long a checked entry is left alone before it is checked again.`}
                showSlider
                handleUpdate={(value) => setSettingValue('staleSourceRecheckDays', value)}
                disabled={!settings.staleSourceCheckEnabled}
            />
            <NumberSetting
                settingTitle={t`Report when ahead by`}
                settingValue={plural(settings.staleSourceMinChapterDelta, {
                    one: '# chapter',
                    other: '# chapters',
                })}
                value={settings.staleSourceMinChapterDelta}
                defaultValue={STALE_SOURCE_SETTINGS_DEFAULT.staleSourceMinChapterDelta}
                minValue={STALE_SOURCE_MIN_CHAPTER_DELTA.min}
                maxValue={STALE_SOURCE_MIN_CHAPTER_DELTA.max}
                stepSize={STALE_SOURCE_MIN_CHAPTER_DELTA.step}
                valueUnit={t`Chapters`}
                dialogDescription={t`How many chapters another source has to be ahead by before the entry is reported. Raising this hides false positives caused by sources numbering chapters differently.`}
                showSlider
                handleUpdate={(value) => setSettingValue('staleSourceMinChapterDelta', value)}
            />
            <ListItem>
                <ListItemText
                    primary={t`Show badge`}
                    secondary={t`Mark library entries that are behind another source`}
                />
                <Switch
                    edge="end"
                    checked={settings.showStaleSourceBadge}
                    onChange={(e) => setSettingValue('showStaleSourceBadge', e.target.checked)}
                />
            </ListItem>
            <ListItemLink to={AppRoutes.settings.children.library.children.staleSources.path}>
                <ListItemText primary={t`Stale sources`} secondary={t`Show entries that are behind another source`} />
            </ListItemLink>
        </List>
    );
};
