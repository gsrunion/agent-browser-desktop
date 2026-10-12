# Agent Browser Desktop

A browser for a background agent that you can also see and control.

One Docker container runs headed Chromium, a 1440 × 900 desktop, VNC, and Playwright MCP. The agent and your VNC viewer use the **same browser**, with the same tabs and session. No browser runs on the host, and you do not need a host display server or Node installation.

This repository is a clean starter: no browsing history, cookies, credentials, profiles, downloads, or personal agent configuration are included. Each new deployment starts with an empty profile.

## Start

Install Docker with Compose on a Linux host or use Docker Desktop on macOS/Windows. Allow about 2 GB of RAM for the container.

```sh
git clone https://github.com/gsrunion/agent-browser-desktop.git
cd agent-browser-desktop
docker compose pull
docker compose up -d --no-build
docker compose ps
```

This pulls `ghcr.io/gsrunion/agent-browser-desktop:latest`, available for Linux ARM64 and AMD64. Wait for the container to become `healthy`. For a fixed version, set `BROWSER_IMAGE=ghcr.io/gsrunion/agent-browser-desktop:v0.1.1` in `.env`.

To build locally instead, run `docker compose up -d --build`. The Dockerfile installs Chromium and the MCP packages without copying any runtime data.

| Connection | Default address | Purpose |
| --- | --- | --- |
| MCP | `http://127.0.0.1:18795/mcp` | Streamable HTTP tools for your agent |
| VNC | `127.0.0.1:5901` | View the desktop and use mouse/keyboard |

Both ports are bound to **host loopback only**. Copy `.env.example` to `.env` to change them before starting.

### Prebuilt ARM64 image

