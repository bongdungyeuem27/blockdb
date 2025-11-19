import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Provider from './provider';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <Provider>
        <App />
      </Provider>
    </React.StrictMode>,
  );
}
