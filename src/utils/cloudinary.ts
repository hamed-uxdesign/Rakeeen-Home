export const uploadImage = async (file: File): Promise<string> => {
  const cloudName = 'dnwi7kl3f';
  const uploadPreset = 'rakeeen_home'; // تم التصحيح للاسم الفعلي

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudinary API Error:', data.error?.message || 'Unknown error');
      throw new Error(data.error?.message || 'Upload failed');
    }

    return data.secure_url;
  } catch (error: any) {
    console.error('Detailed Cloudinary Error:', error);
    throw error;
  }
};
