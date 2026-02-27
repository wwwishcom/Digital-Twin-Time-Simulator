import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':    'http://127.0.0.1:8000',
      '/tasks':   'http://127.0.0.1:8000',
      '/goals':   'http://127.0.0.1:8000',
      '/friends':    'http://127.0.0.1:8000',
      '/groups':     'http://127.0.0.1:8000',
      '/health':     'http://127.0.0.1:8000',
      '/logs':       'http://127.0.0.1:8000',
      '/life-scores':'http://127.0.0.1:8000',
      '/twinny':     'http://127.0.0.1:8000',
      '/simulation': 'http://127.0.0.1:8000',
      '/plan':          'http://127.0.0.1:8000',
      '/transactions':  'http://127.0.0.1:8000',
      '/projects':      'http://127.0.0.1:8000',
    },
  },
})
