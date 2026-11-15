// The over-the-air verdict for a commit (ADR 0028): can its JS ship as an update to a released
// store build, or does it need a new store build? Pure: the runtime version and the recorded builds
// come in, the verdict goes out. scripts/ci-ota-verdict.mjs reads them and prints it.
import { buildsForRuntime } from './released-builds.mjs';

// The Apple team id is part of the resolved Expo config, so part of the runtime version (it is not
// in the repository). Without it the computed runtime differs from every released one.
const TEAM_ID_CAVEAT =
  ' Caveat: no Apple team id was available (APPLE_TEAM_ID), and it is part of the runtime version, so this may be a false alarm; set the APPLE_TEAM_ID repository variable.';

/**
 * @param {{platform: string, runtimeVersion: string, builds: import('./released-builds.mjs').ReleasedBuild[], teamIdKnown?: boolean}} input
 * @returns {{canShip: boolean, title: string, detail: string, newest: import('./released-builds.mjs').ReleasedBuild | null}}
 */
export function otaVerdict({ platform, runtimeVersion, builds, teamIdKnown = true }) {
  const reachable = buildsForRuntime(builds, platform, runtimeVersion);
  const newest = reachable.at(-1) ?? null;
  if (newest)
    return {
      canShip: true,
      title: 'Can ship over the air',
      detail: `Runtime ${runtimeVersion} is run by ${platform} ${newest.version} (${newest.build}), the newest released build that runs it.`,
      newest,
    };
  const released = [
    ...new Set(builds.filter((b) => b.platform === platform).map((b) => b.runtimeVersion)),
  ];
  return {
    canShip: false,
    title: 'Needs a store build',
    detail: `Computed runtime ${runtimeVersion}; released ${platform} runtimes: ${released.length ? released.join(', ') : 'none'}.${teamIdKnown ? '' : TEAM_ID_CAVEAT}`,
    newest: null,
  };
}

/** The verdict as Markdown, for the GitHub step summary. */
export function verdictMarkdown(platform, verdict) {
  return `## OTA verdict (${platform})\n\n**${verdict.title}**\n\n${verdict.detail}\n`;
}
