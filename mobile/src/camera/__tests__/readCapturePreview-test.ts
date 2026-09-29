import { Image } from 'react-native';
import { manipulateAsync } from 'expo-image-manipulator';
import { readCapturePreviewUri } from '../readCapturePreview';

const deleted: string[] = [];

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async base64(): Promise<string> {
      return 'aGVsbG8=';
    }
    delete(): void {
      deleted.push(this.uri);
    }
  },
}));

describe('camera preview cleanup', () => {
  beforeEach(() => {
    deleted.length = 0;
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
      success(2000, 1000);
    });
    (manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///cache/derived.jpg',
      width: 1280,
      height: 640,
    });
  });

  it('deletes the resized preview and leaves the shutter file', async () => {
    const preview = await readCapturePreviewUri('file:///capture.jpg');
    expect(preview).toBe('data:image/jpeg;base64,aGVsbG8=');
    expect(deleted).toEqual(['file:///cache/derived.jpg']);
  });

  it('does not delete the shutter file when no resized copy exists', async () => {
    (manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///capture.jpg',
      width: 800,
      height: 600,
    });
    const preview = await readCapturePreviewUri('file:///capture.jpg');
    expect(preview).toBe('data:image/jpeg;base64,aGVsbG8=');
    expect(deleted).toEqual([]);
  });
});
