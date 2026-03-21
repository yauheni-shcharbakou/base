export const getImageDimensions = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height };
};
