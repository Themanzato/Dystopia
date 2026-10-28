export type PixelTextProps = {
  text: string;
  /** Cap height; the full line adds space for accents. */
  size?: number;
  color?: string;
  maxWidth?: number;
  dim?: boolean;
  flicker?: boolean;
  active?: boolean;
  align?: 'left' | 'center';
  testID?: string;
  accessibilityRole?: 'header' | 'text';
  onReady?: () => void;
  onError?: (error: Error) => void;
};
