import { useState, useEffect } from 'react';
import content from '@/lib/shared/kliv-content';

interface ContentFile {
  contentUrl: string;
  name: string;
  size?: number;
  type?: string;
}

export const useContentStore = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<ContentFile[]>([]);

  const uploadFiles = async (files: File[], path: string = '/content/uploads/') => {
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const result = await content.uploadFile(file, path);
        return {
          contentUrl: result.contentUrl,
          name: file.name,
          size: file.size,
          type: file.type
        } as ContentFile;
      });

      const uploaded = await Promise.all(uploadPromises);
      setUploadedFiles(prev => [...prev, ...uploaded]);
      return uploaded;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const clearUploadedFiles = () => {
    setUploadedFiles([]);
  };

  return {
    uploadFiles,
    uploading,
    uploadedFiles,
    clearUploadedFiles
  };
};

export default useContentStore;