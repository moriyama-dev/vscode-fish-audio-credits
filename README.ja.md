# Credit Balance for Fish Audio

[English](README.md) | 日本語

Fish Audio のクレジットがあとどれだけ残っているかを、VS Code の中で確認できます。残高はステータスバー（画面の一番下の帯）に出ていて、自動で更新されます。

## インストール

Windows、macOS、Linux（Ubuntu を含む）のどれでも同じように使えます。

### VS Code

1. 拡張機能ビューを開きます。Windows と Linux は <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>、macOS は <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> です。
2. **Credit Balance for Fish Audio** を検索して、**Install**（インストール）を押します。

[Visual Studio Marketplace のページ](https://marketplace.visualstudio.com/items?itemName=moriyama-dev.vscode-fish-audio-credits)から入れることもできます。ターミナルから入れる場合は、次のコマンドです。

```sh
code --install-extension moriyama-dev.vscode-fish-audio-credits
```

**更新は自動です。** 新しいバージョンが出ると、VS Code が Marketplace から自動で入れ替えます（設定の `extensions.autoUpdate` をオフにしている場合を除きます）。

### VSCodium

この拡張機能はまだ Open VSX に載っていないので、GitHub Releases の `.vsix` ファイルから入れます。Open VSX に載ったあとは、ほかの拡張機能と同じように VSCodium の拡張機能ビューで見つかり、自動で更新されます。

**簡単な方法（どの OS でも同じ）:**

1. [最新のリリース](https://github.com/moriyama-dev/vscode-fish-audio-credits/releases/latest)から `vscode-fish-audio-credits-<バージョン>.vsix` をダウンロードします。
2. VSCodium で拡張機能ビューを開き、上部の **...** メニューから **Install from VSIX...**（VSIX からのインストール）を選んで、ダウンロードしたファイルを指定します。

**1 つのコマンドでインストール・更新する方法:** 新しいバージョンが出たら、同じコマンドをもう一度実行するだけで最新版に入れ替わります。

macOS と Ubuntu（ターミナル）:

```sh
url=$(curl -fsSL https://api.github.com/repos/moriyama-dev/vscode-fish-audio-credits/releases/latest | grep -o 'https://[^"]*\.vsix' | head -n 1) && curl -fsSL -o /tmp/vscode-fish-audio-credits.vsix "$url" && codium --install-extension /tmp/vscode-fish-audio-credits.vsix --force
```

Windows（PowerShell）:

```powershell
$u = (Invoke-RestMethod https://api.github.com/repos/moriyama-dev/vscode-fish-audio-credits/releases/latest).assets | Where-Object name -like '*.vsix' | Select-Object -First 1 -ExpandProperty browser_download_url; Invoke-WebRequest $u -OutFile "$env:TEMP\vscode-fish-audio-credits.vsix"; codium --install-extension "$env:TEMP\vscode-fish-audio-credits.vsix" --force
```

新しいバージョンが出たときに通知を受け取りたい場合は、[GitHub のリポジトリ](https://github.com/moriyama-dev/vscode-fish-audio-credits)で **Watch → Custom → Releases** を選んでください。

### `code` や `codium` のコマンドが見つからないとき

- **macOS:** VS Code（または VSCodium）を開き、<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> を押して **Shell Command: Install 'code' command in PATH** を実行します（VSCodium では **'codium'**）。そのあと、ターミナルを新しく開き直してください。
- **Windows:** インストーラーがコマンドを `PATH` に追加します。エディターを入れたあとに、PowerShell を新しく開き直してください。
- **Ubuntu:** `.deb`、Snap、apt のどの方法で入れても、コマンドは使えるようになります。`.tar.gz` 版を使っている場合は、そのフォルダーの中の `bin/code` か `bin/codium` を実行してください。

## できること

- **ステータスバーにプランのクレジットを表示**します（例: `100,712`）。プランに入っていないアカウントでは、代わりに従量課金の API クレジットをドルで表示します。
- **マウスを乗せる、またはクリックすると詳しい内容を表示**します。内容は、プラン名、残りと総量と残りの割合、次にクレジットが補充される日時（あと何日か）、プランの支払い期間が終わる日時、API クレジット、最後に更新した時刻です。マウスを乗せると吹き出しで出ます。クリックすると、同じ内容を画面上部の一覧で開きます。一覧の下には **更新（Refresh）**、**API キーを変更（Change API key）**、**支払い（Billing）** が並びます。
- **次のクレジット補充日**: Fish Audio のプランのクレジットは毎月補充されます。API が補充日を返す場合はその日を使い、返さない場合はプランの期間が終わる日と時刻に合わせて、毎月同じ日時に補充されるものとして計算します。日時はお使いのパソコンの時刻（ローカル時刻）で表示します。
- **残りが少なくなると警告**: プランのクレジットの残りが 10% を切ると、ステータスバーの表示が警告色になります。この割合は設定で変えられます。
- **自動で更新**: 30 分ごとに更新します。しばらく離れていた VS Code の窓に戻ったときも、その場で更新します。すぐに更新したいときは、詳しい内容の一覧で **更新（Refresh）** を選ぶか、**Fish Audio: クレジット残高を更新** を実行してください。
- **API キーは外に出しません**: キーは `settings.json` ではなく VS Code の安全な保管場所（シークレットストレージ）に保存し、`api.fish.audio` にだけ送ります。

## 使い始め方

1. Fish Audio の [Get Started ページ](https://fish.audio/app/developers/get-started/)で API キーを作ります。キーは 1 回しか表示されないので、すぐにコピーしてください。
2. VS Code のステータスバーにある **Fish Audio** をクリックするか、コマンドパレットで **Fish Audio: API キーを設定** を実行します。
3. キーを貼り付けます。保存する前に Fish Audio でキーを確認するので、打ち間違えたキーで、使えているキーが上書きされることはありません。

## コマンド

画面が英語のときは、カッコ内の英語の名前で表示されます。

| コマンド                                                       | 内容                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| **Fish Audio: API キーを設定**（Set API Key）                  | API キーを保存、または入れ替えます                     |
| **Fish Audio: API キーを削除**（Remove API Key）               | VS Code からキーを削除します                           |
| **Fish Audio: クレジット残高を更新**（Refresh Credit Balance） | 残高をすぐに読み込みます                               |
| **Fish Audio: クレジットの詳細を表示**（Show Credit Details）  | ステータスバーをクリックしたときと同じ詳細を開きます   |
| **Fish Audio: 支払いページを開く**（Open Billing Page）        | Fish Audio の API の支払いページをブラウザーで開きます |

## 設定

| 設定                                       | 既定値 | 内容                                                                                                        |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| `fishAudioCredits.refreshIntervalMinutes`  | `30`   | 更新する間隔（分）。5 から 1440 まで                                                                        |
| `fishAudioCredits.warningThresholdPercent` | `10`   | プランの総量に対する残りがこの割合を下回ると警告色にします。`0` で警告色を使いません（残り 0 のときは除く） |

## API キーを安全に扱うために

**キーの保管場所。** キーは VS Code の安全な保管場所（シークレットストレージ）に入ります。VS Code はここを、OS の認証情報の仕組みを使って暗号化しています。

- **macOS:** キーチェーン
- **Windows:** Windows のデータ保護（DPAPI）。お使いの Windows アカウントに結び付きます
- **Linux:** Secret Service（GNOME Keyring または KWallet）

`settings.json` には書き込まないので、設定の同期（Settings Sync）、設定ファイルのバックアップ、共有しているワークスペースにキーが乗ることはありません。各拡張機能は自分の保管場所しか見られないので、ほかの拡張機能が VS Code からこのキーを受け取ることもできません。

**拡張機能がキーをどう使うか。**

- キーは HTTPS で `https://api.fish.audio` にだけ送ります。送り先はコードに固定していて、設定では変えられません。そのため、ワークスペースの設定でキーをほかの場所に送らせることはできません。
- 転送（リダイレクト）には従いません。キーがほかのアドレスに送られることはありません。
- 新しいキーは、保存する前に Fish Audio で確認します。打ち間違えたキーで、使えているキーが上書きされることはありません。
- キーをログ、ステータスバー、エラーメッセージに出すことはありません。
- 受け付けるのは、空白を含まない英数字・記号の並びだけです。貼り付けたときに空白や改行が紛れ込んでいれば、その場で分かります。

**おすすめの使い方。**

- この拡張機能専用のキーを作り、見て分かる名前（例: `VS Code credits`）を付けてください。止めたくなったときは、Fish Audio の [API Keys ページ](https://fish.audio/app/api-keys)でそのキーだけを削除すれば済み、ほかのツールはそのまま使えます。
- 使わなくなったパソコンでは、**Fish Audio: API キーを削除** を実行してください。
- キーが漏れたかもしれないときは、まず Fish Audio でそのキーを削除し、そのあと新しいキーを設定してください。
- **Linux:** キーリングが動いていないと、VS Code は弱い暗号化に切り替え、その旨の警告を出します。GNOME Keyring（`sudo apt install gnome-keyring`）か KWallet を入れてロックを解除し、キーを設定し直してください。

## プライバシー

この拡張機能は、API キーを使って Fish Audio の 2 つの API（`GET /wallet/self/package` と `GET /wallet/self/api-credit`）を呼び出すだけです。それ以外の情報は送らず、ワークスペースのファイルも読まず、利用状況の収集（テレメトリー）もしません。リモートの窓では、拡張機能はお使いのパソコン側で動くので、キーがリモートのマシンにコピーされることはありません。

## 免責事項

これは個人が作った拡張機能です。Fish Audio が作ったもの、推奨しているもの、サポートしているものではありません。

## ライセンス

MIT ライセンスです。拡張機能に含まれている `LICENSE` ファイルをご覧ください。
