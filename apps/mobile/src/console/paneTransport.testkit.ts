// Test support: the demo Host made able to read and answer its panes, with what each call was given,
// and the captured program screens a read can return. Node only (jest).

import { DemoConsoleTransport } from './demo';

// Jest runs in node; the app's tsconfig carries no node typings.
declare const __dirname: string;
const { readFileSync } = require('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
};

/** A captured screen of `program` from core's goldens, by its stem. */
export const goldenScreen = (stem: string, program: string) =>
  readFileSync(
    `${__dirname}/../../../../packages/core/goldens/${program}/screens/${stem}.ansi`,
    'utf8',
  );

/** A Host whose panes can be read and answered, with what each call was given. */
export class PaneTransport extends DemoConsoleTransport {
  prompts: { target: string; text: string }[] = [];
  keys: { target: string; keys: string[] }[] = [];
  reads = 0;
  text = '';

  async readAgent(): Promise<{ text: string }> {
    this.reads += 1;
    return { text: this.text };
  }
  async sendAgentKeys(params: { target: string; keys: string[] }): Promise<void> {
    this.keys.push(params);
  }
  async sendPaneInput(): Promise<void> {}
  async promptAgent(params: { target: string; text: string }): Promise<void> {
    this.prompts.push(params);
  }
}
