import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Storybook and the story tests: the React Compiler (§14.2) and Tailwind CSS.
export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
});
