# ChatVRM

<img src="https://github.com/zoan37/ChatVRM/blob/9d50c106cb971e9ef53cfff22e6ea9d75d61fe69/public/ogp-en.png" width="600">

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


## API keys and configuration

The app can get its LLM responses two ways:

1. **The visitor's own OpenRouter key** — entered in Settings, stored in that browser's localStorage, and sent directly from their browser to OpenRouter. Nothing touches your account.
2. **A shared key you provide** — used when the visitor hasn't entered one. This key lives **only on the server**, in the `/api/chat` serverless function, and is never sent to the browser.

To set up the shared key, copy `.env.example` to `.env.local` for local dev, and set the same variables in Vercel under *Project → Settings → Environment Variables*:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Shared key, server-side only. Required for the shared path. |
| `OPENROUTER_MODEL` | Model for the shared key. Must end in `:free` (or be `openrouter/free`) unless `ALLOW_PAID_MODEL=true`. |
| `ALLOW_PAID_MODEL` | Set to `true` to permit a paid model. Leave unset so a typo can't spend money. |
| `ALLOWED_ORIGINS` | Optional comma-separated origin allowlist for `/api/chat`. |
| `SITE_URL` | Optional. Sent as `HTTP-Referer` for OpenRouter's app rankings. |

> **Never prefix an API key with `NEXT_PUBLIC_`.** Next.js inlines those values into the JavaScript bundle served to every visitor, so the key becomes public and can be extracted from devtools. This app previously used `NEXT_PUBLIC_OPENROUTER_API_KEY` and the key was drained as a result.

Recommended hardening for the shared key:

- Use a `:free` model (the default), so requests cost nothing.
- Create a **dedicated** key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) and set a credit limit on it. That limit is the real spend ceiling.
- Set `ALLOWED_ORIGINS` to your production domain once you're done testing.

`/api/chat` also enforces a fixed model, a 512-token cap, a 24,000-character conversation cap, and a per-IP rate limit (12/min, 200/day). The rate limit is in-memory, so it resets on cold start and isn't shared across regions — treat it as friction against casual abuse, not as the spend ceiling.

### Free models

OpenRouter model IDs ending in `:free` cost $0 per token. The free tier allows 20 requests/minute and 50 requests/day, which rises to 1,000/day once you've purchased $10 of credits at any point. The current list is at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0).

For a talking avatar the binding constraint is **time to first token**, since nothing can be spoken until it arrives. Measured on a one-sentence reply (August 2026):

| Model | First token | Notes |
| --- | --- | --- |
| `nvidia/nemotron-3-nano-30b-a3b:free` | **0.9s** | Current default. MoE, ~3B active params |
| `google/gemma-4-31b-it:free` | 5.1s | Better prose, too slow to feel conversational |
| `openai/gpt-oss-20b:free` | 5.6s | Free relative of the paid `gpt-oss-120b` |
| `google/gemma-4-26b-a4b-it:free` | 7.5s | |
| `nvidia/nemotron-3.5-lightning:free` | 60s | **Avoid.** Spent the whole 512-token budget reasoning and emitted its scratchpad as the reply |
| `liquid/lfm-2.5-2.6b:free` | — | **Avoid.** Streamed empty chunks, then hung |

Reasoning models are a poor fit here: their thinking tokens count against `max_tokens`, delaying speech and risking a truncated reply. `reasoning: { effort: "low" }` is already sent to limit this.

Note that a static build (`npm run export`, used by the GitHub Pages workflow) has no serverless functions, so `/api/chat` won't exist there and visitors must supply their own key.


## The avatar model

The default avatar is served from `public/AvatarSample_B.vrm` on the app's own origin. It used to load from a public IPFS gateway, which gives no availability guarantee and was returning `504`s — leaving the page with no avatar and an uncaught error in the console.

The committed model is an optimized build of the original 20 MB VRoid export, produced by `scripts/optimize-vrm.mjs`:

```bash
node scripts/optimize-vrm.mjs original.vrm public/AvatarSample_B.vrm \
  --max 1024 --thumb 256 --trim-material HAIR_06 --trim-above 1.545
```

| | Original | Committed |
| --- | --- | --- |
| File | 20.07 MB | **6.46 MB** |
| Textures | 12.12 MB | 4.21 MB |
| Morph targets | 6.14 MB | 0.69 MB |

Two things dominate a VRoid export. **Textures**: the 2048×2048 thumbnail alone was 2.35 MB despite never being rendered in-scene, and one normal map was stored six times. **Morph targets**: 90.3% of the blend-shape deltas are exactly zero, because each expression moves only a few vertices of a whole-body mesh — storing them as glTF sparse accessors cuts them by 89%.

The `--trim-*` flags fix a separate, pre-existing cosmetic bug: four tiny black specks appeared to float in the air above the head. They are the tips of the black ribbon bows (`HAIR_06`), which taper to a point — above y=1.545 those triangles are narrower than a pixel, so the rasterizer can only draw them as scattered dots detached from the bow. Dropping those 64 triangles (0.18% of the model) removes the specks with no visible change to the bows. Only the index buffer shrinks, so vertices, skin weights and morph targets are untouched. This artifact is present in the untouched 20 MB original — it is not caused by the optimization.

The script deliberately does not use a general-purpose glTF optimizer. VRM keeps its data in the `VRMC_vrm` / `VRM` extensions, which reference textures, images and materials by *array index*; tools that reorder or reindex those arrays silently break expressions, spring bones and material settings. This script only rewrites bufferView payloads and appends new bufferViews, so every existing index still resolves. Run `--max 2048` for a losslessly recompressed 9.14 MB build if you'd rather not downscale textures at all.

Requires ImageMagick (`magick`) on PATH.

## How to integrate with livestream

ChatVRM supports reading chat messages from a livestream and generating responses, via the Restream API. Currently, X and Twitch sources are supported. It uses a batching system so that the LLM is called for each batch of messages, not for each message.

Steps (this is mostly in the Settings UI):
1. Set OpenRouter API key. (Optional — leaving it blank uses the deployment's shared server-side key on a free model, which is rate limited. Setting your own key gives you higher limits and your choice of account.)
2. Set ElevenLabs API key.
3. Choose your desired ElevenLabs voice.
4. Choose your desired VRM avatar model.
5. Set your custom system prompt for your character.
6. Get your Restream authentication tokens JSON from the [Restream Token Fetcher](https://restream-token-fetcher.vercel.app/). It gives permission for ChatVRM to listen to your chat messages from Restream (currently X and Twitch sources are supported).
7. Paste your Restream authentication tokens JSON, and click Start Listening.
8. Start your livestream using Restream.

Troubleshooting:
- If you are not seeing messages being received from your livestream, you can try clicking the "Stop Listening" button and then "Start Listening" again, getting new Restream tokens, or refreshing the ChatVRM site.
