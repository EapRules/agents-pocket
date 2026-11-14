import { chatStatusLine } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import {
  BackgroundWorkList,
  type BackgroundWorkSections,
  BackgroundWorkStrip,
  makeStyles,
  Sheet,
  useHandoverSheet,
} from '@openagentspocket/ui';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useBackgroundWork } from '@/conversations/useBackgroundWork';
import { useBackgroundWorkAsks, useDetailUi, useLiveTurn } from '../detailUi';
import { openableItem, statusLineItem } from './workViewModel';

const useStyles = makeStyles((th) => ({
  strip: { paddingHorizontal: th.spacing.sm, paddingTop: th.spacing.xxs },
  body: { padding: th.spacing.md },
}));

interface Props {
  hostId: string;
  paneId: string;
  /** herdr reports the Agent Blocked: the line says it waits on the user. */
  isBlocked?: boolean;
}

/**
 * Chat's status line over the Composer (the running turn needs the user, Background Work as counts)
 * and the sheet it opens, which lists every kind of work in two collapsible sections, the harness's
 * notices folded into the work they announce. The line counts what the sheet lists, so it never
 * promises a row the sheet lacks. The turn itself is the live line at the transcript's end. Absent
 * with nothing to say, so its height drops to zero.
 */
export function AgentBackgroundWork({ hostId, paneId, isBlocked = false }: Props) {
  const styles = useStyles();
  const turn = useLiveTurn();
  const { sheet: listed, subagentIdOf } = useBackgroundWork(hostId, paneId);
  const { openSubagent } = useDetailUi();
  const sheet = useHandoverSheet();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // The sections the user opened or closed, for as long as the sheet stays up.
  const [sections, setSections] = useState<BackgroundWorkSections>({});
  const line = useMemo(
    () => chatStatusLine(turn, listed, { isBlocked }),
    [turn, listed, isBlocked],
  );
  const empty = listed.rows.length === 0;
  const show = () => {
    setExpanded(new Set());
    setSections({});
    sheet.open(true);
  };
  // A Subagent row with no transcript to open asks for the sheet instead.
  useBackgroundWorkAsks(show);
  // A new message, or another conversation, leaves nothing to show.
  useEffect(() => {
    if (empty) sheet.close();
  }, [empty, sheet.close]);
  const withOpen = (row: (typeof listed.rows)[number]) =>
    openableItem(row, subagentIdOf, (agentId) => sheet.closeThen(() => openSubagent(agentId)));
  return (
    <>
      {line ? (
        <View style={styles.strip}>
          <BackgroundWorkStrip
            line={statusLineItem(line)}
            onOpen={show}
            labels={{ name: t('Background work'), hint: t('Shows all background work.') }}
          />
        </View>
      ) : null}
      <Sheet
        visible={sheet.visible}
        onClose={sheet.close}
        onDismissed={sheet.onDismissed}
        title={t('Background Work')}
        leading={{ label: t('Done'), onPress: sheet.close, testID: 'work-done' }}
        detent="large"
        testID="background-work-sheet"
      >
        <View style={styles.body}>
          <BackgroundWorkList
            unfinished={listed.unfinished.map(withOpen)}
            finished={listed.finished.map(withOpen)}
            sections={sections}
            onToggleSection={(section, open) =>
              setSections((current) => ({ ...current, [section]: open }))
            }
            expanded={expanded}
            onToggle={(id) =>
              setExpanded((current) => {
                const next = new Set(current);
                if (!next.delete(id)) next.add(id);
                return next;
              })
            }
            labels={{
              running: t('Running'),
              finished: t('Finished'),
              finishedFooter: t('Finished work leaves this list when you send your next message.'),
            }}
          />
        </View>
      </Sheet>
    </>
  );
}
