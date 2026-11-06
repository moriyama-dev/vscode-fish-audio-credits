# Credit Balance for Fish Audio

See how many Fish Audio credits you have left without leaving VS Code. Your balance stays in the status bar and refreshes on its own.

## Install

The extension works the same on Windows, macOS and Linux (including Ubuntu).

### VS Code

1. Open the Extensions view: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on Windows and Linux, <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> on macOS.
2. Search for **Credit Balance for Fish Audio** and click **Install**.

You can also install it from the [Visual Studio Marketplace page](https://marketplace.visualstudio.com/items?itemName=moriyama-dev.vscode-fish-audio-credits), or from a terminal:

```sh
code --install-extension moriyama-dev.vscode-fish-audio-credits
```

**Updates are automatic.** VS Code installs new versions from the Marketplace by itself (unless you turned off `extensions.autoUpdate`).

### VSCodium

The extension is not on Open VSX yet, so install the `.vsix` file from GitHub Releases. Once it is on Open VSX, VSCodium will find it in the Extensions view and update it automatically like any other extension.

**The easy way (all operating systems):**

1. Download `vscode-fish-audio-credits-<version>.vsix` from the [latest release](https://github.com/moriyama-dev/vscode-fish-audio-credits/releases/latest).
2. In VSCodium, open the Extensions view, click the **...** menu at the top and choose **Install from VSIX...**, then pick the downloaded file.

**Install or update with one command.** Run the same command again whenever a new version is released; it always fetches the latest one.

macOS and Ubuntu (Terminal):

```sh
url=$(curl -fsSL https://api.github.com/repos/moriyama-dev/vscode-fish-audio-credits/releases/latest | grep -o 'https://[^"]*\.vsix' | head -n 1) && curl -fsSL -o /tmp/vscode-fish-audio-credits.vsix "$url" && codium --install-extension /tmp/vscode-fish-audio-credits.vsix --force
```

Windows (PowerShell):

```powershell
$u = (Invoke-RestMethod https://api.github.com/repos/moriyama-dev/vscode-fish-audio-credits/releases/latest).assets | Where-Object name -like '*.vsix' | Select-Object -First 1 -ExpandProperty browser_download_url; Invoke-WebRequest $u -OutFile "$env:TEMP\vscode-fish-audio-credits.vsix"; codium --install-extension "$env:TEMP\vscode-fish-audio-credits.vsix" --force
```

To hear about new versions, click **Watch → Custom → Releases** on the [GitHub repository](https://github.com/moriyama-dev/vscode-fish-audio-credits).

### If `code` or `codium` is not found

- **macOS:** open VS Code (or VSCodium), press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and run **Shell Command: Install 'code' command in PATH** (**'codium'** in VSCodium). Then open a new Terminal window.
- **Windows:** the installer adds the command to `PATH`; open a new PowerShell window after installing the editor.
- **Ubuntu:** the `.deb`, Snap and apt packages all add the command. If you use the `.tar.gz` build, call `bin/code` or `bin/codium` inside its folder.

## Features

- **Plan credits in the status bar**, for example `100,712`. Accounts without a plan see their pay-as-you-go API credit in US dollars instead.
- **Details on hover**: plan name, remaining and total credits with the percentage left, when the current period ends, your API credit, and when the numbers were last updated.
- **Low balance warning**: the status bar item turns to the warning color when less than 10% of your plan credits remain. The threshold is a setting.
- **Refreshes on its own** every 30 minutes, and right away when you come back to a VS Code window after a while. Click the item to refresh now.
- **Your API key stays private**: it is kept in VS Code's secret storage, never in `settings.json`, and is sent only to `api.fish.audio`.

## Getting started

1. Create an API key on the Fish Audio [Get Started page](https://fish.audio/app/developers/get-started/). The key is shown only once, so copy it right away.
2. In VS Code, click **Fish Audio** in the status bar, or run **Fish Audio: Set API Key** from the Command Palette.
3. Paste the key. The extension checks it with Fish Audio before saving it, so a mistyped key never replaces a working one.

## Commands

| Command                                | What it does                                          |
| -------------------------------------- | ----------------------------------------------------- |
| **Fish Audio: Set API Key**            | Saves or replaces your API key                        |
| **Fish Audio: Remove API Key**         | Deletes the key from VS Code                          |
| **Fish Audio: Refresh Credit Balance** | Reads the balance now                                 |
| **Fish Audio: Open Billing Page**      | Opens the Fish Audio API billing page in your browser |

## Settings

| Setting                                    | Default | Description                                                                                              |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------- |
| `fishAudioCredits.refreshIntervalMinutes`  | `30`    | Minutes between refreshes, from 5 to 1440                                                                |
| `fishAudioCredits.warningThresholdPercent` | `10`    | Use the warning color below this percentage of your plan total. `0` turns it off, except at zero credits |

## Privacy

The extension calls two Fish Audio endpoints, `GET /wallet/self/package` and `GET /wallet/self/api-credit`, with your API key. It sends nothing else, reads no files in your workspace, and collects no telemetry. In remote windows it runs on your own computer, so the key is not copied to the remote machine.

## Disclaimer

This is an independent extension. It is not made, endorsed or supported by Fish Audio.

## License

MIT. See the `LICENSE` file included with the extension.
