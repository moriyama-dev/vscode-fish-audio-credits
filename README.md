# Credit Balance for Fish Audio

English | [日本語](README.ja.md)

See how many Fish Audio credits you have left without leaving VS Code. Your balance stays in the status bar and refreshes on its own.

Found a problem or have an idea? [Open an issue on GitHub](https://github.com/moriyama-dev/vscode-fish-audio-credits/issues).

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

1. Open the Extensions view, with the same shortcut as in VS Code.
2. Search for **Credit Balance for Fish Audio** and click **Install**.

VSCodium gets the extension from [Open VSX](https://open-vsx.org/extension/moriyama-dev/vscode-fish-audio-credits). You can also install it from a terminal:

```sh
codium --install-extension moriyama-dev.vscode-fish-audio-credits
```

**Updates are automatic** here too: VSCodium installs new versions from Open VSX by itself.

### From a `.vsix` file

Every release also has a `.vsix` file on [GitHub Releases](https://github.com/moriyama-dev/vscode-fish-audio-credits/releases/latest), for editors that use neither the Marketplace nor Open VSX. In the Extensions view, click the **...** menu at the top, choose **Install from VSIX...** and pick the downloaded file. A copy installed this way does not update itself, so install the newer file when a new version is released.

### If `code` or `codium` is not found

- **macOS:** open VS Code (or VSCodium), press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and run **Shell Command: Install 'code' command in PATH** (**'codium'** in VSCodium). Then open a new Terminal window.
- **Windows:** the installer adds the command to `PATH`; open a new PowerShell window after installing the editor.
- **Ubuntu:** the `.deb`, Snap and apt packages all add the command. If you use the `.tar.gz` build, call `bin/code` or `bin/codium` inside its folder.

## Features

- **Plan credits in the status bar**, for example `100,712`. Accounts without a plan see their pay-as-you-go API credit in US dollars instead.
- **Details on hover or click**: plan name, remaining and total credits with the percentage left, when your credits are next refilled (with the days left), when the plan's paid period ends, your API credit, and when the numbers were last updated. Hover over the item to see them, or click it to open the same details in a list at the top of the window, with **Refresh**, **Change API key** and **Billing** below them.
- **Next credit reset**: Fish Audio refills plan credits once a month. The extension uses the refill day the API reports, or else the day and time of month the plan period ends, and shows the next date in your local time.
- **Low balance warning**: the status bar item turns to the warning color when less than 10% of your plan credits remain. The threshold is a setting.
- **Refreshes on its own** every 30 minutes, and right away when you come back to a VS Code window after a while. Pick **Refresh** in the details, or run **Fish Audio: Refresh Credit Balance**, to refresh now.
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
| **Fish Audio: Show Credit Details**    | Shows the details, like clicking the status bar item  |
| **Fish Audio: Open Billing Page**      | Opens the Fish Audio API billing page in your browser |

## Settings

| Setting                                    | Default | Description                                                                                              |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------- |
| `fishAudioCredits.refreshIntervalMinutes`  | `30`    | Minutes between refreshes, from 5 to 1440                                                                |
| `fishAudioCredits.warningThresholdPercent` | `10`    | Use the warning color below this percentage of your plan total. `0` turns it off, except at zero credits |

## Keeping your API key safe

**Where the key is stored.** The key goes into VS Code's secret storage, which the editor encrypts with your operating system's credential store:

- **macOS:** Keychain
- **Windows:** Windows data protection (DPAPI), tied to your Windows account
- **Linux:** the Secret Service (GNOME Keyring or KWallet)

It is never written to `settings.json`, so Settings Sync, dotfile backups and shared workspaces do not carry it. Other extensions cannot ask VS Code for it, because each extension only sees its own secrets.

**What the extension does with it.**

- Sends it only to `https://api.fish.audio`, over HTTPS. The address is fixed in the code, not a setting, so a workspace cannot point the key elsewhere.
- Refuses to follow redirects, so the key is never sent on to another address.
- Checks a new key with Fish Audio before saving it. A mistyped key never replaces a working one.
- Never writes the key to the log, the status bar or error messages.
- Accepts only a single run of visible characters, so a stray space or line break is caught when you paste.

**Good habits.**

- Create a separate key just for this extension, and name it so you recognize it (for example `VS Code credits`). If you need to cut it off, delete only that key on Fish Audio's [API Keys page](https://fish.audio/app/api-keys); your other tools keep working.
- Run **Fish Audio: Remove API Key** on computers you stop using.
- If you think the key leaked, delete it on Fish Audio first, then set a new one.
- **Linux:** if no keyring is running, VS Code falls back to a weaker built-in encryption and shows a warning about it. Install and unlock GNOME Keyring (`sudo apt install gnome-keyring`) or KWallet, then set the key again.

## Privacy

The extension calls two Fish Audio endpoints, `GET /wallet/self/package` and `GET /wallet/self/api-credit`, with your API key. It sends nothing else, reads no files in your workspace, and collects no telemetry. In remote windows it runs on your own computer, so the key is not copied to the remote machine.

## Disclaimer

This is an independent extension. It is not made, endorsed or supported by Fish Audio.

## License

MIT. See the `LICENSE` file included with the extension.
