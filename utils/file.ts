
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // remove data:image/jpeg;base64, prefix
        resolve(base64data.substring(base64data.indexOf(',') + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
