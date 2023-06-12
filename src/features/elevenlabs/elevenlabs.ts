import { TalkStyle } from "../messages/messages";
import axios from 'axios';

export async function synthesizeVoice(
  message: string,
  speaker_x: number,
  speaker_y: number,
  style: TalkStyle,
  elevenLabsKey: string
) {

  // Set the API key for ElevenLabs API. 
  // Do not use directly. Use environment variables.
  const API_KEY = elevenLabsKey;
  // Set the ID of the voice to be used.
  const VOICE_ID = 'MF3mGyEYCl7XYWbV9V6O';

  // Set options for the API request.
  const options = {
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    headers: {
      accept: 'audio/mpeg', // Set the expected response type to audio/mpeg.
      'content-type': 'application/json', // Set the content type to application/json.
      'xi-api-key': `${API_KEY}`, // Set the API key in the headers.
    },
    data: {
      text: message, // Pass in the inputText as the text to be converted to speech.
    },
    responseType: 'arraybuffer', // Set the responseType to arraybuffer to receive binary data as response.
  };

  // Send the API request using Axios and wait for the response.
  const speechDetails = await axios.request(options);
  // Get the binary audio data received from the API response.
  const data =  speechDetails.data;
  // Create a new Blob object from the audio data with MIME type 'audio/mpeg'
  const blob = new Blob([data], { type: 'audio/mpeg' });
  // Create a URL for the blob object
  const url = URL.createObjectURL(blob);

  return {
    audio: url
  }
  /*

  const param = {
    method: "POST",
    body: JSON.stringify({
      text: message,
      model_id: "eleven_monolingual_v1"
    }),
    headers: {
      "accept": "audio/mpeg",
      "Content-type": "application/json; charset=UTF-8",
      "xi-api-key": ""
    },
  };

  const voice_id = "MF3mGyEYCl7XYWbV9V6O";

  console.log('elevenlabs voice_id');
  console.log(voice_id);

  console.log('elevenlabs param');
  console.log(param);

  const res = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/" + voice_id,
    param
  );

  console.log('elevenlabs res');
  console.log(res);

  const data = (await res.json()) as any;

  return { audio: data.audio };
  */
}

export async function getVoices() {
  const response = await axios.get('https://api.elevenlabs.io/v1/voices');
  console.log(response.data);

  return response.data;
}
