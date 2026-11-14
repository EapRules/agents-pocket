import {
  type BlockedCardState,
  type BlockedDialog,
  type CardContent,
  type GenericDialogExcerpt,
  makeFocus,
  makeOption,
  makeSubject,
  message,
} from '@openagentspocket/core';
import { ThemeProvider } from '@openagentspocket/ui';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { BlockedCard, type BlockedCardProps } from './BlockedCard';
import { headlineTitle } from './dialogModel';

const COMMAND = 'touch c1.txt';

function bashDialog(): BlockedDialog {
  return {
    kind: 'claudeBash',
    program: 'claude',
    title: 'Bash command',
    sourceSuffix: null,
    positionLabel: null,
    body: [],
    progress: null,
    options: [
      makeOption({ ordinal: 1, number: 1, label: 'Yes', role: 'approve', isFocused: true }),
      makeOption({ ordinal: 2, number: 2, label: 'Yes, always', role: 'approvePersistent' }),
      makeOption({ ordinal: 3, number: 3, label: 'No', role: 'decline' }),
    ],
    rows: { lowerBound: 0, upperBound: 10 },
    fingerprint: { value: 'abc', requestLines: null, ruleLines: null },
    focus: makeFocus({ focusedOrdinal: 1 }),
    subject: { ...makeSubject(), command: COMMAND, commandDescription: 'Create c1' },
    note: null,
  };
}

function excerpt(numbered: [number, string][]): GenericDialogExcerpt {
  return {
    rows: [],
    numbered: new Map(numbered),
    reason: message('The top of the dialog is off screen.'),
    fingerprint: { value: 'x', requestLines: null, ruleLines: null },
    displayLines: null,
  };
}

async function renderCard(content: CardContent) {
  const state: BlockedCardState = {
    content,
    progress: 'ready',
    notice: null,
    composerFocusRequest: 0,
    dialogGeneration: 0,
    isCollapsed: false,
  };
  const props: BlockedCardProps = {
    state,
    onChoose: jest.fn(),
    onSubmitSelection: jest.fn(),
    onStop: jest.fn(),
    onPress: jest.fn(),
    onKeys: jest.fn(),
    onCollapsedChange: jest.fn(),
    onShowTerminal: jest.fn(),
  };
  await render(
    <ThemeProvider themeId="indigo">
      <BlockedCard {...props} />
    </ThemeProvider>,
  );
  return props;
}

const pair = () => within(screen.getByTestId('blocked-answer-pair'));

describe('an approval', () => {
  it('heads with who wants to do what, the command alone, then its description', async () => {
    await renderCard({ kind: 'card', dialog: bashDialog() });
    const heading = headlineTitle({ actor: 'Bash', verb: 'run' });
    expect(screen.getByText(heading)).toBeTruthy();
    expect(screen.getByTestId('blocked-subject-code').props.children).toBe(COMMAND);
    expect(screen.getByTestId('blocked-subject-description')).toBeTruthy();
  });

  it('pairs the single-use answers and keeps the persistent one below, out of the pair', async () => {
    const props = await renderCard({ kind: 'card', dialog: bashDialog() });
    expect(pair().getByTestId('blocked-option-3')).toBeTruthy();
    expect(pair().getByTestId('blocked-option-1')).toBeTruthy();
    expect(pair().queryByTestId('blocked-option-2')).toBeNull();
    expect(screen.getByTestId('blocked-option-2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('blocked-option-1'));
    expect(props.onChoose).toHaveBeenCalledWith(1);
  });

  it('keeps a question as a list', async () => {
    const dialog: BlockedDialog = {
      ...bashDialog(),
      kind: 'claudeQuestion',
      options: [
        makeOption({ ordinal: 1, number: 1, label: 'Yes', role: 'answer' }),
        makeOption({ ordinal: 2, number: 2, label: 'No', role: 'answer' }),
      ],
    };
    await renderCard({ kind: 'card', dialog });
    expect(screen.queryByTestId('blocked-answer-pair')).toBeNull();
    expect(screen.getByTestId('blocked-option-2')).toBeTruthy();
  });
});

describe('a dialog no parser names', () => {
  const shown = { toolName: 'Bash', command: COMMAND, description: null };

  it('shows the request it provably asks about, pressing the screen numbers', async () => {
    const props = await renderCard({
      kind: 'generic',
      excerpt: excerpt([
        [1, 'Yes'],
        [2, "Yes, and don't ask again for touch commands"],
        [3, 'No'],
      ]),
      shown,
    });
    expect(screen.queryByTestId('blocked-excerpt')).toBeNull();
    expect(screen.queryByTestId('blocked-generic-reason')).toBeNull();
    expect(screen.getByTestId('blocked-subject-code').props.children).toBe(COMMAND);
    expect(pair().getByTestId('blocked-generic-1')).toBeTruthy();
    expect(pair().getByTestId('blocked-generic-3')).toBeTruthy();
    expect(pair().queryByTestId('blocked-generic-2')).toBeNull();
    await fireEvent.press(screen.getByTestId('blocked-generic-1'));
    expect(props.onPress).toHaveBeenCalledWith(1);
  });

  it('stays raw when nothing provably matches', async () => {
    await renderCard({
      kind: 'generic',
      excerpt: excerpt([
        [1, 'Yes'],
        [2, 'No'],
      ]),
      shown: null,
    });
    expect(screen.getByTestId('blocked-excerpt')).toBeTruthy();
    expect(screen.getByTestId('blocked-generic-reason')).toBeTruthy();
    expect(screen.queryByTestId('blocked-answer-pair')).toBeNull();
    expect(screen.queryByTestId('blocked-subject-code')).toBeNull();
  });
});
