export const palettes = {
  light: { dark: false, background: '#F7F8FA', surface: '#FFFFFF', ink: '#18212F', muted: '#596475',
    accent: '#245CD6', accentInk: '#FFFFFF', soft: '#EAF0FC', border: '#D7DEE8',
    danger: '#B3261E', warning: '#805000', success: '#17683C' },
  dark: { dark: true, background: '#101318', surface: '#1B2028', ink: '#F1F4F9', muted: '#ADB8C8',
    accent: '#A9C5FF', accentInk: '#102B59', soft: '#253247', border: '#424D5E',
    danger: '#FFB4AB', warning: '#F3CC83', success: '#87D5A3' },
};
export type Colors = typeof palettes.light;
