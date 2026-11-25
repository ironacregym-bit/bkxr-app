export function fileToBase64(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(
        reader.result || ""
      );

      resolve(
        result.replace(
          /^data:image\/[a-zA-Z]+;base64,/,
          ""
        )
      );
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}
