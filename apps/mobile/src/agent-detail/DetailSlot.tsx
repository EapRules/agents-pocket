import type { ComposerMessage, ComposerStore } from '@openagentspocket/core';
import { EdgeFade, makeStyles, SplitView } from '@openagentspocket/ui';
import { View } from 'react-native';
import { ChatTimeline } from './chat/ChatTimeline';
import type { ShownSurfaces } from './surface';
import { TerminalSurface } from './terminal/TerminalSurface';

/** How far past the header the fade runs; the header's own height behind it is solid. */
const HEADER_FADE = 24;

const useStyles = makeStyles(() => ({ fill: { flex: 1 } }));

interface Props {
  hostId: string;
  paneId: string;
  /** The Agent's program as herdr reports it; shapes how the terminal finds its messages. */
  program?: string | null;
  /** Chat, the terminal, or both side by side (`shownSurfaces`). */
  shown: ShownSurfaces;
  activity: Parameters<typeof ChatTimeline>[0]['activity'];
  /** The Composer's messages, echoed in Chat until the transcript records them. */
  messages: readonly ComposerMessage[];
  /** The Composer itself: the terminal learns from it what was sent. */
  composer: ComposerStore;
  /** The floating header's height: content starts under it. */
  headerHeight: number;
  onShowTerminal: () => void;
  /** Back to Chat from the terminal's key toolbar. */
  onShowChat: () => void;
  /** Counts the screen's visits, for Chat to land on its newest row. */
  visit?: number;
}

/**
 * The content that fills the detail: the conversation (under the header's fade), the live terminal,
 * or both side by side from `regular` up while the terminal is the surface.
 */
export function DetailSlot({
  hostId,
  paneId,
  program,
  shown,
  activity,
  messages,
  composer,
  headerHeight,
  onShowTerminal,
  onShowChat,
  visit,
}: Props) {
  const styles = useStyles();
  // Always the split, so Chat keeps its place (and its scroll) when the terminal opens beside it;
  // each side is a pane scope, so it lays out for its half.
  const single = !shown.terminal ? 'list' : !shown.chat ? 'detail' : undefined;
  return (
    <SplitView
      even
      single={single}
      testID="detail-surfaces"
      list={
        <>
          <ChatTimeline
            hostId={hostId}
            paneId={paneId}
            activity={activity}
            messages={messages}
            topInset={headerHeight}
            bottomInset={0}
            onShowTerminal={onShowTerminal}
            visit={visit}
          />
          <EdgeFade height={headerHeight + HEADER_FADE} solidHeight={headerHeight} />
        </>
      }
      detail={
        <View style={[styles.fill, { paddingTop: headerHeight }]}>
          <TerminalSurface
            hostId={hostId}
            paneId={paneId}
            program={program}
            composer={composer}
            onShowChat={onShowChat}
          />
        </View>
      }
    />
  );
}
