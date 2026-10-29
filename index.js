/**
 * Design annotation — Host half.
 *
 * Publishes the same-origin `/annotate-api` routes the Client panel talks to:
 *
 *   * `serve`       streams one prototype HTML file, injecting the picker script.
 *   * `bridge.js`   the picker/renderer that runs inside the prototype document.
 *   * `annotations` reads and writes the sidecar store next to the prototype.
 *   * `scan`        lists `.html` files under a directory (recents default).
 *
 * The prototype file itself is never modified: annotations live in
 * `<file>.annotations.json`, which the agent can read with a normal file read.
 *
 * @module @local/dsh-client-plugin-annotate
 */

import { readFile, writeFile, rename, stat, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

/** Cordis plugin name for this bundle row. */
export const name = 'annotate'

/** Routes are published on the deployment's Web server. */
export const inject = ['webServer']

/** Prefix every Host route lives under. */
const API_PATH = '/annotate-api'

/** Largest request body the annotation writer accepts. */
const MAX_BODY_BYTES = 8 * 1024 * 1024

/** Files the panel may open as prototypes. */
const HTML_EXT = new Set(['.html', '.htm'])

const here = path.dirname(fileURLToPath(import.meta.url))

/** JSON response helper. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Plain-text response helper. */
function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Read the whole request body with a hard size cap. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Row config with every optional field defaulted. */
function resolveConfig(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const roots = Array.isArray(source.roots)
    ? source.roots.filter((root) => typeof root === 'string' && root.trim() !== '').map((root) => path.resolve(root))
    : []
  return {
    defaultFile: typeof source.defaultFile === 'string' && source.defaultFile.trim() !== ''
      ? path.resolve(source.defaultFile)
      : '',
    roots,
  }
}

/**
 * Resolve a request path into an absolute prototype path and its sidecar.
 * Throws a message the panel can show when the path is not an allowed HTML file.
 */
function resolvePrototype(config, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.trim() === '') throw new Error('缺少原型路径')
  const target = path.resolve(rawPath)
  if (!HTML_EXT.has(path.extname(target).toLowerCase())) throw new Error('只支持 .html / .htm 原型文件')
  if (config.roots.length > 0) {
    const allowed = config.roots.some((root) => target === root || target.startsWith(root + path.sep))
    if (!allowed) throw new Error('该路径不在允许的目录内：' + target)
  }
  return {
    file: target,
    sidecar: target + '.annotations.json',
  }
}

/** Empty annotation document. */
function emptyDocument(file) {
  return { version: 1, file, updatedAt: null, annotations: [] }
}

/** Normalise one stored annotation so the panel can rely on its shape. */
function normalizeAnnotation(raw) {
  if (raw === null || typeof raw !== 'object') return null
  if (typeof raw.selector !== 'string' || raw.selector.trim() === '') return null
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : randomUUID()
  const conditions = Array.isArray(raw.conditions)
    ? raw.conditions
      .filter((condition) => condition !== null && typeof condition === 'object' && typeof condition.selector === 'string')
      .slice(0, 12)
      .map((condition) => ({ selector: condition.selector, sig: condition.sig !== null && typeof condition.sig === 'object' ? condition.sig : {} }))
    : []
  return {
    id,
    selector: raw.selector,
    page: typeof raw.page === 'string' ? raw.page : '',
    note: typeof raw.note === 'string' ? raw.note : '',
    status: raw.status === 'resolved' ? 'resolved' : 'open',
    conditions,
    snapshot: raw.snapshot !== null && typeof raw.snapshot === 'object' ? raw.snapshot : {},
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

/** Load the sidecar document, tolerating a missing or unreadable file. */
async function loadDocument(target) {
  try {
    const text = await readFile(target.sidecar, 'utf8')
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed?.annotations) ? parsed.annotations.map(normalizeAnnotation).filter(Boolean) : []
    return {
      version: 1,
      file: target.file,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      annotations: list,
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyDocument(target.file)
    if (error instanceof SyntaxError) {
      return { ...emptyDocument(target.file), corrupt: true }
    }
    throw error
  }
}

/** Persist the sidecar document atomically (temp file + rename). */
async function saveDocument(target, annotations) {
  const document = {
    version: 1,
    file: target.file,
    updatedAt: new Date().toISOString(),
    annotations,
  }
  const temp = target.sidecar + '.tmp-' + randomUUID()
  await writeFile(temp, JSON.stringify(document, null, 2) + '\n', 'utf8')
  await rename(temp, target.sidecar)
  return document
}

/** Recursively collect `.html` files under `root`, two levels deep. */
async function scanHtml(root, depth, out) {
  if (depth < 0 || out.length >= 400) return
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      await scanHtml(full, depth - 1, out)
      continue
    }
    if (!entry.isFile() || !HTML_EXT.has(path.extname(entry.name).toLowerCase())) continue
    try {
      const info = await stat(full)
      out.push({ path: full, name: entry.name, size: info.size, mtime: info.mtimeMs })
    } catch {
      /* an unreadable entry is skipped */
    }
  }
}

