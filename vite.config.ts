import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // 'prompt', not 'autoUpdate' — autoUpdate silently reloads the page
      // the moment a new build is detected, with no warning, which was
      // wiping out whatever the person was mid-typing (owner feedback).
      // `src/features/pwa/swUpdate.ts` drives the actual update instead,
      // only ever applying it when the person chooses to.
      registerType: 'prompt',

      // A hand-written service worker (src/sw.ts) instead of the fully
      // generated one — needed to add push/notificationclick handling;
      // it still does its own precaching + the same offline-shell fallback
      // the generated one did.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The 15 fonts added in 2.17.0 aren't pre-downloaded with the app
        // (~0.9 MB few people need). Each one is fetched the first time it's
        // used and kept for offline from then on (see the font route in sw.ts).
        globIgnores: [
          '**/{poppins,montserrat,figtree,rubik,work-sans,atkinson-hyperlegible-next,space-grotesk,lora,jetbrains-mono,caveat,pacifico,bangers,permanent-marker,press-start-2p,creepster}-*.woff2',
        ],
      },

      includeAssets: [
        'favicon-48.png',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable.png',
      ],

      manifest: {
        name: 'Fico — Your Daily Financial Companion',
        short_name: 'Fico',
        description: 'Your Daily Financial Companion',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#863bff',
        background_color: '#ffffff',
        categories: ['finance', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
