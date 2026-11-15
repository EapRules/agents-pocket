import { type ChatStatusLineInput, chatStatusLine } from '@openagentspocket/core';
import { t } from '@openagentspocket/i18n';
import {
  BackgroundWorkList,
  type BackgroundWorkSections,
  makeStyles,
  Sheet,
  StatusLine,
  useHandoverSheet,
} from '@openagentspocket/ui';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useBackgroundWork } from '@/conversations/useBackgroundWork';
import { useBackgroundWorkAsks, useDetailUi, useLiveTurn } from '../detailUi';
import { openableItem, statusLineItem } from './workViewModel';

const useStyles = makeStyles((th) => ({
  body: { padding: th.spacing.md },
}));

interface Props {
  hostId: string;
  paneId: string;
  /** herdr's status for the Agent, as the dock shows it. */
  agent: ChatStatusLineInput['agent'];
}

/**
 * Chat's one status line over the Composer (what the Agent does, its Background Work as counts) and
 * the sheet it opens, which lists every kind of work in two collapsible sections, the harness's
 * notices folded into the work they announce. The line counts what the sheet lists, so it never
 * promises a row the sheet lacks; with nothing listed it is plain text.
 */
export function AgentBackgroundWork({ hostId, paneId, agent }: Props) {
  const styles = useStyles();
  const turn = useLiveTurn();
  const { sheet: listed, subagentIdOf, now } = useBackgroundWork(hostId, paneId, turn !== null);
  const { openSubagent } = useDetailUi();
  const sheet = useHandoverSheet();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  // The sections the user opened or closed, for as long as the sheet stays up.
  const [sections, setSections] = useState<BackgroundWorkSections>({});
  const line = useMemo(
    () => statusLineItem(chatStatusLine({ turn, work: listed, agent, now })),
    [turn, listed, agent, now],
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
      <StatusLine
        {...line}
        open={
          empty
            ? undefined
            : { onPress: show, label: t('Background work'), hint: t('Shows all background work.') }
        }
      />
      <Sheet
        visible={sheet.visible}
        onClose={sheet.close}
        onDismissed={sheet.onDismissed}
        title={t('Background Work')}
        leading={{ label: t('Done'), onPress: sheet.close, testID: 'work-done' }}
        // As tall as its rows, capped at the screen; past that the list scrolls inside.
        detent="fit"
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
