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
  // Bunny's `VideoModelStatus`, which is NOT the `Status` its webhook sends: "Finished" is 4 here
  // and 3 there. See BunnyVideoStatus next to the sync use-case.
  status: number;
  availableResolutions?: string;
};

export type BunnyVideoList = {
  totalItems: number;
  items: BunnyVideo[];
};
