import type { ArtStyleId } from '../types';

export type ArtStyle = {
  id: ArtStyleId;
  name: string;
  description: string;
  referenceImageUrl: string;
};

export const ART_STYLES: Record<ArtStyleId, ArtStyle> = {
  'folk-gouache': {
    id: 'folk-gouache',
    name: 'Folk-art gouache',
    description: 'Hand-painted, matte, simplified shapes. Warm and child-friendly.',
    referenceImageUrl: '/reference-image.png',
  },
};

export function getArtStyle(id: ArtStyleId): ArtStyle {
  return ART_STYLES[id];
}
