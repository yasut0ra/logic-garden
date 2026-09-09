# GitHub公開手順

公開予定のリポジトリは `yasut0ra/logic-garden`、既定ブランチは `main` です。
この手順書の作成時点ではGitHub側のリポジトリ作成・pushは実行していません。

## 公開内容

- React / TypeScript製のLogic Gardenアプリ
- 3種類のBanditと回路探索エンジン
- 再現可能な比較実験とJSONベンチマーク
- README、MITライセンス、貢献ガイド
- GitHub Actionsによる型チェック、Lint、テスト、ビルド、Worker検証

`node_modules`、ビルド出力、ローカル環境設定、開発サーバーの状態はGitの対象外です。
`.openai/hosting.json`はビルドが参照する設定として含みます。現在の内容は
`d1: null`と`r2: null`のみで、アカウントIDや認証情報は含みません。

## 公開を実行するとき

プロジェクトのディレクトリで次を実行します。下記の`gh repo create`は
**Publicリポジトリを作成し、コミット済みのソースを公開する操作**です。

```bash
git status --short
gh api user --jq .login
gh repo create yasut0ra/logic-garden \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Watch a multi-armed bandit grow a Boolean circuit."
```

ログイン先が`yasut0ra`であることを確認してから実行してください。
同名のリポジトリが先に作られている場合は、この作成コマンドを繰り返さず、
そのリポジトリと公開範囲を確認してから接続してください。

公開後はGitHubのActionsタブでCI結果を確認します。
WebサイトのデプロイやGitHub Pagesの公開は、この操作には含まれません。
アプリはクローン後に`npm install`、`npm run dev`で利用できます。

## 任意の仕上げ

- [撮影手順](MEDIA.md)に従って実際の画面やGIFをREADMEに追加する。
- Topicsに`multi-armed-bandit`、`logic-gates`、`visualization`、`typescript`、`react`を設定する。

`package.json`の`private: true`はnpmへの誤公開を防ぐ設定です。
GitHubリポジトリをPublicにするために変更する必要はありません。
