# pep-driver operations — transports, bootstrap, agent lifecycle, recovery

Everything about _getting and keeping a working connection_ to a box. Read this when preflight fails,
when the agent misbehaves, or when working on a box type you haven't driven before.

> Ground truth for the toolchain itself lives in the companion repo `pep-driver` (`cli/pep`,
> `cli/inventory.py`, `agent/`). This file is the operator's view.

## 1. Transports — the CLI auto-selects

`cli/inventory.py` reads the tenant's ansible `hosts` file and the CLI dispatches on
`ansible_connection`. The same `pep` commands work over either transport.

| Box type                                    | Inventory marker               | Command channel            | File copy                                   | Loopback RPC                                                                 | Mac prereqs              |
| ------------------------------------------- | ------------------------------ | -------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| **SSH** (default, `ct-*` tenants)           | _(no `ansible_connection`)_    | `sshpass` + `ssh`          | `scp`                                       | `curl.exe` over SSH, stdin-piped                                             | `sshpass`                |
| **WinRM** (no sshd, e.g. `preview-feature`) | `ansible_connection=winrm`     | `pywinrm` NTLM (`run_cmd`) | **SMB** `mount_smbfs //DOM;user:pw@host/C$` | `curl.exe` driven by PowerShell, body base64→temp file, response base64 back | `pywinrm`, `mount_smbfs` |
| **Key-auth** (DeployMate envs)              | `ansible_ssh_private_key_file` | `ssh -i <key>`             | `scp -i`                                    | as SSH                                                                       | the private key on disk  |

Inventory keys parsed: `ansible_connection`, `ansible_winrm_transport` (default `ntlm`),
`ansible_winrm_scheme` (default `http`), `ansible_port` (default 5985 / 5986 for https),
`ansible_user`, `ansible_password`, `ansible_ssh_private_key_file`. Host is taken from the first
non-empty group of `applicationservers`, `fileservers`, `idmservers`, `dbservers`.
Override the inventory location with `PEP_ANSIBLE_ROOT=<dir containing inventories/>`.

**WinRM RPC detail that matters:** do **not** switch the loopback call to `Invoke-WebRequest` — its
`RawContentStream` handling is flaky over WSMan and returns intermittently empty responses. The
box's native `curl.exe`, invoked via the PowerShell call operator with an argument array
(`& curl.exe @args`), is reliable and preserves umlauts through the base64 round-trip.

**SSH firewall (ct-\* tenants on GCP):** tcp/22 is gated by firewall rule
`public-allow-ssh-ansible` (project `ppcloud-213507`, target tag on the VM); only whitelisted office
IPs. The two `0.0.0.0/0` rules are disabled. From a new network:

```bash
gcloud compute firewall-rules update public-allow-ssh-ansible --project=ppcloud-213507 \
  --source-ranges=<existing-ranges>,$(curl -s ifconfig.me)/32
```

## 2. Bootstrap sequence

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant>"

