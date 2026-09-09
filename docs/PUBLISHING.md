# GitHub公開と更新

公開リポジトリ: [yasut0ra/logic-garden](https://github.com/yasut0ra/logic-garden)。既定ブランチは `main` です。

## 公開内容

- React / TypeScript製のContextual Circuit Searchアプリ
- Random、UCB1、LinUCB、Linear Thompson、Contextual ε-Greedy、従来の2方策
- Context Inspector、候補回路、決定スコア、Oracle比較
- 3種類の比較実験、JSONベンチマーク、README、MITライセンス
- GitHub Actionsによる型チェック、Lint、テスト、ビルド、Worker検証

`node_modules`、ビルド出力、ローカル環境設定は追跡しません。
`.openai/hosting.json` は既存ビルド用の `d1: null` / `r2: null` の設定です。

## 更新手順

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:worker
git status --short
```

差分を確認して変更用ブランチをpushし、Pull RequestでCI結果を確認します。
既存リポジトリに対して `gh repo create` を再実行する必要はありません。

GitHubへのソース公開はWebサイトのデプロイを含みません。
クローン後に `npm ci` と `npm run dev` で利用できます。
`package.json` の `private: true` はnpmへの誤公開を防ぐ設定であり、GitHubのPublic設定とは独立しています。

実際の画面をREADMEに追加する場合は [撮影手順](MEDIA.md) を参照してください。
