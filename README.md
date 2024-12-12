# ChatVRM

<img src="https://github.com/zoan37/ChatVRM/blob/9d50c106cb971e9ef53cfff22e6ea9d75d61fe69/public/ogp-en.png" width="600">

**Discord:** https://discord.gg/7KkS3r5hGK

[This repo was cloned from [ChatVRM-jp](https://github.com/zoan37/ChatVRM-jp), which is a fork of [@pixiv/ChatVRM](https://github.com/pixiv/ChatVRM).]

ChatVRM is a demo application that allows you to easily talk with a 3D character in your browser.

By importing VRM files, you can adjust the voice to match the character, and generate responses that include emotional expressions.

ChatVRM mainly uses the following technologies.

- Generate response text
    - [OpenRouter](https://openrouter.ai/)
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


## How to integrate with livestream

ChatVRM supports reading chat messages from a livestream and generating responses, via the Restream API. Currently, X and Twitch sources are supported. It uses a batching system so that the LLM is called for each batch of messages, not for each message.

Steps (this is mostly in the Settings UI):
1. Set OpenRouter API key. (The demo uses a free key by default for users to try things out, but it can run out of credits and need a refill).
2. Set ElevenLabs API key.
3. Choose your desired ElevenLabs voice.
4. Choose your desired VRM avatar model.
5. Set your custom system prompt for your character.
6. Get your Restream authentication tokens JSON from the [Restream Token Fetcher](https://restream-token-fetcher.vercel.app/). It gives permission for ChatVRM to listen to your chat messages from Restream (currently X and Twitch sources are supported).
7. Paste your Restream authentication tokens JSON, and click Start Listening.
8. Start your livestream using Restream.

Troubleshooting:
- If you are not seeing messages being received from your livestream, you can try clicking the "Stop Listening" button and then "Start Listening" again, getting new Restream tokens, or refreshing the ChatVRM site.