The [v0.1.0 release](https://github.com/gsrunion/agent-browser-desktop/releases/tag/v0.1.0) includes a clean ARM64 image archive for Raspberry Pi and Apple Silicon Docker environments. After cloning this repository, download `agent-browser-desktop-v0.1.0-linux-arm64.tar.gz` and `SHA256SUMS` from the release, then:

```sh
shasum -a 256 -c SHA256SUMS
docker load -i agent-browser-desktop-v0.1.0-linux-arm64.tar.gz
BROWSER_IMAGE=agent-browser-desktop:local docker compose up -d --no-build
```

Use the source build on AMD64. The release archive is an exported **built image**, never a committed runtime container, and contains no saved browser state.

## Connect a background agent

For an MCP client running on the same host:

```json
{
  "mcpServers": {
    "browser": {
      "url": "http://127.0.0.1:18795/mcp"
    }
  }
}
```

Your client's HTTP MCP configuration may require a transport/type field. Use its Streamable HTTP option. This package does not include an agent or a model; bring your own MCP-compatible background agent.

If your client only supports stdio and has Node.js installed, use a bridge:

```json
{
  "mcpServers": {
    "browser": {
      "command": "npx",
      "args": ["-y", "supergateway@4.1.0", "--streamableHttp", "http://127.0.0.1:18795/mcp"]
    }
  }
}
```

The agent can navigate, inspect page snapshots, click, type, and capture screenshots. Arbitrary Playwright code execution tools are hidden and rejected by the included MCP filter. This is a narrow tool restriction, not a permission or website security boundary. Approval and task policies belong in your agent.

Use one active agent per browser. Different MCP connections share tabs and profile; they are not isolated users.

## Watch or take control

Connect a VNC viewer to `127.0.0.1:5901`. On a Mac, Screen Sharing can open `vnc://127.0.0.1:5901`. Other VNC clients may call this port `5901`, display `1`, or use `127.0.0.1::5901`.

For a remote Docker host, tunnel both ports over SSH:

```sh
ssh -N \
  -L 18795:127.0.0.1:18795 \
  -L 5901:127.0.0.1:5901 \
  user@your-docker-host
```

Then use the same localhost MCP and VNC addresses on your computer. SSH supplies authentication and encryption; VNC and MCP themselves have no authentication in this starter.

**Pause the agent before taking control.** VNC accepts keyboard/mouse input immediately, but it does not automatically suspend agent actions. Resume the agent when you are finished, with a short description of what changed. You can manually handle a login or CAPTCHA this way; doing so makes that deployment's profile sensitive.

For an agent in another container, attach it to the Compose network and use `http://browser:8000/mcp`. `localhost` in the agent container refers to itself. Services on that network can also reach VNC, so keep the network limited to trusted services.

## Persistent state and portability

Docker keeps the profile and MCP artifacts in named volumes:

- `browser-profile`: cookies, history, sessions, and browser settings.
- `browser-downloads`: tool screenshots and other MCP output files.

These volumes are separate from the image. The image stays clean even after you use the browser. Publishing an image built from this repository does not include either volume. Never publish a `docker commit` of a used container or a backup of its volumes as the clean starter.

The image has an allowlisted build context: only the Dockerfile, supervisor configuration, MCP filter, and smoke-check script are sent into it. There are no personal bind mounts, credentials, or hardcoded deployment paths.

Move the source to another Docker host and run `docker compose pull` followed by `docker compose up -d --no-build` for a fresh instance. Linux ARM64 and AMD64 builds use the same Dockerfile; validation performed for this release is listed below. Keep the hostname stable when recreating a container so Chromium's profile lock remains valid. Never mount one profile in two running browsers.

## Operations

```sh
# Read service logs
docker compose logs --tail=100 browser

# Test MCP navigation and page snapshots (changes the active tab)
docker compose exec browser node /opt/mcp/smoke.mjs

# Optional VNC framebuffer and keyboard test on that smoke-test page
python3 scripts/check-vnc.py --type-test
docker compose exec browser node /opt/mcp/smoke.mjs --verify-vnc

# Stop; profile and downloads remain
docker compose down

# Update to the latest published image
docker compose pull
docker compose up -d --no-build

# Or update Chromium packages by rebuilding locally
docker compose build --pull --no-cache
docker compose up -d
```

To copy tool artifacts out, find the container with `docker compose ps -q browser`, then use `docker cp CONTAINER_ID:/downloads/. ./downloads/`. Files saved through Chromium's own GUI may use its profile/home download settings; `/downloads` is the MCP output directory.

To start completely fresh, stop the deployment and run `docker compose down --volumes`. **This deletes its saved sessions and artifacts.**

## Trust model

Run this on a host you control. Do not expose the MCP or VNC ports directly to the internet. Anyone who can reach them can operate the browser and access its sessions. Chromium's debugging ports are internal only.

Chromium runs as an unprivileged container user with `--no-sandbox`; Docker supplies the process boundary, with dropped capabilities and `no-new-privileges`. This is not a hardened sandbox for hostile users or untrusted agents. Websites can still reach the container's outbound network. Apply host/network policies if the agent should not reach private services.

The package does not include the original deployment's Telegram approvals or agent-specific control flow. It also does not include the unrelated search/page-fetch MCP service.

## Components

- [Chromium](https://www.chromium.org/) on Debian Trixie
- Xvfb, Openbox, and x11vnc for the visible desktop
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp), pinned to `0.0.83`
- [Supergateway](https://github.com/supercorp-ai/supergateway), pinned to `4.1.0`, serving Streamable HTTP
- Supervisor for startup, child processes, and restarts

Node and Debian base tags follow their maintained release lines; distro Chromium packages update when you rebuild without cache. JavaScript direct dependencies are version-pinned; transitive dependency resolution is performed during each build. Version tags and `latest` are published to [GitHub Container Registry](https://github.com/gsrunion/agent-browser-desktop/pkgs/container/agent-browser-desktop).

## Publishing

Pushing a version tag such as `v0.1.1` starts the included GitHub Actions workflow. It builds on native ARM64 and AMD64 runners, tests MCP and VNC control plus browser-session persistence, and publishes the tested images and combined platform manifest to GHCR. The workflow uses GitHub's short-lived token with package-write permission; no registry credential is stored in the repository or image. A new GHCR package defaults to private; its owner must set its visibility to public for anonymous pulls.

## Validation

Validated on Linux ARM64 using Docker on macOS: clean image build, empty image profile, MCP initialization and tool filtering, browser navigation and snapshots, VNC framebuffer and keyboard input, and container recreation with the profile and open tab preserved. AMD64 is supported by the upstream images and packages but has not been tested for this release. See `smoke.mjs` and `scripts/check-vnc.py` for the checks.

## License

The repository's original configuration and scripts are MIT licensed. Installed components retain their own licenses.
