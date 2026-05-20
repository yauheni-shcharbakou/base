export type BunnyUpdateBody = {
  title?: string;
  metaTags?: { property: string; value: string }[];
};

export type BunnyVideo = {
  guid: string;
  title: string;
  description?: string;
  length: number;
  views: number;
  availableResolutions?: string;
};

export type BunnyVideoList = {
  totalItems: number;
  items: BunnyVideo[];
};