/** Insert a chunk before `</body>`, appending when the document has no body end. */
function injectBeforeBody(html, chunk) {
  const index = html.toLowerCase().lastIndexOf('</body>')
  if (index === -1) return html + chunk
  return html.slice(0, index) + chunk + html.slice(index)
}

/** Inject the picker script before `</body>`. */
function injectBridge(html) {
  const tag = '\n<!-- dsh design annotation -->\n<script src="' + API_PATH + '/bridge.js"></script>\n'
  return injectBeforeBody(html, tag)
}

/**
 * Build the standalone export: the untouched prototype plus one inline block
 * that carries the annotations and the read-only viewer, so the result opens
 * from `file://` with no plugin, no server, and no extra assets.
 */
function buildExport(html, viewer, payload) {
  const data = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  const script = viewer.replace(/<\/script/gi, '<\\/script')
  const chunk = '\n<!-- dsh design annotation export (read-only) -->\n'
    + '<script>window.__DSH_ANNOTATE_DATA__=' + data + ';</script>\n'
    + '<script>\n' + script + '\n</script>\n'
  return injectBeforeBody(html, chunk)
}

/** Run one native dialog helper and capture its output. */
function runCommand(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error !== null && error !== undefined) {
        resolve({ code: typeof error.code === 'number' ? error.code : 1, stdout: stdout ?? '', stderr: stderr ?? String(error.message ?? error) })
        return
      }
      resolve({ code: 0, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

/**
 * The desktop shell is Electron, where a rendered page cannot learn the absolute
 * path of a `<input type=file>` selection. The Host can, so it asks the OS for
 * one native file dialog and hands the real path back to the panel.
 */
function buildPickerScript(platform, startDir) {
  if (platform === 'darwin') {
    const location = startDir !== '' ? ' default location (POSIX file ' + JSON.stringify(startDir) + ')' : ''
    return [
      'try',
      '  set pickedFile to choose file with prompt "选择 HTML 原型"' + location + ' of type {"html", "htm"}',
      '  return POSIX path of pickedFile',
      'on error number -128',
      '  return "__CANCELED__"',
      'end try',
    ].join('\n')
  }
  if (platform === 'win32') {
    return [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
      '$dialog.Filter = "HTML files (*.html;*.htm)|*.html;*.htm"',
      '$dialog.Title = "选择 HTML 原型"',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName } else { Write-Output "__CANCELED__" }',
    ].join('\n')
  }
  return 'zenity --file-selection --title="选择 HTML 原型" --file-filter="HTML|*.html *.htm"'
}

/** Open the OS file dialog and return an absolute path, or a cancellation. */
async function pickPrototypeFile(startDir) {
  const platform = process.platform
  if (platform === 'darwin') {
    const script = buildPickerScript(platform, startDir)
    const result = await runCommand('osascript', ['-e', script], 15 * 60 * 1000)
    if (result.code === 0) {
      const value = result.stdout.trim()
      if (value === '__CANCELED__' || value === '') return { canceled: true }
      return { path: value }
    }
    return { error: result.stderr.trim() || '系统文件选择器没有返回路径' }
  }
  if (platform === 'win32') {
    const script = buildPickerScript(platform, '')
    const result = await runCommand('powershell', ['-NoProfile', '-STA', '-Command', script], 15 * 60 * 1000)
    if (result.code === 0) {
      const value = result.stdout.trim()
      if (value === '__CANCELED__' || value === '') return { canceled: true }
      return { path: value }
    }
    return { error: result.stderr.trim() || '系统文件选择器没有返回路径' }
  }
  const result = await runCommand('sh', ['-c', buildPickerScript(platform, '')], 15 * 60 * 1000)
  if (result.code === 0 && result.stdout.trim() !== '') return { path: result.stdout.trim() }
  if (result.code === 1 || result.code === 252) return { canceled: true }
  return { error: result.stderr.trim() || '系统文件选择器不可用' }
}

const EXPORT_MARKER = '<!-- dsh design annotation export (read-only) -->'

/** Remove an embedded export viewer so the file can be served inside the panel. */
function stripExportBlock(html) {
  const start = html.indexOf(EXPORT_MARKER)
  if (start === -1) return html
  let cursor = start
  for (let index = 0; index < 2; index += 1) {
    const close = html.indexOf('</script>', cursor)
    if (close === -1) return html
    cursor = close + '</script>'.length
  }
  return html.slice(0, start) + html.slice(cursor)
}

/** Annotations embedded by "save source" when the sidecar does not exist yet. */
function readEmbeddedAnnotations(html) {
  const marker = 'window.__DSH_ANNOTATE_DATA__='
  const start = html.indexOf(marker)
  if (start === -1) return null
  const end = html.indexOf(';</script>', start)
  if (end === -1) return null
  try {
    const parsed = JSON.parse(html.slice(start + marker.length, end))
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.annotations)) return null
    return {
      version: 1,
      file: typeof parsed.file === 'string' ? parsed.file : '',
      updatedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
      annotations: parsed.annotations.map(normalizeAnnotation).filter(Boolean),
      embedded: true,
    }
  } catch (error) {
    return null
  }
}

