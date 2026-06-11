import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: 'src/main/index.js',
          SheetParser: 'src/main/SheetParser.js',
          TemplateEngine: 'src/main/TemplateEngine.js',
          ScheduleController: 'src/main/ScheduleController.js',
          SendQueue: 'src/main/SendQueue.js',
          GmailClient: 'src/main/GmailClient.js',
          Logger: 'src/main/Logger.js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: 'src/preload/index.js' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: { index: 'src/renderer/index.html' }
      }
    },
    plugins: [react()]
  }
})
