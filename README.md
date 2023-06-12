# ChatVRM

<img src="https://github.com/zoan37/ChatVRM/blob/9d50c106cb971e9ef53cfff22e6ea9d75d61fe69/public/ogp-en.png" width="600">

[This repo was cloned from [ChatVRM-jp](https://github.com/zoan37/ChatVRM-jp), which is a fork of [@pixiv/ChatVRM](https://github.com/pixiv/ChatVRM).]

ChatVRM is a demo application that allows you to easily talk with a 3D character in your browser.

By importing VRM files, you can adjust the voice to match the character, and generate responses that include emotional expressions.

ChatVRM mainly uses the following technologies.

- Generate response text
    - [Window AI](https://windowai.io/)
- User speech recognition
    - [Web Speech API (SpeechRecognition)](https://developer.mozilla.org/ja/docs/Web/API/SpeechRecognition)
- Text to speech
    - [ElevenLabs](https://beta.elevenlabs.io/)
- Displaying 3D characters
    - [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)


## Demo

A demo is available at Vercel.

[https://chat-vrm-window.vercel.app/](https://chat-vrm-window.vercel.app/)


## Execution
Clone or download this repository to run locally.

```bash
git clone https://github.com/zoan37/ChatVRM.git
```

Please install the required packages.
```bash
npm install
```

After package installation is complete, start the development web server with the following command.
```bash
npm run dev
```

After execution, access the following URL.

[http://localhost:3000](http://localhost:3000) 


---

## Window AI

ChatVRM uses Window AI to generate responses.

- [https://windowai.io/](https://windowai.io/)


## ElevenLabs
ChatVRM uses ElevenLabs API to do text to speech.

- [https://beta.elevenlabs.io/](https://beta.elevenlabs.io/)
