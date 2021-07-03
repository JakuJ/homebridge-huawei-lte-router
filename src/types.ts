export type SsidFrame = Record<string, string> & {
  Index: number;
  WifiMacFilterStatus: number;
};

export type FilterReponse = {
  Ssids: {
    Ssid: SsidFrame[];
  };
};