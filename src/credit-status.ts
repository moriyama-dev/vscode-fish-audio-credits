import * as vscode from 'vscode';
import { type Balances, type FetchFn, fetchBalances, InvalidApiKeyError } from './core/fish-api';
import { clampInterval, formatCredits, formatUsd, headline, isStale } from './core/presentation';

export const CONFIG_SECTION = 'fishAudioCredits';
export const SECRET_KEY = 'fishAudioCredits.apiKey';
export const COMMANDS = {
  setApiKey: 'fishAudioCredits.setApiKey',
  clearApiKey: 'fishAudioCredits.clearApiKey',
  refresh: 'fishAudioCredits.refresh',
  openBilling: 'fishAudioCredits.openBilling',
} as const;

const ICON = '$(unmute)';

type State =
  | { kind: 'noKey' }
  | { kind: 'loading' }
  | { kind: 'ok'; balances: Balances }
  | { kind: 'invalidKey' }
  | { kind: 'failed'; message: string; lastKnown: Balances | undefined };

/** The status bar item, and the refresh schedule behind it. */
export class CreditStatus implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private timer: NodeJS.Timeout | undefined;
  private state: State = { kind: 'loading' };
  private lastSuccess: Balances | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly log: vscode.LogOutputChannel,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    this.item = vscode.window.createStatusBarItem('fishAudioCredits.balance', vscode.StatusBarAlignment.Right, 100);
    this.item.name = vscode.l10n.t('Fish Audio Credits');
    this.disposables.push(
      this.item,
      // Coming back to a window after a while shows a fresh number.
      vscode.window.onDidChangeWindowState((windowState) => {
        if (windowState.focused && isStale(this.lastSuccess?.fetchedAt, this.intervalMinutes(), new Date())) {
          void this.refresh();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
          this.schedule();
          this.render();
        }
      }),
      // Another window set or removed the key.
      secrets.onDidChange((event) => {
        if (event.key === SECRET_KEY) {
          void this.refresh();
        }
      }),
    );
    this.render();
    this.item.show();
    this.schedule();
  }

  /** The current state, for tests. */
  get current(): Readonly<State> {
    return this.state;
  }

  /** The status bar item, for tests. */
  get statusBarItem(): vscode.StatusBarItem {
    return this.item;
  }

  refresh(): Promise<void> {
    // Several triggers can fire together (startup, focus, key change); one request is enough.
    this.inFlight ??= this.doRefresh().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  dispose(): void {
    clearInterval(this.timer);
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async doRefresh(): Promise<void> {
    const apiKey = await this.secrets.get(SECRET_KEY);
    if (!apiKey) {
      this.lastSuccess = undefined;
      this.setState({ kind: 'noKey' });
      return;
    }
    if (!this.lastSuccess) {
      this.setState({ kind: 'loading' });
    }
    try {
      const balances = await fetchBalances(apiKey, this.fetchFn);
      this.lastSuccess = balances;
      this.setState({ kind: 'ok', balances });
      this.log.info(
        `Refreshed: plan ${balances.plan ? `${balances.plan.balance}/${balances.plan.total}` : 'none'}, ` +
          `API credit ${balances.apiCredit?.credit ?? 'unknown'}`,
      );
    } catch (error) {
      if (error instanceof InvalidApiKeyError) {
        this.lastSuccess = undefined;
        this.log.warn('The API key was rejected.');
        this.setState({ kind: 'invalidKey' });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`Refresh failed: ${message}`);
      this.setState({ kind: 'failed', message, lastKnown: this.lastSuccess });
    }
  }

  private setState(state: State): void {
    this.state = state;
    this.render();
  }

  private schedule(): void {
    clearInterval(this.timer);
    this.timer = setInterval(() => void this.refresh(), this.intervalMinutes() * 60_000);
  }

  private intervalMinutes(): number {
    return clampInterval(vscode.workspace.getConfiguration(CONFIG_SECTION).get<number>('refreshIntervalMinutes', 30));
  }

  private warningThreshold(): number {
    return vscode.workspace.getConfiguration(CONFIG_SECTION).get<number>('warningThresholdPercent', 10);
  }

  private render(): void {
    const item = this.item;
    const locale = vscode.env.language;
    item.backgroundColor = undefined;
    item.command = COMMANDS.refresh;

    switch (this.state.kind) {
      case 'noKey':
        item.text = `$(key) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = vscode.l10n.t('Set your Fish Audio API key to show your remaining credits.');
        item.command = COMMANDS.setApiKey;
        return;
      case 'loading':
        item.text = `$(sync~spin) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = vscode.l10n.t('Reading your Fish Audio credits...');
        return;
      case 'invalidKey':
        item.text = `$(key) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = vscode.l10n.t('Fish Audio rejected the API key. Click to enter a new one.');
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        item.command = COMMANDS.setApiKey;
        return;
      case 'ok': {
        const head = headline(this.state.balances, this.warningThreshold(), locale);
        item.text = `${ICON} ${head.text}`;
        if (head.severity !== 'normal') {
          item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        item.tooltip = this.tooltip(this.state.balances, undefined);
        return;
      }
      case 'failed': {
        const known = this.state.lastKnown;
        item.text = known
          ? `$(warning) ${headline(known, this.warningThreshold(), locale).text}`
          : `$(warning) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = this.tooltip(known, this.state.message);
        return;
      }
    }
  }

  private tooltip(balances: Balances | undefined, error: string | undefined): vscode.MarkdownString {
    const locale = vscode.env.language;
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = { enabledCommands: [COMMANDS.refresh, COMMANDS.setApiKey, COMMANDS.openBilling] };
    md.appendMarkdown(`**${vscode.l10n.t('Fish Audio Credits')}**\n\n`);
    if (error) {
      md.appendMarkdown(`$(warning) ${escape(vscode.l10n.t('Could not refresh: {0}', error))}\n\n`);
    }
    if (balances) {
      const { plan, apiCredit } = balances;
      if (plan) {
        const head = headline(balances, this.warningThreshold(), locale);
        const percent = head.remainingPercent === undefined ? '' : ` (${Math.round(head.remainingPercent)}%)`;
        md.appendMarkdown(
          `${escape(vscode.l10n.t('Plan'))}${plan.type ? ` (${escape(plan.type)})` : ''}: ` +
            `**${formatCredits(plan.balance, locale)}** / ${formatCredits(plan.total, locale)}${percent}\n\n`,
        );
        if (plan.finishedAt) {
          md.appendMarkdown(
            `${escape(vscode.l10n.t('Current period ends: {0}', plan.finishedAt.toLocaleString(locale)))}\n\n`,
          );
        }
      } else {
        md.appendMarkdown(`${escape(vscode.l10n.t('Plan: none'))}\n\n`);
      }
      if (apiCredit) {
        md.appendMarkdown(`${escape(vscode.l10n.t('API credit'))}: **${formatUsd(apiCredit.credit, locale)}**\n\n`);
      }
      md.appendMarkdown(`${escape(vscode.l10n.t('Updated: {0}', balances.fetchedAt.toLocaleTimeString(locale)))}\n\n`);
    }
    md.appendMarkdown(
      `[$(refresh) ${escape(vscode.l10n.t('Refresh'))}](command:${COMMANDS.refresh}) · ` +
        `[$(key) ${escape(vscode.l10n.t('Change API key'))}](command:${COMMANDS.setApiKey}) · ` +
        `[$(link-external) ${escape(vscode.l10n.t('Billing'))}](command:${COMMANDS.openBilling})`,
    );
    return md;
  }
}

/** Text from the API or a translation must not be read as Markdown or links. */
function escape(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~$]/g, '\\$&');
}
