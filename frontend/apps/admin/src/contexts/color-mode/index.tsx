'use client';

import { createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { RefineThemes } from '@refinedev/mui';
import Cookies from 'js-cookie';
import React, { type PropsWithChildren, createContext, useEffect, useState } from 'react';

type ColorModeContextType = {
  mode: string;
  setMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType>({} as ColorModeContextType);

type ColorModeContextProviderProps = {
  defaultMode?: string;
};

const darkTheme = createTheme({
  ...RefineThemes.BlueDark,
  palette: {
    ...RefineThemes.BlueDark.palette,
    primary: {
      main: '#42a5f6',
    },
    secondary: {
      main: '#c41442',
    },
    background: {
      default: '#000000',
      paper: '#212121',
    },
  },
  components: {
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
        variant: 'outlined',
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
    },
  },
});

const lightTheme = createTheme({
  ...RefineThemes.Blue,
  palette: {
    ...RefineThemes.Blue.palette,
    primary: {
      main: '#42a5f6',
    },
    // secondary: {
    //   main: '#c41442',
    // },
    // background: {
    //   default: '#ffffff',
    //   paper: '#dcdcdc',
    // },
  },
});

export const ColorModeContextProvider: React.FC<
  PropsWithChildren<ColorModeContextProviderProps>
> = ({ children, defaultMode }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState(defaultMode || 'dark');

  useEffect(() => {
    setIsMounted(() => true);
  }, []);

  const systemTheme = useMediaQuery(`(prefers-color-scheme: dark)`);

  useEffect(() => {
    if (isMounted) {
      const theme = Cookies.get('theme') || (systemTheme ? 'dark' : 'light');
      setMode(() => theme);
    }
  }, [isMounted, systemTheme]);

  const toggleTheme = () => {
    const nextTheme = mode === 'light' ? 'dark' : 'light';

    setMode(() => nextTheme);
    Cookies.set('theme', nextTheme);
  };

  return (
    <ColorModeContext.Provider
      value={{
        setMode: toggleTheme,
        mode,
      }}
    >
      <ThemeProvider theme={mode === 'light' ? lightTheme : darkTheme}>
        <CssBaseline />
        <GlobalStyles styles={{ html: { WebkitFontSmoothing: 'auto' } }} />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
