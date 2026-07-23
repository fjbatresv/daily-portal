export interface SlackSearchResponse {
  ok: boolean;
  error?: string;
  messages?: {
    matches: SlackApiMatch[];
  };
}

export interface SlackApiMatch {
  ts: string;
  channel?: {
    id?: string;
    name?: string;
  };
  username?: string;
  user_name?: string;
  text: string;
  permalink: string;
}
