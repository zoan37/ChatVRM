# ChatVRM

[This repo is a fork of pixiv's ChatVRM that uses [Window AI](https://windowai.io/) to run AI on the web.]

ChatVRMはブラウザで簡単に3Dキャラクターと会話ができるデモアプリケーションです。

VRMファイルをインポートしてキャラクターに合わせた声の調整や、感情表現を含んだ返答文の生成などを行うことができます。

ChatVRMの各機能は主に以下の技術を使用しています。

- 返答文の生成
    - [Window AI](https://windowai.io/)
- ユーザーの音声の認識
    - [Web Speech API(SpeechRecognition)](https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition)
- 読み上げ音声の生成
    - [Koeiro API](http://koeiromap.rinna.jp/)
- 3Dキャラクターの表示
    - [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)


## デモ

Vercelでデモを公開しています。

TODO: add vercel app link
[https://pixiv.github.io/ChatVRM](https://pixiv.github.io/ChatVRM)


## 実行
ローカル環境で実行する場合はこのリポジトリをクローンするか、ダウンロードしてください。

```bash
git clone git@github.com:zoan37/ChatVRM-jp.git
```

必要なパッケージをインストールしてください。
```bash
npm install
```

パッケージのインストールが完了した後、以下のコマンドで開発用のWebサーバーを起動します。
```bash
npm run dev
```

実行後、以下のURLにアクセスして動作を確認して下さい。

[http://localhost:3000](http://localhost:3000) 


---

## Window AI

ChatVRMでは返答文の生成にWindow AIを使用しています。

Window AIの仕様や利用規約については以下のリンクや公式サイトをご確認ください。

- [https://windowai.io/](https://windowai.io/)


## Koeiro API
ChatVRMでは返答文の音声読み上げにKoeiro APIを使用しています。

Koeiro APIの仕様や利用規約については以下のリンクや公式サイトをご確認ください。

- [http://koeiromap.rinna.jp/](http://koeiromap.rinna.jp/)