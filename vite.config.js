import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 주소(https://minquu.github.io/nihongo_seki/)에 맞춘 경로
export default defineConfig({
  base: '/nihongo_seki/',
  plugins: [react()],
});
