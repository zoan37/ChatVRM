import { Message } from "../messages/messages";
import { getWindowAI } from 'window.ai';

export async function getChatResponse(messages: Message[], apiKey: string) {
  // function currently not used
  throw new Error("Not implemented");

  /*
  if (!apiKey) {
    throw new Error("Invalid API Key");
  }

  const configuration = new Configuration({
    apiKey: apiKey,
  });
  // ブラウザからAPIを叩くときに発生するエラーを無くすworkaround
  // https://github.com/openai/openai-node/issues/6#issuecomment-1492814621
  delete configuration.baseOptions.headers["User-Agent"];

  const openai = new OpenAIApi(configuration);

  const { data } = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: messages,
  });

  const [aiRes] = data.choices;
  const message = aiRes.message?.content || "エラーが発生しました";

  return { message: message };
  */
}

export async function getChatResponseStream(
  messages: Message[],
  apiKey: string
) {
  // TODO: remove usages of apiKey in code
  /*
  if (!apiKey) {
    throw new Error("Invalid API Key");
  }
  */

  console.log('getChatResponseStream');

  console.log('messages');
  console.log(messages);

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      try {
        let ai;
        try {
          ai = await getWindowAI()
        } catch (error) {
          alert('window.ai not found. Please install at https://windowai.io/');
          return;
        }

        let isStreamed = false;
        const response = await ai.generateText(
          {
            messages: messages
          },
          {
            temperature: 0.7,
            maxTokens: 200,
            // Handle partial results if they can be streamed in
            onStreamResult: (res) => {
              console.log(res!.message.content)
      
              controller.enqueue(res!.message.content);

              isStreamed = true;
            }
          }
        );

        console.log('response');
        console.log(response);

        // handle case where streaming is not supported (e.g. for Cohere model)
        if (!isStreamed) {
          controller.enqueue(response[0].message.content);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}
