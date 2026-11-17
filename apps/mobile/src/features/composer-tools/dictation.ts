import {
  applyDictation,
  type DictatedDraft,
  type DictationFailure,
  dictationFailure,
  settleDictation,
} from '@openagentspocket/core';

export type { DictationFailure };

interface SpeechEvents {
  /** The phrase so far; the next one revises it. */
  onPartial(text: string): void;
  /** One finished phrase. */
  onFinal(text: string): void;
  /** The recognizer's error code (`no-speech`, `language-not-supported`...). */
  onError(code: string): void;
  onEnd(): void;
}

/** The system's speech recognizer, as dictation uses it. */
export interface SpeechEngine {
  requestPermission(): Promise<boolean>;
  /** The locale to listen in; null when the recognizer supports no language to offer. */
  language(): Promise<string | null>;
  start(events: SpeechEvents, language: string): void;
  stop(): void;
}

/** The draft dictation writes to: read as it stands, replaced whole. */
export interface DictationDraft {
  read(): string;
  write(text: string): void;
}

/**
 * Dictates at the end of the draft: words show as they are heard and are revised in place, a
 * finished phrase stays, and the Agent gets nothing until Send.
 */
export class DictationController {
  private active = false;
  /** What this dictation wrote at the end of the draft that the recognizer may still revise. */
  private provisional = '';
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly engine: SpeechEngine,
    private readonly draft: DictationDraft,
    /** `code` is the recognizer's own word for an unexpected stop, so a report can name it. */
    private readonly onFailure: (reason: DictationFailure, code?: string) => void = () => {},
  ) {}

  get listening(): boolean {
    return this.active;
  }

  readonly getSnapshot = (): boolean => this.active;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Leaving the Agent: nothing keeps listening with no button left to stop it. */
  stop(): void {
    if (this.active) this.engine.stop();
  }

  async toggle(): Promise<void> {
    if (this.active) {
      this.engine.stop();
      return;
    }
    if (!(await this.engine.requestPermission())) {
      this.onFailure('permission');
      return;
    }
    const language = await this.engine.language();
    if (language === null) {
      this.onFailure('language');
      return;
    }
    this.provisional = '';
    this.set(true);
    this.engine.start(
      {
        onPartial: (text) => this.heard(text, false),
        onFinal: (text) => this.heard(text, true),
        onError: (code) => {
          if (!this.active) return;
          this.settle();
          this.set(false);
          const failure = dictationFailure(code);
          if (failure) this.onFailure(failure, code);
        },
        onEnd: () => {
          this.settle();
          this.set(false);
        },
      },
      language,
    );
  }

  private heard(text: string, final: boolean): void {
    this.write(applyDictation(this.draft.read(), this.provisional, { text, final }));
  }

  /** Stopped: what the draft shows stays, the provisional phrase as finished. */
  private settle(): void {
    if (this.provisional !== '') this.write(settleDictation(this.draft.read(), this.provisional));
  }

  private write(next: DictatedDraft): void {
    this.provisional = next.provisional;
    if (next.draft !== this.draft.read()) this.draft.write(next.draft);
  }

  private set(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    for (const listener of this.listeners) listener();
  }
}
