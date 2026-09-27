import type { ArtStyleId } from '../types';

export type ArtStyle = {
  id: ArtStyleId;
  name: string;
  description: string;
  referenceImageUrl: string;
};

export const ART_STYLES: Record<ArtStyleId, ArtStyle> = {
  'pencil-sketch': {
    id: 'pencil-sketch',
    name: 'Pencil sketch',
    description: "Black-and-white pencil. Simple children's-book drawings with clear shapes.",
    referenceImageUrl: '',
  },
  'watercolour-storybook': {
    id: 'watercolour-storybook',
    name: 'Watercolour storybook',
    description: "Soft watercolour. The same simplicity, still a children's book.",
    referenceImageUrl: '',
  },
  'simple-cartoon': {
    id: 'simple-cartoon',
    name: 'Simple cartoon',
    description: "Bold simple shapes. A children's book, not a comedy animation frame.",
    referenceImageUrl: '',
  },
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
