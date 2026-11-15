# Update server

A Cloudflare Worker that serves over-the-air JavaScript updates to the app with the
[Expo Updates protocol v1](https://docs.expo.dev/technical-specs/expo-updates-1/)
([ADR 0028](../../docs/decisions/0028-over-the-air-updates.md)). It is a static file server with a
protocol wrapper:

- **No secret.** Updates are signed once, on the owner's machine, by `scripts/publish-update.mjs`.
  The Worker stores and serves the manifest bytes and their `expo-signature` value exactly as the
  script wrote them. It cannot sign, so a compromised Worker or Cloudflare account cannot publish
  code: the app rejects anything not signed by the key its certificate names.
- **No state about clients.** No database, no counters, no logs, no analytics (below).
- **No dependencies.** WebCrypto, `fetch` and the R2 binding, so the tests run under plain Node.

How a publish goes, what only the owner does, and rollback: [docs/guides/updates.md](../../docs/guides/updates.md).

## Routes

### `GET /manifest`

The update check every app launch makes. The request headers that matter:

| Header | Use |
|---|---|
| `expo-protocol-version` | Must be `1`; anything else is `406`. |
| `accept` | Must admit `multipart/mixed` (the only structure served); otherwise `406`. A missing header admits it. |
| `expo-platform` | `ios` or `android`; anything else is `400`. |
| `expo-runtime-version` | The binary's runtime version (a fingerprint hash); malformed is `400`. |
| `expo-extra-params` | Exactly `channel="internal"` (an SFV dictionary whose only `channel` member is that string; TestFlight installs send it) selects the internal channel, below. Anything else gets production: no header, `channel="beta"` from older installs, a token instead of a string, a duplicated `channel`, a malformed dictionary, a value over 512 characters. |
| `eas-client-id` | Read only on production during a partial rollout, to compute the install's bucket (below). Missing or malformed is outside the rollout. |
| `expo-current-update-id` | When it equals the id of the update chosen for this request, the answer is `204`. |

Which update a request gets:

1. **Internal**, only when the request asks for it: the pointer `channels/<platform>/<runtime>/internal`,
   if it exists, parses, and its body and signature are complete. Any doubt about it falls through to
   production. An internal request that falls through gets production's newest update whatever its
   rollout percent.
2. **Production**, `channels/<platform>/<runtime>/production`. Without a `rollout` field, or at 100%,
   everyone gets its update; this is how every pointer from before rollouts is served, unchanged.
   Below 100%, a request is inside when its bucket is below the percent: the bucket is the first four
   bytes (big-endian) of SHA-256(`eas-client-id` + update id), modulo 100, so it is stable per install
   and per update, and lowering the percent only removes installs. Inside gets the update; outside
   gets `rollout.previous`, or `204` when that is `null`. A device already on the new update that
   falls outside (after the percent was lowered) is offered the older one, which expo-updates ignores
   (it never loads an older `createdAt`). A `rollout` field that is present but malformed makes the
   pointer malformed (`500`): it is never read as "everyone".

Response, when something is published for (platform, runtime version):

```
200
expo-protocol-version: 1
expo-sfv-version: 0
cache-control: private, max-age=0
content-type: multipart/mixed; boundary=<random, absent from the part>

--<boundary>
content-disposition: form-data; name="manifest"        (or name="directive")
content-type: application/json
expo-signature: <the stored value: sig="...", keyid="main", alg="rsa-v1_5-sha256">

<the stored bytes, unchanged>
--<boundary>--
```

When nothing is published, the runtime version is unknown, or the device already runs the
published update: `204` with the three protocol headers and no body, the protocol's no-op. The
expo-updates client accepts a `204` when `expo-protocol-version` is above 0, with no signature,
on iOS and Android (`FileDownloader.swift` / `FileDownloader.kt`, SDK 58).

The Worker never sends `expo-manifest-filters` or `expo-server-defined-headers`: a filter that
excludes the update a device runs would let the client load an older update (ADR 0028, Rollout),
and the server must not be able to do that.

### `GET /assets/<sha256>` (and `HEAD`)

Asset bytes, addressed by the lowercase hex SHA-256 of their content (64 characters; anything else
is `404`). Headers: the `content-type` stored with the object, `content-length`,
`cache-control: public, max-age=31536000, immutable`, `etag`. An asset URL never changes content,
as the protocol requires. Compression is left to Cloudflare's edge (the protocol allows serving
uncompressed); the client checks every asset's SHA-256 against the signed manifest anyway.

