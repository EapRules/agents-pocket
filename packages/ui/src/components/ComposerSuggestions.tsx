import { ComposerPanel, type ComposerPanelRow } from './ComposerPanel';

/** One row of the `/` panel: a command or a skill. */
export interface ComposerSkill {
  /** "/code-review". */
  name: string;
  description: string;
  /** Where picking it takes the user, when that is not where they are ("Terminal"). */
  hint?: string;
}

interface Section {
  key: 'command' | 'skill';
  title: string;
  rows: readonly ComposerSkill[];
  onPick?: (name: string) => void;
}

interface Props {
  sections: readonly Section[];
  /** The draft: the list starts at its top again on a new query. */
  query: string;
  closeLabel: string;
  onClose: () => void;
  testID: string;
}

const asRow = (row: ComposerSkill, onPick?: (name: string) => void): ComposerPanelRow => ({
  key: row.name,
  title: row.name,
  monospaced: true,
  description: row.description,
  hint: row.hint,
  onPress: () => onPick?.(row.name),
});

/**
 * The Composer's `/` list: a use of `ComposerPanel`. Each non-empty section under its heading
 * (commands, then skills), the first heading pinned beside Close.
 */
export function ComposerSuggestions({ sections, query, closeLabel, onClose, testID }: Props) {
  const shown = sections.filter((section) => section.rows.length > 0);
  const [first] = shown;
  if (!first) return null;
  return (
    <ComposerPanel
      title={first.title}
      sections={shown.map((section, index) => ({
        key: section.key,
        title: index === 0 ? undefined : section.title,
        rows: section.rows.map((row) => asRow(row, section.onPick)),
      }))}
      closeLabel={closeLabel}
      onClose={onClose}
      resetKey={query}
      testID={`${testID}-skills`}
      idPrefix={testID}
    />
  );
}
