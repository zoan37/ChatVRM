import { buildUrl } from "@/utils/buildUrl";
import Head from "next/head";
export const Meta = () => {
  const title = "ChatVRM";
  const description =
    "You can enjoy conversations with 3D characters using only a web browser using a microphone, text input, and speech synthesis. You can also change the character (VRM), set the personality, and adjust the voice.";
  const imageUrl = "https://pixiv.github.io/ChatVRM/ogp-en.png";
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Head>
  );
};