Other paths are `404`; other methods `405` with `allow`.

## Storage layout

One R2 bucket, binding `UPDATES`:

| Key | Content | Written by |
|---|---|---|
| `assets/<sha256 hex>` | asset bytes; `content-type` in the object's HTTP metadata | upload, first |
| `updates/<id>/body` | the exact signed bytes of a manifest or directive (`<id>` is the manifest `id`; a directive gets its own UUID) | upload |
| `updates/<id>/signature` | the full `expo-signature` value for those bytes | upload |
| `channels/<platform>/<runtime version>/production` | `{"kind","id","rollout":{"percent":0..100,"previous":{"kind","id"}\|null}}`: what store installs are served | upload, **last**; `rollout` |
| `channels/<platform>/<runtime version>/internal` | `{"kind","id"}`: what TestFlight installs are served | upload with `--channel internal`, **last** |

`kind` is `manifest` or `directive`. On production, `rollout` is optional for the Worker (absent is
100%, the shape of every pointer written before rollouts); the publish tooling always writes it,
with `previous` set to the pointer it replaced, so `revert` knows where to go back to. The
internal pointer has no rollout.

Selection is one or two reads of pointers: the publish script refuses an update whose `createdAt`
is not newer than the last production one (`docs/releases/updates.jsonl`), so production's pointer
always names the newest, as the protocol's "most recent update" requires. Writing the pointer last
means a half-finished upload is never served. Nothing is ever deleted or rewritten except the
pointers, so a device that started downloading an update can always finish.

Until 2026-11-14 there were two channels, `beta` and `production`. A pointer the retired `beta`
channel left at `channels/<platform>/<runtime version>/beta` is read by nothing and is not deleted.
Its line in the public log (`"channel":"beta"`) stays too, since the log is never rewritten; the
publish tooling reads such a line as a record of the retired channel (`isRetiredChannelEntry` in
`publish/log.js`). New lines carry no `channel`. Older installs still send `channel="beta"`; they get
production.

## Channels, rollout, revert (publish commands)

From the repository root (`--target local` is the `wrangler dev` bucket; `r2` the real one). Every
command takes `--dry-run`, which prints the pointer before and after and writes nothing: the
commands that read the bucket (`rollout`, `revert`) do it through a store whose writes throw, and
`--upload --dry-run` reads no bucket at all.

```sh
# Internal (TestFlight installs). Never logged; no rollout.
node scripts/publish-update.mjs --upload build/updates/<id> --target r2 --channel internal --base-url <url>

# Production (store installs), the default channel; --rollout defaults to 100.
node scripts/publish-update.mjs --upload build/updates/<id> --target r2 [--rollout 10] --base-url <url>

# Change only production's percent (0 stops it: nobody new gets it; 100 finishes it). No key.
node scripts/publish-update.mjs rollout 50 --target r2 [--runtime <rt>]

# Back to the previous production update, for everyone. Signs: needs the key.
node scripts/publish-update.mjs revert --target r2 --key <path> --base-url <url> [--runtime <rt>]
```

- A production upload is refused while the current production update is below 100%: the new
  pointer's `previous` would be the half-rolled-out update, and installs outside the new rollout
  would get it. Run `rollout 100` or `revert` first.
- With `--base-url`, the upload asks the deployed Worker as a device would: as an internal install,
  or as a synthetic install inside the rollout (outside it at 0%), and puts the pointer back if the
  answer is wrong.