~/dev/polypoint/pep-driver/packaging/build-bundle.sh   # once per Mac (~196M → 64M gz)
$P deploy                                              # once per box → C:\pep-driver
$P deploy --code-only                                  # ALWAYS right after (see trap below)
# start the agent — see §3 for which launcher to use
$P status                                              # want: agent: UP … interactive=True
```

**⚠ The dist bundle's `pep_agent.py` is a stale snapshot.** It ships an old agent missing newer RPC
methods (`dialogs`, `menu_path`, `click_xy`, `click_in`, `exec`). The version string stays `0.1.0`
in both, so _check the method list, not the version_. After every full `deploy`:

```bash
$P deploy --code-only
$P rpc <any-new-method>   # or just: $P dialogs — fails loudly if the agent is stale
# if it still behaves old, clear bytecode:
$P rpc exec ...  ->  or over the shell: rmdir /s /q C:\pep-driver\pepdriver\__pycache__
```

Iteration loop after changing toolchain code:

| Changed                                  | Do                                            |
| ---------------------------------------- | --------------------------------------------- |
| a single flow (`agent/flows/<n>.py`)     | `$P push-flow <n>` — hot-reloaded, no restart |
| agent ops/dispatch (`agent/pepdriver/*`) | `$P deploy --code-only` + agent restart       |
| bundled python                           | full `$P deploy` (then `--code-only` again)   |

macOS `tar` adds `._*` AppleDouble files to the bundle — harmless, not importable module names.

## 3. Agent lifecycle — which launcher, and when

The agent **must** run inside the interactive RDP desktop session. A process started plainly over
SSH/WinRM lands in non-interactive **session 0** and cannot see PEP (`status` →
`interactive=False`).

Two ways to start it, and **they are not equivalent**:

| Launcher                                                                   | What it does                                                                                                                             | Use for                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `$P agent-start`                                                           | schtasks with an **InteractiveToken** principal, auto-detecting the Active session user; runs windowless `pythonw.exe`. No human needed. | **Read-only** work: `status`, `tree`, `find`, `read`, `dialogs`, `screenshot`. |
| Human double-clicks `C:\pep-driver\start-agent.cmd` in the live RDP window | Agent inherits the real interactive session context; a console window shows `pep-agent listening on 127.0.0.1:8765`.                     | **Driving PEP** — clicks, keys, flows.                                         |

**Why:** verified on `preview-feature` 2026-07-22 — an agent launched by the schtasks
InteractiveToken task can screenshot and drive the _shell_ (Start button, taskbar clock) but its
synthetic input **no-ops on PEP specifically**. It survives a plain restart and `/rl HIGHEST`
elevation, so it is neither an integrity/UIPI issue nor a stale desktop. The symptom to recognise:
**screenshots render live (the clock advances) but `clickxy` does nothing on PEP**, while the same
coordinates work on the shell. The fix is always the human double-click. On `ct-*` boxes
`agent-start` has driven PEP fine — treat the schtasks path as "try it, but fall back to the
double-click the moment PEP ignores input", and don't burn a session diagnosing it.

`$P agent-stop` tears the scheduled task down.

**qwinsta locale:** the Active-session detection matches both `Active` and German `Aktiv`. On
standalone/workgroup VMs `%USERDOMAIN%` is `WORKGROUP` → the CLI falls back to `%COMPUTERNAME%`
for the schtasks `/ru` account.

## 4. Recovery runbook

### "empty response from agent (curl rc=0)", then `status` hangs to the 120 s timeout

Stray agents fighting over port 8765 — usually the result of start/kill cycling. **Stop restarting.**

```cmd
taskkill /f /im python.exe & taskkill /f /im pythonw.exe
netstat -ano | findstr :8765          :: must print nothing
```

Then start exactly **one** agent (§3). Never run the agent in the foreground over WinRM: the
detached child inherits the WSMan pipe and the Mac call hangs to its timeout. For a one-off
foreground debug use `Start-Process … -RedirectStandardOutput a.out -RedirectStandardError a.err`
and read the files.

### `python.exe - Fehler in Anwendung` / agent dies on `pep windows`

On some UIA-opaque boxes (verified `preview-feature` 2026-07-24) enumerating top-level UIA windows
while PEP is foreground crashes the agent with a memory access violation. PEP itself survives with
data intact.

**On such a box, work in screenshot-only mode:** `screenshot` + `clickxy` + `keys`. Do not call
`windows`, `tree`, `find`, or anything else that enumerates the UIA tree. To check whether an app is
running, screenshot the taskbar. Recovery needs a human: OK the crash dialog in RDP, then
double-click `start-agent.cmd`.

### Disconnected RDP session

UIA **reads** (`find`/`tree`/`read`/`exists`) keep working, but `screenshot` fails with
"screen grab failed" and any mouse/keyboard injection fails with "There is no active desktop".
Reactivate by opening an RDP connection — macOS "Windows App" with a `.rdp` file carrying
`full address` and `username` auto-connects when creds are stored. `tscon <id> /dest:console`
needs the session password. A reconnect may land in a **new session** — relaunch the agent there.

### PEP shows "Bitte melden Sie sich neu an."

PEP's own re-login, an embedded-Chromium Keycloak form with the username prefilled. Drive it with
rect-fraction clicks + `keys` (same technique as the usradmin login, see
[USRADMIN-UI-MAP.md](USRADMIN-UI-MAP.md)). It can hold the foreground over other windows.

## 5. Fresh / headless boxes (DeployMate envs)

A just-provisioned env has **neither** precondition the skill assumes:

1. **No interactive session** — `qwinsta` shows `console 1 Conn`, not Active; autologon regkeys empty.
2. **PEP is not initialized** — `pepwin.exe` exists but its login profile is missing.

PEP keeps **no `ecplan.ini`** for DB/login (the `ecplan.ini.comserver` file is an unrelated COM stub)
— it is all in the registry under `HKLM\SOFTWARE\POLYPOINT\Config\IDM`
(`PPConfig_Url=<env keycloak host>`, `PPConfig_Port=8303`). `pepwin.exe` is **32-bit**, so the
profile must exist in **both** `SOFTWARE\POLYPOINT` and `SOFTWARE\Wow6432Node\POLYPOINT`. Base
images write only `Config\PTC_IDM`, so a fresh env dead-ends until `Config\IDM` is added.

The ansible role `roles/deploymate/finalize/tasks/pep-auto-init.yml` writes both views plus
`AutoAdminLogon` for `pp-01` and reboots once (then re-run `ensure-oracle-up`). Console/username
detection there is locale-independent — do not grep the localized "Active" state text.

Unlike usradmin's login, **PEP's IDM login form is UIA-readable**: `edit auto=username`,
`edit auto=password`, `button auto=kc-login`. After login a benign
`api/v1/tenants/config` "cloud features unavailable" warning pops — OK it, PEP main opens.

Synthesise an inventory for an env the CLI can read:

```
$PEP_ANSIBLE_ROOT/inventories/deploymate/<env-id>/hosts
  [applicationservers]
  <external-ip>
  [applicationservers:vars]
  ansible_user=pp-01
  ansible_password="<RDP pw from the reveal endpoint>"
```

## 6. Oracle cross-check

PEP is one oracle; **api-pp is the faster one** for values. Cross-check reads (poco onprem
port-forward + direct queries / Bruno). Two asymmetries worth remembering:

- api-pp **planning writes silently no-op on days that already carry stamps** — use PEP for those.
- api-pp `direct-shift-planning` **cannot keep allowances**: the legacy path throws
  `OptionNotAllowedInLegacyPlanningException`, and the batch/ROSTER path only honours the policy for
  FULL-day plannings and needs a planned-layer `ALLOWANCE_TYPE` that must-stamp employees never
  have. Painting in PEP (see the `drag_paint` recipe in [GOTCHAS.md](GOTCHAS.md)) is the way.
- For permission changes, the **wire** is the oracle:
  `/api/mobile/unified-time-recording/v1/days` → per-item `allowed_actions` proves which function
  your click actually hit, far better than re-reading matrix pixels.
