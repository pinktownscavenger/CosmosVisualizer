import { describe, expect, it } from 'vitest';
import { theme } from './theme';

describe('MUI theme', () => {
  it('uses the dark console palette and app font', () => {
    expect(theme.palette.type).toBe('dark');
    expect(theme.palette.primary.main).toBe('#22c55e');
    expect(theme.palette.primary.contrastText).toBe('#052e16');
    expect(theme.palette.background.paper).toBe('#111827');
    expect(theme.palette.background.default).toBe('#0f172a');
    expect(theme.typography.fontFamily).toBe('"IBM Plex Sans", Arial, sans-serif');
  });
});
