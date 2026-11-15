# Over-the-air updates

How a JS update reaches users without an App Store review, and who may do what
([ADR 0028](../decisions/0028-over-the-air-updates.md)). Updates are for fixes and polish of what App
Review has seen (ADR 0028, Store rules); anything native, any new feature, permission or data flow is
a store release.

Pieces:

| Piece | Where | Holds a secret |
|---|---|---|
| Update server (Cloudflare Worker + R2) | `packages/updates-server` | No |
| Publish script | `scripts/publish-update.mjs` | Reads the signing key from a file, in memory only |
| Code signing certificate (public) | `apps/mobile/certs/updates.pem` (from owner step 1) | No |
| Signing key | Owner's offline storage, never in the repo, CI, the Worker or Cloudflare | **Yes** |
| Released builds and their runtime versions | `docs/releases/builds.json` (appended by `scripts/release-ios.mjs`) | No |
| Public log of published updates | `docs/releases/updates.jsonl` (appended by a real upload) | No |

Status (2026-11-15): everything here is built and deployed. The signing key is with the owner, the
Worker runs on the update domain, store build 1.0.1 (5) has updates on, and a first real update was
applied on a phone. There are **two channels, neither chosen by the user** (ADR 0028, "Amendment:
internal channel and staged rollout"): `internal` is asked for only by TestFlight installs and gets every
verified push to `main`; `production` is every App Store install, and gets an update only when the owner
promotes it. iOS only; Android stays off until its client is verified on a device.

## The one command

Run it on the owner's machine, from a clean `main` level with `origin/main`, after the push. The signing
key never leaves that machine and is never in GitHub, so internal publishes are not run by CI.

```sh
pnpm ota                              # build, sign, verify and upload to internal (TestFlight installs)
pnpm ota --production [--rollout N] --yes   # promote the update internal served; starts at 10% unless N
pnpm ota rollout <percent>            # change production's percent (100 finishes it)
pnpm ota stop                         # production to 0%: nobody new gets it
pnpm ota revert --yes                 # back to the previous production update, for everyone
pnpm ota status                       # what internal and production serve, and the rollout percent
```

Every form takes `--dry-run`, which prints what it would do and writes nothing.

- **Internal** is never logged and has no rollout. Try the update on a TestFlight install first.
- **Production is a promotion of the exact update internal served** (same id), never a new build. It
  starts at 10% and is raised by hand with `rollout`. A new production upload is refused while the current
  one is below 100%: finish it (`rollout 100`) or `revert` first.
- **`revert` signs**, so it needs the key. A device never loads an update with an older `createdAt`, so
  the pointer cannot just move back: `revert` re-signs the previous update as a new one (new id,
  `createdAt` now). When the previous was the embedded bundle it publishes a `rollBackToEmbedded`
  directive. Details: `packages/updates-server/README.md`, "Channels, rollout, revert".
- **The log** `docs/releases/updates.jsonl` records production only (uploads and reverts). After a
  production step the command prints the git commands to commit and push the new line; it never commits or
  pushes. Commit and push it before the next production step: the upload compares the bucket with it.

What happens on the way, stopping at the first problem: it refuses unless on `main`, clean and level with
`origin/main`; computes the runtime version and refuses it unless `docs/releases/builds.json` records a
build with it (an update must only target a binary that exists); loads the certificate and the key (a file
path outside the repository, held in memory, never printed); runs `pnpm test`; exports the bundle; builds
and signs the manifest; verifies it as the app would (signature, runtime, asset hashes, `createdAt` newer
than the last update); then uploads assets first, the signed body and signature next and the channel
pointer last, reads everything back, asks the deployed Worker as a device would, and puts the previous
pointer back if the answer is wrong. Nothing is ever overwritten.

The same steps are available one by one in `scripts/publish-update.mjs` (`--upload`, `verify`, `rollout`,
`revert`, `rollback`); its flags are in `packages/updates-server/README.md`. `--target local` runs the
same code against the local bucket ("Test locally").

`--target r2` runs `npx wrangler r2 object get|put|delete <bucket>/<key> --remote` (wrangler 4, which
reads local storage unless told `--remote`). The repository does not pin wrangler; `npx` uses the
`wrangler` on your PATH or fetches the latest 4.x. It authenticates as wrangler does: the session
`npx wrangler login` left, or `CLOUDFLARE_API_TOKEN` in your shell. If your login sees more than one
account, set `CLOUDFLARE_ACCOUNT_ID` in the shell or `"accountId"` in `packages/updates-server/deploy.local.json`.
Nothing is printed but wrangler's own error text on a failure.

The log's first line carries `"channel":"beta"`: the test update of 2026-11-14, from the first two-channel
design. Lines are never rewritten; readers skip that one (`isRetiredChannelEntry`), and its pointer in the
bucket (`channels/ios/<runtime>/beta`) is read by nothing.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request to `main`, with read-only
repository permissions and no secret. Two jobs:

- **test**: the static gates (`node scripts/verify-fast.mjs --static`) and `pnpm test`.
- **ota-verdict** (macOS, because the released fingerprints were computed there):
  `node scripts/ci-ota-verdict.mjs`. It computes the iOS native-inputs fingerprint of the commit and
  compares it with the `sourceFingerprint` of each build in `docs/releases/builds.json` (the runtime
  version without the Apple team id, which a clean checkout lacks). `release-ios.mjs` now records
  `sourceFingerprint` next to `runtimeVersion` for every build.

Read the verdict in the job log or the run's summary page: **Can ship over the air** names the newest
released build that runs these native inputs; **Needs a store build** lists the fingerprints released
builds have. Both exit 0; the job fails only when the computation itself fails. CI never publishes: it
cannot, it holds no key.

## Owner steps

Everything that needs the key, the Cloudflare account or a store submission, in this order:

1. **Generate the key pair and certificate** (needs: Node, a machine you trust, offline storage for
   the key; nothing from Cloudflare). Three-year validity (ADR 0028):
   ```sh
   cd apps/mobile
   npx expo-updates codesigning:generate --key-output-directory ../../../updates-keys \
     --certificate-output-directory certs --certificate-validity-duration-years 3 \
     --certificate-common-name "Agents Pocket updates"
   ```
   (RSA 2048, node-forge's default, with the code signing usage.) The key folder must be outside the
   repository; move `private-key.pem` to offline storage (an encrypted PEM in a password manager, or a
   hardware token after a spike) and delete `public-key.pem` and the folder. Commit only
   `apps/mobile/certs/certificate.pem`, renamed `updates.pem`.
2. **Sign in to Cloudflare** (needs: the Cloudflare account that will host the Worker, with the update
   domain's zone on it): `npx wrangler login`, or an API token in `CLOUDFLARE_API_TOKEN` for the shell
   you publish from. A token needs Workers Scripts Edit and Workers R2 Storage Edit on the account, and
   Workers Routes Edit plus DNS Edit on the zone for the custom domain (Cloudflare's names; not checked
   against a real account). Several accounts on one login: `CLOUDFLARE_ACCOUNT_ID`, or `"accountId"` in
   `deploy.local.json` (step 4). Never put the token in a file in the repository.
3. **Create the R2 bucket** (needs: R2 enabled on the account; free tier is enough):
   ```sh
   npx wrangler r2 bucket create openagentspocket-updates
   ```
   Keep it private: no r2.dev URL and no bucket custom domain; only the Worker reads it. Optional, a
   second guard against overwrites (not tried on a real account; the upload never overwrites anyway, and
   a lock cannot be undone for the objects it covers):
   `npx wrangler r2 bucket lock add openagentspocket-updates immutable-assets assets/ --retention-indefinite`
   and the same for `updates/`. Never lock `channels/`: the pointer must move.
4. **Deploy the Worker on the update domain** (needs: the zone of `<update domain>` on the same account):
   write `packages/updates-server/deploy.local.json` (gitignored, like the relay's):
   ```json
   { "domains": ["updates.<your domain>"] }
   ```
   (add `"accountId": "<32 hex>"` only for a login with several accounts), then
   ```sh
   cd packages/updates-server
   node scripts/deploy.mjs --dry-run   # checks, then wrangler deploy --dry-run; reads nothing from the account
   node scripts/deploy.mjs             # checks the bucket exists, then wrangler deploy --domain <domain>
   curl -si https://<update domain>/manifest -H 'expo-protocol-version: 1' -H 'expo-platform: ios' \
     -H 'expo-runtime-version: 0'      # expect 204
   ```
   The script refuses a `wrangler.toml` without the `UPDATES` binding, with Workers Logs on, with an
   `account_id` or a committed route, or with Logpush or Analytics Engine. `--domain` makes the custom
   domain and its DNS record. There is no secret to put. In the dashboard, check Workers Logs stay off
   for `openagentspocket-updates`.
5. **First store build with expo-updates** through TestFlight, then the App Store (release guide),
   with the official-build flag set to `https://<update domain>/manifest` (below); `release-ios.mjs`
   records its runtime version in `docs/releases/builds.json`; commit it.
6. **First publish** (key + account): "Publish", with the log line committed and pushed. Check on a
   store or TestFlight install: Settings, About, the Update row shows the update's id after the second
   cold start.

## Roll back

Use `pnpm ota stop` to halt a production rollout in progress (0%: nobody new gets it; devices already
on it keep it), and `pnpm ota revert --yes` to take everyone back to the previous production update. Or
revert the bad change on `main`, push, and promote a new update. Every path publishes something with a
newer `createdAt`, so every device takes it on its next launch.

Expo warns that the embedded JS may not read state a newer update wrote
([error recovery](https://docs.expo.dev/eas-update/error-recovery/)), which matters when a revert goes
back to the embedded bundle.

A crash at launch already rolls a device back by itself (the client marks the update failed and goes
back to the last one that launched), but only for a fatal JS error before the first render is reported.

## Test locally (no account, no real key)

Server only:

```sh
cd packages/updates-server && pnpm test     # protocol conformance, publish tooling, end to end
npx wrangler dev                            # http://127.0.0.1:8787, local R2 in .wrangler/state
```

A full publish against the local server, with a throwaway key and a test builds record
(`--local-test` skips the git and test gates, accepts `--builds`, requires a loopback `--base-url` and
marks the bundle so `--target r2` refuses it):

```sh
T=$(mktemp -d)
openssl req -x509 -newkey rsa:2048 -nodes -keyout $T/key.pem -out $T/cert.pem -days 2 \
  -subj /CN=local-test -addext extendedKeyUsage=codeSigning -addext keyUsage=critical,digitalSignature
R=$(node --input-type=module -e "import { computeRuntimeVersion } from './scripts/lib/runtime-version.mjs'; console.log(computeRuntimeVersion({ mobileDir: process.cwd() + '/apps/mobile', platform: 'ios' }))")
echo "[{\"platform\":\"ios\",\"version\":\"0.0.0\",\"build\":\"1\",\"runtimeVersion\":\"$R\",\"commit\":\"local\",\"archivedAt\":\"2026-01-01T00:00:00.000Z\"}]" > $T/builds.json
L="--local-test --cert $T/cert.pem --builds $T/builds.json"

node scripts/publish-update.mjs $L --key $T/key.pem --base-url http://127.0.0.1:8787
node scripts/publish-update.mjs $L --upload build/updates/<id> --target local
node scripts/publish-update.mjs $L verify --url http://127.0.0.1:8787/manifest --runtime $R --allow-unlogged
```

Device check (ADR plan step 4, integrator): a Release simulator build pointed at the local server,
with the throwaway certificate from above. Updates are on only in a build signed for production APNs,
which is also the environment the runtime version above was computed in:

```sh
cd apps/mobile
APNS_ENVIRONMENT=production UPDATES_URL=http://127.0.0.1:8787/manifest UPDATES_CERTIFICATE=$T/cert.pem \
  npx expo prebuild --clean --platform ios
# then a Release build for the simulator from this shell (or with the three values in app.local.json:
# "apnsEnvironment", "updatesUrl", "updatesCertificate")
```

Plain http reaches loopback through the `NSAllowsLocalNetworking` exception `withLocalPreview` already
adds. Check: an update applies on the next cold start; a bad signature, a wrong runtime and an older
`createdAt` are refused; a crash at launch rolls back; Settings shows the running update.

Run on 2026-11-14 (iPhone 17 Pro simulator, iOS 26.5, Release, `expo-updates` 58.0.22):

- The runtime version the build embeds (`AgentsPocket.app/EXUpdates.bundle/fingerprint`) equals
  `computeRuntimeVersion`.
- With nothing published the app asks `/manifest` at launch and gets 204; Settings shows Update "Built In".
- An update published after the build applies on the second cold start (the first one downloads it);
  Settings shows its id.
- An update exported BEFORE the build was made is refused (its `createdAt` is older than the embedded
  bundle's): the app fetches the manifest and no asset. Publish after the build, never before.
- A newer update signed with another key is refused the same way; the app stays on the last good update.

Two things the commands above need on this machine: the Release simulator build takes
`ONLY_ACTIVE_ARCH=YES ARCHS=arm64` (the SSH module's libssh2 has no x86_64 simulator slice), and zsh does
not split `$L`, so pass the flags inline.

On a real phone (2026-11-14, a TestFlight install of 1.0.1 (5)): the first real update (manifest
`80207f58`) applied on the second cold start and Settings showed its id; the server then saw that phone
ask with the update as its current one and answered 204.

Not checked on a device yet: the rollback after a crash at launch, a wrong runtime (the server never
serves one: unit tested), Android.


## App config (ADR plan step 7, applied)

Verified against the [SDK 58 app config](https://docs.expo.dev/versions/v58.0.0/config/app/), the
[SDK 58 Updates page](https://docs.expo.dev/versions/v58.0.0/sdk/updates/) and the expo-updates 58.0.22
source. Covered by `apps/mobile/src/config/appConfig.test.ts`, which resolves the config the way
prebuild does.

- `apps/mobile/app.json`: `"runtimeVersion": { "policy": "fingerprint" }`.
- **The official-build flag** is the update server's manifest URL: `UPDATES_URL` in the environment, or
  `"updatesUrl"` in the gitignored `apps/mobile/app.local.json` (the environment wins, as for
  `APPLE_TEAM_ID`; the file is what an Xcode archive from the Dock sees). No URL is in the repository.
  `apps/mobile/app.config.js` turns updates on only when the flag is set **and** the build is signed for
  production APNs (`APNS_ENVIRONMENT=production`, what `release-ios.mjs` sets):
  ```js
  updates: {
    enabled: true,
    url: '<the flag>',
    codeSigningCertificate: './certs/updates.pem',
    codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    enableBsdiffPatchSupport: false,   // the server never sends patches (226); keep requests plain
  },
  ```
  Everything else gets `updates: { enabled: false }`: a fork or a build from source (no flag), device
  installs signed for development, the simulator suite and development builds (development APNs,
  whatever the flag says). They never contact an update server and run only their embedded JS.
  `requestHeaders` stays unset (baked into the binary; TestFlight and the App Store share it),
  `disableAntiBrickingMeasures` false, `useEmbeddedUpdate` true, `maxUpdatesToKeep` 2 (defaults).
- **Refusals** (the config step fails, so prebuild and the fingerprint fail with it): the flag set with no
  certificate file ("an official build never accepts unsigned updates"); a URL that is not https
  (plain http only to loopback); `UPDATES_CERTIFICATE` / `"updatesCertificate"` (a throwaway
  certificate's path, for the local test) with anything but a loopback URL.
- **For a store build**: put `"updatesUrl": "https://<update domain>/manifest"` in `app.local.json` (or
  export `UPDATES_URL` in the release shell) once the certificate is committed (owner step 1) and the
  Worker is deployed (step 3), then run `release-ios.mjs` as usual. It prints whether updates are on and
  checks the result before upload ([release guide](release.md), "The checks").
- **Android is off** in every build: `apps/mobile/plugins/withUpdatesIosOnly.js` writes
  `expo.modules.updates.ENABLED=false` into the Android manifest after expo-updates does (ADR 0028,
  Decided).
- `apps/mobile/fingerprint.config.js`: `extraSources` adds the root `patches/` folder (checked
  2026-11-14 with `@expo/fingerprint` 0.21.8: the default only hashes a `patches/` folder inside
  `apps/mobile`), and `fileHookTransform` leaves the `updates` block out of the hashed Expo config.
  Without that, the flag, the URL and the certificate path changed the fingerprint (measured: three
  different hashes for no flag, the loopback URL and another URL), so an official build's runtime would
  differ from the one the release and publish scripts compute without knowing the URL. Those fields say
  where updates come from, not what JS the binary runs.
- `scripts/lib/runtime-version.mjs` always cross-checks its hash with `expo-updates runtimeversion:resolve`
  and fails on any difference; a test pins that the flag does not change the runtime. `release-ios.mjs`
  refuses a build whose `EXUpdates.bundle/fingerprint` is missing or differs from the runtime it records.

## The app side

- `apps/mobile/src/updates/appUpdates.ts`: the `AppUpdates` interface over `expo-updates`, with a fake
  (`fakeUpdatesApi`) and `disabledUpdates`; `deviceUpdates.ts` loads the native module lazily and never on
  web. Tests run with updates off (`jest.setup.js`), as a build from source does.
- No channel setting: the user chooses nothing. Builds up to 1.0.1 (5) still show an "Early Updates"
  switch until they run newer JS; it sends `channel=beta`, which the server serves production. The
  change that makes TestFlight installs ask for `internal` is on branch `internal-channel-app`, not merged
  (it waits on one added clause in the privacy policy; ADR 0028, "Amendment: internal channel").
- **Update** row (Settings, About; only when the build has updates): "Built In" for the binary's own JS, or the running update's
  first 8 id characters as the value with its date as the row's second line (both on one line were cut
  on a phone); the Report a Problem text carries both as `- Update: <id> (<date>)`.
- Updates download at launch and apply on the next cold start, silently. The app never checks, fetches or
  reloads by itself and logs nothing about updates; demo mode is no different.

## Store and privacy wording (applied 2026-11-14, ADR 0028 section 7)

Applied: the policy (`packages/relay/src/privacy.js`, English and Spanish, section "App updates"),
`docs/store/listing.md` (App Review notes, one line in each description) are updated. The in-app
texts needed no change. The drafts below are kept for reference.

**Before submitting the store build with updates:** the relay must be deployed (it serves the policy
at `/privacy`) and the App Store Connect texts updated (review notes, description, promotional
text if it repeats the claims), or the published texts will contradict the build.

**Privacy policy, new section "App updates":**

> The app can receive updates to its own code from the developer's update server, hosted on
> Cloudflare. At each launch it asks that server whether an update exists. The request carries your
> IP address, the platform, the app's version identifiers and the identifier of the update it runs, a
> random identifier created when the app was installed and, if the app crashed since the last check,
> the error message. The server uses this only to answer the request and stores none of it: it keeps
> no logs and no analytics. Updates are signed by the developer, and the app refuses any update that
> is not. No content from your Hosts, sessions or messages is sent to the update server.

**App Review note** (replaces "it does not download or run code on the device"):

> The app uses expo-updates to download signed updates to its own JavaScript from the developer's
> server, only to fix and refine features reviewed here (DPLA 3.3.1(B), Guideline 2.5.2). New features
> ship through App Review. Updates are code-signed; the app rejects unsigned ones. No user content
> passes through the update server.

**Listing:** keep "Your code and prompts go from one to the other, not through our servers". Where the
copy says there is no server of ours, say "no account" and "your sessions never pass through our
servers" instead. App Privacy stays "Data Not Collected" as long as the Worker keeps nothing
(`packages/updates-server/README.md`, "What the Worker sees, and discards").

**Why "Data Not Collected" stays:** Apple defines "collect" as "transmitting data off the device in a way
that allows you and/or your third-party partners to access it for a period longer than what is necessary
to service the transmitted request in real time"
([App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)). The update server
answers each check from memory, with no logs, analytics or storage, so no one can access the request
afterwards and nothing is stored or linked to a user. That holds only while the Worker keeps nothing:
logging the install id or the error header would turn it into Device ID and Diagnostics.
