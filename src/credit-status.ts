import * as vscode from 'vscode';
import { type Balances, type FetchFn, fetchBalances, InvalidApiKeyError } from './core/fish-api';
import {
  clampInterval,
  daysUntil,
  formatCredits,
  formatUsd,
  headline,
  isStale,
  nextCreditReset,
  sameMoment,
} from './core/presentation';

export const CONFIG_SECTION = 'fishAudioCredits';
export const SECRET_KEY = 'fishAudioCredits.apiKey';
export const COMMANDS = {
  setApiKey: 'fishAudioCredits.setApiKey',
  clearApiKey: 'fishAudioCredits.clearApiKey',
  refresh: 'fishAudioCredits.refresh',
  openBilling: 'fishAudioCredits.openBilling',
  showDetails: 'fishAudioCredits.showDetails',
} as const;

/** One line of the details, shown both on hover and on click. */
interface DetailLine {
  icon: string;
  /** Plain text; the tooltip escapes it. */
  label: string;
  /** Shown in bold in the tooltip and as a description in the click list. */
  value?: string;
}

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
    item.command = COMMANDS.showDetails;

    switch (this.state.kind) {
      case 'noKey':
        item.text = `$(key) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = vscode.l10n.t('Set your Fish Audio API key to show your remaining credits.');
        item.command = COMMANDS.setApiKey;
        return;
      case 'loading':
        item.text = `$(sync~spin) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = this.tooltip();
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
        item.tooltip = this.tooltip();
        return;
      }
      case 'failed': {
        const known = this.state.lastKnown;
        item.text = known
          ? `$(warning) ${headline(known, this.warningThreshold(), locale).text}`
          : `$(warning) ${vscode.l10n.t('Fish Audio')}`;
        item.tooltip = this.tooltip();
        return;
      }
    }
  }

  /** The details for the current state; the same lines appear on hover and on click. */
  private details(): DetailLine[] {
    const state = this.state;
    if (state.kind === 'loading') {
      return [{ icon: '$(sync~spin)', label: vscode.l10n.t('Reading your Fish Audio credits...') }];
    }
    if (state.kind === 'noKey') {
      return [{ icon: '$(key)', label: vscode.l10n.t('Set your Fish Audio API key to show your remaining credits.') }];
    }
    if (state.kind === 'invalidKey') {
      return [{ icon: '$(key)', label: vscode.l10n.t('Fish Audio rejected the API key. Click to enter a new one.') }];
    }
    const lines: DetailLine[] = [];
    const balances = state.kind === 'ok' ? state.balances : state.lastKnown;
    if (state.kind === 'failed') {
      lines.push({ icon: '$(warning)', label: vscode.l10n.t('Could not refresh: {0}', state.message) });
    }
    if (!balances) {
      return lines;
    }
    const locale = vscode.env.language;
    const now = new Date();
    const when = (date: Date) => date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
    const { plan, apiCredit } = balances;
    if (plan) {
      const head = headline(balances, this.warningThreshold(), locale);
      const percent = head.remainingPercent === undefined ? '' : ` (${Math.round(head.remainingPercent)}%)`;
      lines.push({
        icon: ICON,
        label: plan.type ? `${vscode.l10n.t('Plan')} (${plan.type})` : vscode.l10n.t('Plan'),
        value: `${formatCredits(plan.balance, locale)} / ${formatCredits(plan.total, locale)}${percent}`,
      });
      const reset = nextCreditReset(plan, now);
      if (reset) {
        const days = daysUntil(reset, now);
        lines.push({
          icon: '$(history)',
          label: vscode.l10n.t('Next credit reset'),
          value: `${when(reset)} (${days === 1 ? vscode.l10n.t('in 1 day') : vscode.l10n.t('in {0} days', days)})`,
        });
      }
      if (plan.finishedAt && !(reset && sameMoment(reset, plan.finishedAt))) {
        lines.push({ icon: '$(calendar)', label: vscode.l10n.t('Plan period ends'), value: when(plan.finishedAt) });
      }
    } else {
      lines.push({ icon: ICON, label: vscode.l10n.t('Plan: none') });
    }
    if (apiCredit) {
      lines.push({
        icon: '$(credit-card)',
        label: vscode.l10n.t('API credit'),
        value: formatUsd(apiCredit.credit, locale),
      });
    }
    lines.push({
      icon: '$(clock)',
      label: vscode.l10n.t('Updated: {0}', balances.fetchedAt.toLocaleTimeString(locale)),
    });
    return lines;
  }

  private tooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = { enabledCommands: [COMMANDS.refresh, COMMANDS.setApiKey, COMMANDS.openBilling] };
    md.appendMarkdown(`**${escape(vscode.l10n.t('Fish Audio Credits'))}**\n\n`);
    for (const line of this.details()) {
      const value = line.value === undefined ? '' : `: **${escape(line.value)}**`;
      md.appendMarkdown(`${line.icon} ${escape(line.label)}${value}\n\n`);
    }
    md.appendMarkdown(
      `[$(refresh) ${escape(vscode.l10n.t('Refresh'))}](command:${COMMANDS.refresh}) · ` +
        `[$(key) ${escape(vscode.l10n.t('Change API key'))}](command:${COMMANDS.setApiKey}) · ` +
        `[$(link-external) ${escape(vscode.l10n.t('Billing'))}](command:${COMMANDS.openBilling})`,
    );
    return md;
  }

  /**
   * Shows the same details as the tooltip in a list at the top of the
   * window, for clicking the status bar item. VS Code has no way to open
   * a status bar tooltip from code.
   */
  async showDetails(): Promise<void> {
    if (this.state.kind === 'noKey' || this.state.kind === 'invalidKey') {
      await vscode.commands.executeCommand(COMMANDS.setApiKey);
      return;
    }
    type Item = vscode.QuickPickItem & { command?: string };
    const items: Item[] = this.details().map((line) => ({
      label: `${line.icon} ${line.label}`,
      description: line.value,
    }));
    items.push(
      { label: vscode.l10n.t('Actions'), kind: vscode.QuickPickItemKind.Separator },
      { label: `$(refresh) ${vscode.l10n.t('Refresh')}`, command: COMMANDS.refresh },
      { label: `$(key) ${vscode.l10n.t('Change API key')}`, command: COMMANDS.setApiKey },
      { label: `$(link-external) ${vscode.l10n.t('Billing')}`, command: COMMANDS.openBilling },
    );
    const picked = await vscode.window.showQuickPick(items, {
      title: vscode.l10n.t('Fish Audio Credits'),
      placeHolder: vscode.l10n.t('Pick an action, or press Escape to close'),
    });
    if (picked?.command) {
      await vscode.commands.executeCommand(picked.command);
    }
  }
}

/** Text from the API or a translation must not be read as Markdown or links. */
function escape(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~$]/g, '\\$&');
}
