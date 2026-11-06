# Changelog

## 0.2.0 - 2026-11-06

- Click the status bar item to see the details in a list at the top of the window. Before, a click refreshed the balance, and the details only appeared on hover. Refresh is now in the details and in the Command Palette.
- The details show when the plan credits are next refilled each month, with the days left. The end of the plan's paid period is shown separately.
- New command: **Fish Audio: Show Credit Details**.
- The API key is never sent on through a redirect, and a pasted key with spaces, line breaks or other stray characters is caught before it is checked.
- The README explains where the key is stored on each operating system and how to keep it safe. It is also available in Japanese (README.ja.md).
- The release workflow publishes from a separate job that runs no tests and no install scripts, and its GitHub Actions are pinned to commit SHAs.

## 0.1.1 - 2026-11-06

- Install in VSCodium and in VS Code 1.143. The extension needed VS Code 1.144 before, which VSCodium has not reached yet.
- The README explains how to install and update the extension in VS Code and VSCodium on Windows, macOS and Ubuntu.

## 0.1.0 - 2026-11-03

Initial release.

- Show the remaining Fish Audio plan credits, or the API credit when there is no plan, in the status bar.
- Hover for the plan total, the percentage left, the end of the current period, the API credit and the time of the last update.
- Warning color below a configurable share of the plan total.
- Refresh every 30 minutes, when a window regains focus after the interval, and on click.
- Keep the API key in VS Code secret storage and check it with Fish Audio before saving it.
- English and Japanese UI.
