import { FileText, FileSpreadsheet, Image, File, Folder } from 'lucide-react';
import { format } from 'date-fns';

export function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return Image;
  return File;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatModifiedDate(dateStr?: string): string {
  if (!dateStr) return '--';
  try {
    return format(new Date(dateStr), 'M/d/yyyy h:mm a').toLowerCase();
  } catch {
    return '--';
  }
}

const IMAGE_EXTENSIONS_SET = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic']);

export function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS_SET.has(ext);
}

export { Folder, File };