/** Ask the OS for a save location, mirroring the file picker. */
function buildSaveScript(platform, startDir, defaultName) {
  if (platform === 'darwin') {
    const location = startDir !== '' ? ' default location (POSIX file ' + JSON.stringify(startDir) + ')' : ''
    return [
      'try',
      '  set targetFile to choose file name with prompt "保存已标注原型" default name ' + JSON.stringify(defaultName) + location,
      '  return POSIX path of targetFile',
      'on error number -128',
      '  return "__CANCELED__"',
      'end try',
    ].join('\n')
  }
  if (platform === 'win32') {
    return [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dialog = New-Object System.Windows.Forms.SaveFileDialog',
      '$dialog.Filter = "HTML files (*.html)|*.html"',
      '$dialog.FileName = "' + defaultName.replace(/"/g, '') + '"',
      '$dialog.Title = "保存已标注原型"',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName } else { Write-Output "__CANCELED__" }',
    ].join('\n')
  }
  return 'zenity --file-selection --save --confirm-overwrite --title="保存已标注原型" --filename="'
    + (startDir !== '' ? startDir + '/' : '') + defaultName + '"'
}

async function pickSavePath(startDir, defaultName) {
  const platform = process.platform
  if (platform === 'darwin') {
    const result = await runCommand('osascript', ['-e', buildSaveScript(platform, startDir, defaultName)], 15 * 60 * 1000)
    if (result.code === 0) {
      const value = result.stdout.trim()
      if (value === '__CANCELED__' || value === '') return { canceled: true }
      return { path: value }
    }
    return { error: result.stderr.trim() || '系统保存对话框没有返回路径' }
  }
  if (platform === 'win32') {
    const result = await runCommand('powershell', ['-NoProfile', '-STA', '-Command', buildSaveScript(platform, '', defaultName)], 15 * 60 * 1000)
    if (result.code === 0) {
      const value = result.stdout.trim()
      if (value === '__CANCELED__' || value === '') return { canceled: true }
      return { path: value }
    }
    return { error: result.stderr.trim() || '系统保存对话框没有返回路径' }
  }
  const result = await runCommand('sh', ['-c', buildSaveScript(platform, '', defaultName)], 15 * 60 * 1000)
  if (result.code === 0 && result.stdout.trim() !== '') return { path: result.stdout.trim() }
  if (result.code === 1 || result.code === 252) return { canceled: true }
  return { error: result.stderr.trim() || '系统保存对话框不可用' }
}

