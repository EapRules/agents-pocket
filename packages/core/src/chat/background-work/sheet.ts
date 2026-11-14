// What the Background Work sheet lists: every kind of work the transcript holds (Subagents,
// Workflows, background commands), running first, then what finished, newest first. The harness's
// task notifications are no list of their own: a notice announcing work the sheet lists only says
// how it ended, and a notice naming work the loaded lines don't hold (launched above them, or by a
// program whose records show only the end) stands in as that work's finished row. A notice that
// names no kind of work stays out.

import { backgroundWorkItem } from '../model/factories';
import { listedBackgroundWork, runOffset } from '../model/transcript';
import type { ChatBackgroundWorkItem, ChatNoticeTask, ChatTranscript } from '../model/types';
import type { ChatWorkflowProgress } from '../model/workflow-progress';
import {
  type BackgroundWorkNotice,
  type BackgroundWorkStaleness,
  type ChatBackgroundWork,
  DEFAULT_STALENESS,
  isRowRunning,
  listedNotices,
  rowsOf,
} from './work';

/** Whether the notice announces this item's end: it names the item's call, or its task. */
export function announces(task: ChatNoticeTask, item: ChatBackgroundWorkItem): boolean {
  if (task.callID !== null && (task.callID === item.id || task.callID === item.resume?.callID)) {
    return true;
  }
  if (task.taskID === null) return false;
  return task.taskID === item.agentID || task.taskID === (item.taskID ?? null);
}

/**
 * The item as a notice after its latest run started says it ended, when its program's projection
 * left it running (one that reads ends only from notices).
 */
function settled(
  item: ChatBackgroundWorkItem,
  notices: readonly BackgroundWorkNotice[],
): ChatBackgroundWorkItem {
  if (item.state !== 'running') return item;
  const start = runOffset(item);
  const end = notices.find(
    ({ notice, offset }) =>
      notice.task !== undefined &&
      notice.task.state !== 'running' &&
      offset > start &&
      announces(notice.task, item),
  );
  const task = end?.notice.task;
  if (!end || !task) return item;
  return {
    ...item,
    state: task.state,
    endOffset: end.offset,
    ...(task.exitCode === null ? {} : { exitCode: task.exitCode }),
  };
}

/**
 * The finished rows notices stand in for: each notice that names a kind of work but none of the
 * transcript's items. Oldest first, one per notice.
 */
export function noticeWork(
  transcript: ChatTranscript,
  notices: readonly BackgroundWorkNotice[] = listedNotices(transcript),
): ChatBackgroundWorkItem[] {
  return notices.flatMap(({ id, notice, offset }) => {
    const task = notice.task;
    if (!task || task.kind === null || task.state === 'running') return [];
    if (transcript.backgroundWork.some((item) => announces(task, item))) return [];
    return [
      backgroundWorkItem({
        id: `notice:${id}`,
        kind: task.kind,
        title: task.label ?? notice.title,
        state: task.state,
        launchOffset: offset,
        endOffset: offset,
        exitCode: task.exitCode,
        taskID: task.taskID,
      }),
    ];
  });
}

/** Everything the sheet lists, as rows the presentation reads. */
export function backgroundSheetOf(
  transcript: ChatTranscript,
  progress: Readonly<Record<string, ChatWorkflowProgress>>,
  isLive: boolean,
  now: number,
  staleness: BackgroundWorkStaleness = DEFAULT_STALENESS,
): ChatBackgroundWork {
  const notices = listedNotices(transcript);
  const items = [
    ...listedBackgroundWork(transcript).map((item) => settled(item, notices)),
    ...noticeWork(transcript, notices),
  ];
  const rows = rowsOf(items, progress, now, staleness);
  // Newest end first, so a collapsed list still shows what just finished.
  const finished = rows
    .filter((row) => !isRowRunning(row))
    .sort((a, b) => (b.item.endOffset ?? -1) - (a.item.endOffset ?? -1));
  return { rows: [...rows.filter(isRowRunning), ...finished], isLive };
}
