import React, { useEffect, useState, cache } from "react";
import { IconButton } from "./iconButton";
import { TextButton } from "./textButton";
import { Message } from "@/features/messages/messages";
import {
  KoeiroParam,
  PRESET_A,
  PRESET_B,
  PRESET_C,
  PRESET_D,
} from "@/features/constants/koeiroParam";
import { Link } from "./link";
import { getVoices } from "@/features/elevenlabs/elevenlabs";
import { ElevenLabsParam } from "@/features/constants/elevenLabsParam";

type Props = {
  openAiKey: string;
  elevenLabsKey: string;
  systemPrompt: string;
  chatLog: Message[];
  elevenLabsParam: ElevenLabsParam;
  koeiroParam: KoeiroParam;
  onClickClose: () => void;
  onChangeAiKey: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeElevenLabsKey: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeElevenLabsVoice: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onChangeSystemPrompt: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onChangeChatLog: (index: number, text: string) => void;
  onChangeKoeiroParam: (x: number, y: number) => void;
  onClickOpenVrmFile: () => void;
  onClickResetChatLog: () => void;
  onClickResetSystemPrompt: () => void;
};
export const Settings = ({
  openAiKey,
  elevenLabsKey,
  chatLog,
  systemPrompt,
  elevenLabsParam,
  koeiroParam,
  onClickClose,
  onChangeSystemPrompt,
  onChangeAiKey,
  onChangeElevenLabsKey,
  onChangeElevenLabsVoice,
  onChangeChatLog,
  onChangeKoeiroParam,
  onClickOpenVrmFile,
  onClickResetChatLog,
  onClickResetSystemPrompt,
}: Props) => {

  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([]);

  useEffect(() => {
    // if statement to prevent spamming ElevenLabs API
    if (elevenLabsVoices.length == 0) {
      getVoices().then((data) => {
        console.log('getVoices');
        console.log(data);
  
        const voices = data.voices;
        setElevenLabsVoices(voices);
      });
    }
  });

  return (
    <div className="absolute z-40 w-full h-full bg-white/80 backdrop-blur ">
      <div className="absolute m-24">
        <IconButton
          iconName="24/Close"
          isProcessing={false}
          onClick={onClickClose}
        ></IconButton>
      </div>
      <div className="max-h-full overflow-auto">
        <div className="text-text1 max-w-3xl mx-auto px-24 py-64 ">
          <div className="my-24 typography-32 font-bold">Settings</div>
          <div className="my-24">
            <div className="my-16 typography-20 font-bold">Eleven Labs API</div>
            <input
              type="text"
              placeholder="ElevenLabs API key"
              value={elevenLabsKey}
              onChange={onChangeElevenLabsKey}
              className="my-4 px-16 py-8 w-full h-40 bg-surface3 hover:bg-surface3-hover rounded-4 text-ellipsis"
            ></input>
            <div>
              Enter your ElevenLabs API key to enable text to speech. You can get an API key at the&nbsp;
              <Link
                url="https://beta.elevenlabs.io/"
                label="ElevenLabs website"
              />.
            </div>
            <div className="my-16">
              The entered API key will be used directly from the browser to call the ElevenLabs API, so it will not be saved on the server.
            </div>
          </div>
          <div className="my-40">
            <div className="my-16 typography-20 font-bold">
              Voice Selection
            </div>
            <div className="my-16">
              Select among the premade voices by ElevenLabs:
            </div>
            <div className="my-8">
              <select className="h-40 px-8"
                id="select-dropdown"
                onChange={onChangeElevenLabsVoice}
                value={elevenLabsParam.voiceId}
              >
                {elevenLabsVoices.map((voice, index) => (
                  <option key={index} value={voice.voice_id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="my-40">
            <div className="my-16 typography-20 font-bold">
              Character Model
            </div>
            <div className="my-8">
              <TextButton onClick={onClickOpenVrmFile}>Open VRM</TextButton>
            </div>
          </div>
          <div className="my-40">
            <div className="my-8">
              <div className="my-16 typography-20 font-bold">
                Character Settings (System Prompt)
              </div>
              <TextButton onClick={onClickResetSystemPrompt}>
                Reset character settings
              </TextButton>
            </div>

            <textarea
              value={systemPrompt}
              onChange={onChangeSystemPrompt}
              className="px-16 py-8  bg-surface1 hover:bg-surface1-hover h-168 rounded-8 w-full"
            ></textarea>
          </div>
          {chatLog.length > 0 && (
            <div className="my-40">
              <div className="my-8 grid-cols-2">
                <div className="my-16 typography-20 font-bold">Conversation History</div>
                <TextButton onClick={onClickResetChatLog}>
                  Reset conversation history
                </TextButton>
              </div>
              <div className="my-8">
                {chatLog.map((value, index) => {
                  return (
                    <div
                      key={index}
                      className="my-8 grid grid-flow-col  grid-cols-[min-content_1fr] gap-x-fixed"
                    >
                      <div className="w-[64px] py-8">
                        {value.role === "assistant" ? "Character" : "You"}
                      </div>
                      <input
                        key={index}
                        className="bg-surface1 hover:bg-surface1-hover rounded-8 w-full px-16 py-8"
                        type="text"
                        value={value.content}
                        onChange={(event) => {
                          onChangeChatLog(index, event.target.value);
                        }}
                      ></input>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