/** One plugin activation. */
function createAnnotate(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const log = (...args) => {
    try {
      ctx.logger?.info?.('[annotate]', ...args)
    } catch {
      /* logging never fails a request */
    }
  }

  /** Build the self-contained annotated document for one prototype. */
  async function exportDocument(target) {
    const raw = await readFile(target.file, 'utf8')
    const document = await loadDocument(target)
    const viewer = await readFile(path.join(here, 'export-viewer.js'), 'utf8')
    return buildExport(raw, viewer, {
      title: path.basename(target.file),
      file: target.file,
      exportedAt: new Date().toISOString(),
      annotations: document.annotations,
    })
  }

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.slice(API_PATH.length) || '/'

    try {
      if (route === '/bridge.js' && (req.method === 'GET' || req.method === 'HEAD')) {
        const body = await readFile(path.join(here, 'bridge.js'), 'utf8')
        sendText(res, 200, body, 'text/javascript; charset=utf-8')
        return
      }

      if (route === '/html2canvas.js' && (req.method === 'GET' || req.method === 'HEAD')) {
        const body = await readFile(path.join(here, 'vendor', 'html2canvas.min.js'), 'utf8')
        sendText(res, 200, body, 'text/javascript; charset=utf-8')
        return
      }

      if (route === '/serve' && req.method === 'GET') {
        const target = resolvePrototype(config, url.searchParams.get('path'))
        const raw = await readFile(target.file, 'utf8')
        const html = injectBridge(stripExportBlock(raw))
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'content-length': Buffer.byteLength(html),
        })
        res.end(html)
        return
      }

      if (route === '/pick-file' && req.method === 'GET') {
        const startDir = url.searchParams.get('dir') ?? ''
        /* dryRun lets tests verify script generation without opening a dialog. */
        if (url.searchParams.get('dryRun') === '1') {
          sendJson(res, 200, { platform: process.platform, script: buildPickerScript(process.platform, startDir) })
          return
        }
        const picked = await pickPrototypeFile(startDir)
        if (picked.canceled === true) {
          sendJson(res, 200, { canceled: true })
          return
        }
        if (typeof picked.error === 'string') {
          sendJson(res, 500, { error: picked.error })
          return
        }
        sendJson(res, 200, { path: picked.path })
        return
      }

      if (route === '/export' && req.method === 'GET') {
        const target = resolvePrototype(config, url.searchParams.get('path'))
        const exported = await exportDocument(target)
        const fileName = path.basename(target.file, path.extname(target.file)) + '.annotated.html'
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-disposition': 'attachment; filename="annotated-prototype.html"; filename*=UTF-8\'\'' + encodeURIComponent(fileName),
          'cache-control': 'no-store',
          'content-length': Buffer.byteLength(exported),
        })
        res.end(exported)
        return
      }

      if (route === '/probe' && req.method === 'GET') {
        const target = resolvePrototype(config, url.searchParams.get('path'))
        const raw = await readFile(target.file, 'utf8')
        const head = raw.slice(0, 8000)
        const meta = /<meta[^>]+name=["']viewport["'][^>]*content=["']([^"']+)["']/i.exec(head)
          || /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']viewport["']/i.exec(head)
        let viewportWidth = 0
        if (meta !== null) {
          const width = /(?:^|[,;\s])width\s*=\s*(\d{2,4})/i.exec(meta[1])
          if (width !== null) viewportWidth = Number(width[1])
        }
        const title = /<title[^>]*>([^<]*)<\/title>/i.exec(head)
        sendJson(res, 200, {
          path: target.file,
          title: title !== null ? title[1].trim() : '',
          viewportWidth,
          bytes: Buffer.byteLength(raw),
        })
        return
      }

      if (route === '/save-as' && req.method === 'GET') {
        const target = resolvePrototype(config, url.searchParams.get('path'))
        const prepared = await exportDocument(target)
        const requested = url.searchParams.get('target')
        let destination = ''
        if (typeof requested === 'string' && requested.trim() !== '') {
          destination = path.resolve(requested.trim())
        } else {
          if (url.searchParams.get('dryRun') === '1') {
            sendJson(res, 200, { platform: process.platform, script: buildSaveScript(process.platform, path.dirname(target.file), path.basename(target.file).replace(/\.html?$/i, '') + '.annotated.html') })
            return
          }
          const picked = await pickSavePath(path.dirname(target.file), path.basename(target.file).replace(/\.html?$/i, '') + '.annotated.html')
          if (picked.canceled === true) {
            sendJson(res, 200, { canceled: true })
            return
          }
          if (typeof picked.error === 'string') {
            sendJson(res, 500, { error: picked.error })
            return
          }
          destination = picked.path
        }
        if (!/\.html?$/i.test(destination)) destination += '.html'
        await writeFile(destination, prepared, 'utf8')
        sendJson(res, 200, { path: destination, bytes: Buffer.byteLength(prepared) })
        return
      }

      if (route === '/annotations' && req.method === 'GET') {
        const target = resolvePrototype(config, url.searchParams.get('path'))
        let document = await loadDocument(target)
        if (document.annotations.length === 0) {
          /* A file produced by "save source" carries its annotations inline. */
          const raw = await readFile(target.file, 'utf8').catch(() => '')
          const embedded = readEmbeddedAnnotations(raw)
          if (embedded !== null) document = embedded
        }
        sendJson(res, 200, document)
        return
      }

      if (route === '/annotations' && req.method === 'POST') {
        const body = await readBody(req)
        let payload
        try {
          payload = JSON.parse(body)
        } catch {
          sendJson(res, 400, { error: '请求体不是合法 JSON' })
          return
        }
        const target = resolvePrototype(config, payload?.path)
        const annotations = Array.isArray(payload?.annotations)
          ? payload.annotations.map(normalizeAnnotation).filter(Boolean)
          : []
        const document = await saveDocument(target, annotations)
        sendJson(res, 200, document)
        return
      }

      if (route === '/scan' && req.method === 'GET') {
        const rawDir = url.searchParams.get('dir')
        const dir = path.resolve(typeof rawDir === 'string' && rawDir.trim() !== '' ? rawDir : process.cwd())
        if (config.roots.length > 0) {
          const allowed = config.roots.some((root) => dir === root || dir.startsWith(root + path.sep))
          if (!allowed) {
            sendJson(res, 403, { error: '该目录不在允许的范围内：' + dir })
            return
          }
        }
        const out = []
        await scanHtml(dir, 2, out)
        out.sort((a, b) => b.mtime - a.mtime)
        sendJson(res, 200, { dir, files: out })
        return
      }

      if (route === '/config' && req.method === 'GET') {
        sendJson(res, 200, { defaultFile: config.defaultFile, roots: config.roots })
        return
      }

      sendJson(res, 404, { error: '未知接口：' + route })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error?.code === 'ENOENT') sendJson(res, 404, { error: '文件不存在：' + message })
      else sendJson(res, 400, { error: message })
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PATH,
    handler: (req, res) => handle(req, res),
  }), 'annotate: /annotate-api routes')

  log('ready')
}

export function apply(ctx, config) {
  createAnnotate(ctx, config)
}
