import { createMuiTheme } from '@material-ui/core/styles';

export const theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: { main: '#22c55e', contrastText: '#052e16' },
    background: { paper: '#111827', default: '#0f172a' }
  },
  typography: {
    fontFamily: '"IBM Plex Sans", Arial, sans-serif'
  }
});
