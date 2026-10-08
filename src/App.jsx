import React from 'react';
import { NetworkGraphComponent } from './components/NetworkGraph/NetworkGraphComponent';
import TopBar from './components/TopBar/TopBar';

export const App = () => (
  <main className="app-shell">
    <TopBar />
    <NetworkGraphComponent />
  </main>
);
