export const getVideoDuration = (duration: number) => {
  if (!duration) {
    return '00:00';
  }

  const minutes = Math.floor(duration / 60);
  const seconds = duration - minutes * 60;

  const minutesPart = minutes >= 10 ? minutes : `0${minutes}`;
  const secondsPart = seconds >= 10 ? seconds : `0${seconds}`;

  return `${minutesPart}:${secondsPart}`;
};

export const getGenericVideTitle = (fileName: string) => {
  return fileName.replace(/.\w+$/g, '');
};
