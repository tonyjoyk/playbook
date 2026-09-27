import { detectDiptychSplit } from './diptych';
import { blobToImageData, imageDataToBlob } from './compositeOps';
import type { CompositeDocument, EditRegion } from '../types';
import { newCompositeBlobId } from './project';

export async function createCompositeFromImage(
  blob: Blob,
  editRegion: EditRegion = 'full'
): Promise<{ doc: CompositeDocument; backgroundBlob: Blob }> {
  const { data, width, height } = await blobToImageData(blob);
  const splitX = detectDiptychSplit(data, width, height);
  const backgroundBlobId = newCompositeBlobId();
  const backgroundBlob = await imageDataToBlob(data, width, height);
  const doc: CompositeDocument = {
    version: 1,
    width,
    height,
    backgroundBlobId,
    layers: [],
    editRegion: splitX != null && editRegion === 'full' ? 'left' : editRegion,
    splitX,
  };
  return { doc, backgroundBlob };
}
