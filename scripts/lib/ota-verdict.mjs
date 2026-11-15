// The over-the-air verdict for a commit (ADR 0028): can its JS ship as an update to a released
// store build, or does it need a new store build? Pure: the source fingerprint (the runtime version
// without the Apple team id, which CI does not have) and the recorded builds come in, the verdict
// goes out. scripts/ci-ota-verdict.mjs reads them and prints it.
import { buildsForSource } from './released-builds.mjs';

/**
 * @param {{platform: string, sourceFingerprint: string, builds: import('./released-builds.mjs').ReleasedBuild[]}} input
 * @returns {{canShip: boolean, title: string, detail: string, newest: import('./released-builds.mjs').ReleasedBuild | null}}
 */
export function otaVerdict({ platform, sourceFingerprint, builds }) {
  const newest = buildsForSource(builds, platform, sourceFingerprint).at(-1) ?? null;
  if (newest)
    return {
      canShip: true,
      title: 'Can ship over the air',
      detail: `Native inputs ${sourceFingerprint} are run by ${platform} ${newest.version} (${newest.build}), the newest released build that runs them.`,
      newest,
    };
  const released = [
    ...new Set(builds.filter((b) => b.platform === platform).map((b) => b.sourceFingerprint)),
  ].filter(Boolean);
  return {
    canShip: false,
    title: 'Needs a store build',
    detail: `Computed native inputs ${sourceFingerprint}; released ${platform} builds have: ${released.length ? released.join(', ') : 'none'}.`,
    newest: null,
  };
}

/** The verdict as Markdown, for the GitHub step summary. */
export function verdictMarkdown(platform, verdict) {
  return `## OTA verdict (${platform})\n\n**${verdict.title}**\n\n${verdict.detail}\n`;
}
