import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { createReadStream, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { stat } from 'fs/promises'
import { dirname, extname, isAbsolute, relative, resolve } from 'path'
import type { Plugin } from 'vite'

const MONACO_SOURCE = resolve(__dirname, 'node_modules/monaco-editor/min/vs')
const MONACO_OUTPUT = resolve(__dirname, 'out/renderer/vs')
const MONACO_DEV_PATH = '/vs/'

/**
 * Keep Monaco's AMD loader while shipping only the dependency graph reachable
 * from the editor entry point. Monaco 0.56 uses content-hashed modules, so the
 * graph is discovered at build time instead of relying on version-specific
 * directory names.
 */
function monacoAssetsPlugin(): Plugin {
  return {
    name: 'monaco-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url || (request.method !== 'GET' && request.method !== 'HEAD')) return next()

        const pathname = new URL(request.url, 'http://localhost').pathname
        if (!pathname.startsWith(MONACO_DEV_PATH)) return next()

        const assetPath = decodeURIComponent(pathname.slice(MONACO_DEV_PATH.length))
        const source = resolve(MONACO_SOURCE, assetPath)
        const relativeSource = relative(MONACO_SOURCE, source)
        if (relativeSource.startsWith('..') || isAbsolute(relativeSource)) {
          response.statusCode = 403
          response.end()
          return
        }

        void stat(source)
          .then((metadata) => {
            if (!metadata.isFile()) return next()
            const contentTypes: Record<string, string> = {
              '.css': 'text/css; charset=utf-8',
              '.js': 'text/javascript; charset=utf-8',
              '.json': 'application/json; charset=utf-8'
            }
            response.statusCode = 200
            response.setHeader('Content-Type', contentTypes[extname(source)] ?? 'application/octet-stream')
            response.setHeader('Cache-Control', 'no-cache')
            if (request.method === 'HEAD') {
              response.end()
              return
            }
            createReadStream(source).pipe(response)
          })
          .catch(() => next())
      })
    },
    closeBundle() {
      rmSync(MONACO_OUTPUT, { recursive: true, force: true })
      const pending = ['loader.js', 'editor/editor.main.js', 'nls/lang/zh-cn.js']
      const copied = new Set<string>()

      const enqueueDependency = (fromFile: string, dependency: string): void => {
        const moduleId = dependency.replace(/!$/, '')
        if (moduleId === 'exports' || moduleId === 'require') return

        let target = moduleId.startsWith('vs/')
          ? resolve(MONACO_SOURCE, moduleId.slice(3))
          : resolve(MONACO_SOURCE, dirname(fromFile), moduleId)
        if (!target.endsWith('.js') && !target.endsWith('.css')) target += '.js'

        const relativeTarget = relative(MONACO_SOURCE, target)
        if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget) || !existsSync(target)) return
        pending.push(relativeTarget)
      }

      while (pending.length > 0) {
        const relativeFile = pending.pop()!
        if (copied.has(relativeFile)) continue

        const source = resolve(MONACO_SOURCE, relativeFile)
        if (!existsSync(source)) continue
        copied.add(relativeFile)

        const output = resolve(MONACO_OUTPUT, relativeFile)
        mkdirSync(dirname(output), { recursive: true })
        cpSync(source, output)
        if (extname(source) !== '.js') continue

        const contents = readFileSync(source, 'utf8')
        const dependencyBlock = contents.match(/^define\([^,]+,\s*\[([^\]]*)\]/)?.[1] ?? ''
        for (const match of dependencyBlock.matchAll(/["']([^"']+)["']/g)) {
          enqueueDependency(relativeFile, match[1]!)
        }
        for (const match of contents.matchAll(/toUrl\(["']([^"']+)["']\)/g)) {
          enqueueDependency(relativeFile, match[1]!)
        }

        // Basic language tokenizers are lazy and JSON is provided separately.
        if (relativeFile !== 'basic-languages/monaco.contribution.js') {
          for (const match of contents.matchAll(/\[\s*["'](\.\.?\/[^"']+)["']\s*\]/g)) {
            enqueueDependency(relativeFile, match[1]!)
          }
        }
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), monacoAssetsPlugin()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src')
      }
    }
  }
})
