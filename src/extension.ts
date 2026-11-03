import * as vscode from 'vscode';
import { fetchBalances, InvalidApiKeyError } from './core/fish-api';
import { COMMANDS, CreditStatus, SECRET_KEY } from './credit-status';

const API_KEYS_PAGE = 'https://fish.audio/app/api-keys';
const BILLING_PAGE = 'https://fish.audio/app/developers/billing/';

export function activate(context: vscode.ExtensionContext): CreditStatus {
  const log = vscode.window.createOutputChannel('Credit Balance for Fish Audio', { log: true });
  const status = new CreditStatus(context.secrets, log);

  context.subscriptions.push(
    log,
    status,
    vscode.commands.registerCommand(COMMANDS.setApiKey, () => setApiKey(context.secrets, status)),
    vscode.commands.registerCommand(COMMANDS.clearApiKey, () => clearApiKey(context.secrets, status)),
    vscode.commands.registerCommand(COMMANDS.refresh, () => status.refresh()),
    vscode.commands.registerCommand(COMMANDS.openBilling, () =>
      vscode.env.openExternal(vscode.Uri.parse(BILLING_PAGE)),
    ),
  );

  void status.refresh();
  // Returned for the integration tests; nothing else depends on it.
  return status;
}

export function deactivate(): void {}

async function setApiKey(secrets: vscode.SecretStorage, status: CreditStatus): Promise<void> {
  const createKey = vscode.l10n.t('Create a key');
  const apiKey = (
    await vscode.window.showInputBox({
      title: vscode.l10n.t('Fish Audio API key'),
      prompt: vscode.l10n.t('Paste your Fish Audio API key. It is kept in VS Code secret storage, not in settings.'),
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim() === '' ? vscode.l10n.t('Enter an API key.') : undefined),
    })
  )?.trim();
  if (!apiKey) {
    if (apiKey === undefined) {
      // Cancelled: offer the page where keys are created, for first-time users.
      const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t('You can create an API key on the Fish Audio website.'),
        createKey,
      );
      if (choice === createKey) {
        await vscode.env.openExternal(vscode.Uri.parse(API_KEYS_PAGE));
      }
    }
    return;
  }

  // Check the key before storing it, so a typo never replaces a working key.
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Checking the API key...') },
      () => fetchBalances(apiKey),
    );
  } catch (error) {
    if (error instanceof InvalidApiKeyError) {
      void vscode.window.showErrorMessage(vscode.l10n.t('Fish Audio rejected this API key. It was not saved.'));
      return;
    }
    // Fish Audio could not be reached; the key may still be fine, so keep it.
    void vscode.window.showWarningMessage(
      vscode.l10n.t('Saved the API key, but Fish Audio could not be reached to check it: {0}', String(error)),
    );
  }
  await secrets.store(SECRET_KEY, apiKey);
  await status.refresh();
}

async function clearApiKey(secrets: vscode.SecretStorage, status: CreditStatus): Promise<void> {
  const remove = vscode.l10n.t('Remove');
  const choice = await vscode.window.showWarningMessage(
    vscode.l10n.t('Remove the Fish Audio API key from VS Code?'),
    { modal: true },
    remove,
  );
  if (choice !== remove) {
    return;
  }
  await secrets.delete(SECRET_KEY);
  await status.refresh();
}