- `revert` cannot just move the pointer back. expo-updates SDK 58 loads an update only when its
  `commitTime` (a manifest's `createdAt`) is strictly newer than the one it runs, and launches the
  newest it has stored (`LoaderSelectionPolicyFilterAware` and `LauncherSelectionPolicyFilterAware`,
  iOS and Android), so a device already on the bad update would ignore the older one. `revert`
  therefore publishes something newer and signed: when `previous` is a manifest, its content (same
  launch asset, assets, `extra`, commit) re-signed as a new manifest with a new id and `createdAt`
  now, after checking the stored copy against its signature and the public log and every asset
  against its hash; when `previous` is a directive or `null`, a new `rollBackToEmbedded` directive.
  The new pointer is at 100% with `previous: null`, so no later rollout brings back what was
  reverted; a second `revert` goes back to the embedded bundle. A pointer from before rollouts has
  no `previous`: use `rollback` and `--upload` it.
- `verify --url <url>/manifest` asks without a client id, so during a partial rollout it gets what
  installs outside it get; that passes when it is the newest log entry's `previous`.
  `verify --url ... --channel internal` checks what an internal install gets (not in the log).

The public log (`docs/releases/updates.jsonl`) is what store installs can get: only production
uploads (and reverts) are appended, each with `previous` (what installs outside its rollout get;
`null` for a revert) and, for a revert, `revertOf`. Rollout percent changes are not logged; the
pointer holds the percent. Internal uploads are never appended.

## What the Worker sees, and discards

Every update check carries (expo-updates SDK 58, iOS and Android): the IP address, `expo-platform`,
`expo-runtime-version`, `expo-protocol-version`, `expo-api-version`, `expo-updates-environment`,
`expo-current-update-id`, `expo-embedded-update-id`, `expo-recent-failed-update-ids`,
**`eas-client-id`** (a random per-install UUID), **`expo-fatal-error`** (the text of the last fatal
JS error, up to 1,024 characters), `expo-expect-signature`, and `expo-extra-params` if set.

The Worker reads platform, runtime version, protocol version, accept, the current update id and
`expo-extra-params` (only to tell whether it is exactly `channel="internal"`) to pick the answer,
and drops the request when it has answered. During a partial production rollout it also reads
`eas-client-id`, only to hash it with the update id into a bucket number, 0 to 99, which decides the
answer and is then discarded: the identifier and its bucket are never stored, logged, counted, sent
to any other service or echoed in the response (a test checks the response does not contain it).
It stores nothing, logs nothing (no `console` call anywhere; a test fails if one appears), keeps no
counters, and never reads `expo-fatal-error`. `wrangler.toml` turns Workers Logs off
(`[observability] enabled = false`); Logpush and Analytics Engine are not configured and must not
be. This is what keeps the App Store privacy label at "Data Not Collected".

## Run locally (no Cloudflare account)

```sh
cd packages/updates-server
npx wrangler dev            # http://127.0.0.1:8787, local R2 in .wrangler/state (gitignored)
```

Put a bundle in the local bucket from the repository root (docs/guides/updates.md, "Test locally"):

```sh
node scripts/publish-update.mjs --upload build/updates/<id> --target local \
  --local-test --cert <test cert> --builds <test builds.json>
curl -si http://127.0.0.1:8787/manifest -H 'expo-protocol-version: 1' -H 'expo-platform: ios' \
  -H 'expo-runtime-version: <runtime>'
```

`wrangler dev` prints one line per request on your terminal; that is the local dev server, not
the Worker. Deployed, nothing is logged (above).

## Publish tooling

`publish/` holds the Node side the owner runs through `scripts/publish-update.mjs`: `manifest.js`
(manifest and directive bodies from an `npx expo export` folder), `signing.js` (key and certificate
loading, RSA-SHA256), `create.js` (sign, verify, write a bundle), `bundle.js` (the bundle folder),
`verify.js` (client-side checks, on a folder or against a server), `upload.js` (the ordered,
never-overwriting upload with read-back before the pointer), `stores.js` (memory, the local bucket
and the real R2 bucket, both through `wrangler r2 object`), `publish-upload.js` (the upload step's
channels, refusals, dry run and log line), `pointers.js` (the production pointer's rollout rules,
the read-only store dry runs use, the `rollout` command), `revert.js` (the `revert` command),
`fake-wrangler.js` (the test stand-in for wrangler), `log.js` (the public log). They share `src/protocol.js`
with the Worker, so both sides agree on headers, SFV, multipart and the storage keys.

## Tests

```sh
pnpm test          # node --test: Worker conformance, publish tooling
```

`pnpm verify-fast` runs them whenever a file under this package changes.

## Deploy (owner only)

`node scripts/deploy.mjs [--dry-run]` from this folder, with the custom domain (and, for a login with
several accounts, the account id) in the gitignored `deploy.local.json`:
`{ "domains": ["updates.<your domain>"] }`. It checks `wrangler.toml` (the `UPDATES` binding, Workers
Logs off, no account id, no committed route) and that the bucket exists, then runs
`wrangler deploy --domain <domain>`. There is no secret to put. Creating the bucket and the rest of
the order: docs/guides/updates.md, "Owner steps".
