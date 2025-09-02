import { supabase } from '@/integrations/supabase/client';

export interface UploadResult {
  key: string;
  url: string;
}

export class UploadHelper {
  static async uploadFile(
    file: File,
    employeeId: string,
    category: 'profile' | 'documents' | 'insurance' | 'payslips'
  ): Promise<UploadResult> {
    // Get signed URL for upload
    const { data: urlData, error: urlError } = await supabase.functions.invoke('get-upload-url', {
      body: {
        employeeId,
        category,
        fileName: file.name,
        contentType: file.type
      }
    });

    if (urlError) throw urlError;

    // Upload file to S3 using signed URL
    const uploadResponse = await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to S3');
    }

    const s3Url = `https://${import.meta.env.VITE_AWS_S3_BUCKET || 'your-bucket'}.s3.amazonaws.com/${urlData.key}`;
    
    return {
      key: urlData.key,
      url: s3Url
    };
  }

  static async getDownloadUrl(key: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('get-download-url', {
      body: { key }
    });

    if (error) throw error;
    return data.signedUrl;
  }

  static validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type);
  }

  static validateFileSize(file: File, maxSizeMB: number): boolean {
    return file.size <= maxSizeMB * 1024 * 1024;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}