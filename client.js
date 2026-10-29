/**
 * Design annotation — Client half.
 *
 * One main panel: the prototype canvas on the left, the annotation list on the
 * right. The canvas is a same-origin iframe served by the Host's
 * `/annotate-api/serve`, so the injected bridge can pick elements with ordinary
 * DOM APIs; everything the user writes travels back here and is persisted by the
 * Host into the prototype's sidecar file.
 *
 * Services: `slots` (registration), `locale` (copy), `layout` (panel navigation).
 * React comes from the browser module table; no other package is imported.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-client-plugin-annotate',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const useSyncExternalStore = React.useSyncExternalStore
    const useState = React.useState
    const useEffect = React.useEffect
    const useRef = React.useRef

    const NS = 'annotate'
    const PANEL_ID = 'annotate'
    const API = '/annotate-api'
    const STYLE_ID = '@local/dsh-client-plugin-annotate/annotate.css'
    const STORE_KEY = 'dsh.annotate.file'
    const SCREEN_W = 480
    const SCREEN_H = 894
    const SOURCE = 'dsh-annotate'

    const zh = {
      title: '设计标注',
      subtitle: '在原型上点选元素写注释，流程走到该状态时自动显示',
      open: '打开原型',
      chooseLocal: '选择本地文件',
      chooseLocalHint: '打开系统文件选择器，直接选一个本地 HTML，不需要粘贴路径',
      manualPath: '手动输入路径 / 扫描目录',
      picking: '等待系统选择…',
      pickFailed: '系统文件选择器不可用',
      openTitle: '打开 HTML 原型',
      pathLabel: '原型路径',
      pathPlaceholder: '/Users/你/项目/index.html',
      scanLabel: '目录',
      scanPlaceholder: '/Users/你/项目',
      scan: '扫描目录',
      scanning: '扫描中…',
      scanEmpty: '该目录下没有 .html 文件',
      recent: '最近打开',
      cancel: '取消',
      confirm: '打开',
      change: '更换',
      reload: '重新加载',
      annotateMode: '标注模式',
      annotateHint: '开启后点击元素即可加标注；再点一次或按 Esc 关闭；Shift 可快速开关',
      annotations: '标注',
      notesTitle: '备注',
      emptyTitle: '还没有标注',
      emptyHint: '打开标注模式，然后点选原型里的任意元素',
      noFileTitle: '先打开一个 HTML 原型',
      noFileHint: '支持绝对路径；原型里的浮层状态会被自动记录，标注只在对应状态出现。',
      loading: '加载中…',
      save: '保存标注',
      saving: '保存中…',
      discard: '取消',
      notePlaceholder: '写下这里的问题或建议…',
      picked: '已选中元素',
      lockedHint: '位置已锁定，鼠标移到右侧可安心填写；点原型其他区域重新选择',
      saveSource: '保存源文件',
      saveSourceHint: '把原型和标注一起保存成可再次打开的文件',
      savingSource: '保存中…',
      savedTo: '已保存到',
      saveCanceled: '已取消保存',
      saveFallback: '已改为浏览器下载（重启 Harness 后可使用系统保存框）',
      saveFailed: '保存失败',
      modeOn: '标注模式已开启（Shift 可关闭）',
      modeOff: '标注模式已关闭',
      delete: '删除',
      deleteConfirm: '确认删除',
      deleted: '已删除',
      copyAll: '复制标注',
      exportPkg: '导出标注包',
      exported: '已导出标注包',
      exportFailed: '导出失败',
      copied: '已复制到剪贴板',
      copyEmpty: '还没有可复制的标注',
      copyFailed: '复制失败',
      focusFailed: '该标注在当前流程状态下不可见',
      focusOk: '已定位',
      bridgeWait: '等待原型脚本就绪…',
      reloadBridge: '重试',
      openFailed: '打开失败',
      loadFailed: '读取标注失败',
      saveFailed: '保存失败',
      statusOpen: '待处理',
      statusResolved: '已解决',
      resolve: '标记已解决',
      reopen: '重新打开',
      selector: '选择器',
      count: '{n} 条',
      hiddenNow: '当前状态不可见',
      pageAll: '全部页面',
      author: '标注人',
      deleteConfirmHint: '再点一次删除这条标注（只删标注，不动原型）',
      fileTab: '文件',
      record: '流程录制',
      recording: '录制中',
      recordIdleHint: '点击「流程录制」，然后在原型里正常操作，每一步都会自动截图',
      recordNeedsModeOff: '先关闭标注模式再开始录制',
      recordBusy: '截图中…',
      insertStep: '插入步骤',
      finishRecord: '结束生成',
      finishing: '正在生成…',
      recordSlow: '这一步截图超时，已跳过，可继续操作或直接结束',
      cancelRecord: '取消录制',
      stepPromptTitle: '插入一个步骤',
      stepPromptHint: '用于记录没有点击的等待状态，例如「AI 解析完成」',
      stepPromptLabel: '步骤名称',
      stepPromptPlaceholder: '例如：等待 AI 解析完成',
      stepPromptConfirm: '插入',
      backToProto: '返回原型',
      downloadPng: '下载 PNG',
      downloadHtml: '下载流程板',
      boardTitle: '流程看板',
      boardHint: '按操作顺序生成；箭头上的文字是下一步的动作，角标是这一步可见的批注数',
      boardSteps: '{n} 步',
      annotationsOnStep: '{n} 条批注',
      stepOf: '第 {n} 步',
      recordEmpty: '没有录到任何步骤',
      recordFailed: '录制失败',
      boardExported: '已导出流程板',
      flowNameHint: '点击可修改流程名称，下载时会带上',
      flowNamePlaceholder: '流程名称',
    }

    const en = {
      title: 'Design Annotation',
      subtitle: 'Pick elements in a prototype and leave notes; they reappear when the flow reaches that state',
      open: 'Open prototype',
      chooseLocal: 'Choose a file',
      chooseLocalHint: 'Opens the system file picker, so no path needs to be pasted',
      manualPath: 'Paste a path / scan a folder',
      picking: 'Waiting for the system dialog…',
      pickFailed: 'The system file picker is unavailable',
      openTitle: 'Open an HTML prototype',
      pathLabel: 'Prototype path',
      pathPlaceholder: '/Users/you/project/index.html',
      scanLabel: 'Directory',
      scanPlaceholder: '/Users/you/project',
      scan: 'Scan',
      scanning: 'Scanning…',
      scanEmpty: 'No .html files under this directory',
      recent: 'Recent',
      cancel: 'Cancel',
      confirm: 'Open',
      change: 'Change',
      reload: 'Reload',
      annotateMode: 'Annotate',
      annotateHint: 'Click any element to annotate; click again, Esc, or tap Shift to close',
      annotations: 'Annotations',
      notesTitle: 'Notes',
      emptyTitle: 'No annotations yet',
      emptyHint: 'Turn on Annotate, then click any element in the prototype',
      noFileTitle: 'Open an HTML prototype first',
      noFileHint: 'Absolute paths are supported. Overlay states are captured automatically, so a note only shows in its own state.',
      loading: 'Loading…',
      save: 'Save note',
      saving: 'Saving…',
      discard: 'Cancel',
      notePlaceholder: 'What is wrong or worth changing here?',
      picked: 'Selected element',
      lockedHint: 'Position locked — move to the right panel to type; click another area to pick again',
      saveSource: 'Save source',
      saveSourceHint: 'Save the prototype and its notes as one reopenable file',
      savingSource: 'Saving…',
      savedTo: 'Saved to',
      saveCanceled: 'Save canceled',
      saveFallback: 'Downloaded through the browser (restart Harness to use the system save dialog)',
      saveFailed: 'Save failed',
      modeOn: 'Annotate mode on (tap Shift to close)',
      modeOff: 'Annotate mode off',
      delete: 'Delete',
      deleteConfirm: 'Delete it',
      deleted: 'Deleted',
      copyAll: 'Copy notes',
      exportPkg: 'Export package',
      exported: 'Exported',
      exportFailed: 'Export failed',
      copied: 'Copied to clipboard',
      copyEmpty: 'Nothing to copy yet',
      copyFailed: 'Copy failed',
      focusFailed: 'Not visible in the current flow state',
      focusOk: 'Located',
      bridgeWait: 'Waiting for the prototype script…',
      reloadBridge: 'Retry',
      openFailed: 'Open failed',
      loadFailed: 'Loading annotations failed',
      saveFailed: 'Save failed',
      statusOpen: 'Open',
      statusResolved: 'Resolved',
      resolve: 'Mark resolved',
      reopen: 'Reopen',
      selector: 'Selector',
      count: '{n}',
      hiddenNow: 'Hidden in this state',
      pageAll: 'All pages',
      author: 'Author',
      deleteConfirmHint: 'Click Delete again to remove this note (the prototype is untouched)',
      fileTab: 'File',
      record: 'Record flow',
      recording: 'Recording',
      recordIdleHint: 'Start recording, then use the prototype normally; every step is captured',
      recordNeedsModeOff: 'Turn annotate mode off before recording',
      recordBusy: 'Capturing…',
      insertStep: 'Add step',
      finishRecord: 'Finish',
      finishing: 'Building…',
      recordSlow: 'This frame timed out and was skipped; keep going or finish',
      cancelRecord: 'Cancel',
      stepPromptTitle: 'Add a step',
      stepPromptHint: 'Use this for wait states that have no click, such as "AI finished parsing"',
      stepPromptLabel: 'Step name',
      stepPromptPlaceholder: 'For example: waiting for AI parse',
      stepPromptConfirm: 'Add',
      backToProto: 'Back to prototype',
      downloadPng: 'Download PNG',
      downloadHtml: 'Download board',
      boardTitle: 'Flow board',
      boardHint: 'Ordered by interaction; arrow labels name the next action, badges count visible notes',
      boardSteps: '{n} steps',
      annotationsOnStep: '{n} notes',
      stepOf: 'Step {n}',
      recordEmpty: 'No steps were recorded',
      recordFailed: 'Recording failed',
      boardExported: 'Flow board exported',
      flowNameHint: 'Click to rename the flow; the name is used in both downloads',
      flowNamePlaceholder: 'Flow name',
    }

    let translate = (key) => zh[key] ?? en[key] ?? String(key)
    const t = (key, params) => {
      const template = translate(key)
      if (params === null || typeof params !== 'object') return template
      return String(template).replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])))
    }

    /* ------------------------------------------------------------------ store */

    const state = {
      file: '',
      status: 'idle',
      error: '',
      annotations: [],
      mode: false,
      activeId: null,
      draft: null,
      draftNote: '',
      saving: false,
      picker: false,
      pickerPath: '',
      pickerDir: '',
      pickerFiles: [],
      pickerBusy: false,
      picking: false,
      pickerError: '',
      recents: [],
      iframeKey: 0,
      bridgeReady: false,
      bridgeAt: 0,
      toast: '',
      pendingDelete: '',
      scale: 0.8,
      artboard: { w: 480, h: 894, autoHeight: false },
      hoverId: '',
      visibleIds: [],
      visibleKnown: false,
      recording: false,
      recordBusy: false,
      stopping: false,
      steps: [],
      recordRun: 0,
      pageTitle: '',
      flowName: '',
      savingSource: false,
      view: 'preview',
      board: null,
      boardHover: 0,
      boardStepHover: 0,
      stepPrompt: null,
    }

    const listeners = new Set()
    /* useSyncExternalStore bails out when the snapshot keeps its identity, so the
       snapshot is a monotonic revision while components read the mutable `state`
       above. Publishing is then the only way a render becomes stale. */
    let revision = 0
    const store = {
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      getSnapshot() {
        return revision
      },
      publish() {
        revision += 1
        for (const listener of listeners) listener()
      },
    }

    let toastTimer = null
    let recordStopTimer = null
    let recordBusyTimer = null
    function toast(message) {
      state.toast = message
      store.publish()
      if (toastTimer !== null) window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => {
        state.toast = ''
        toastTimer = null
        store.publish()
      }, 2600)
    }

    function readRecents() {
      try {
        const raw = window.localStorage.getItem('dsh.annotate.recents')
        const parsed = raw === null ? [] : JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 8) : []
      } catch (error) {
        return []
      }
    }

    function rememberFile(file) {
      const next = [file, ...state.recents.filter((item) => item !== file)].slice(0, 8)
      state.recents = next
      try {
        window.localStorage.setItem('dsh.annotate.recents', JSON.stringify(next))
        window.localStorage.setItem(STORE_KEY, file)
      } catch (error) {
        /* a disabled localStorage only costs recents */
      }
    }

    state.recents = readRecents()
    try {
      state.file = window.localStorage.getItem(STORE_KEY) ?? ''
    } catch (error) {
      state.file = ''
    }

    /* -------------------------------------------------------------------- API */

    async function api(path, options) {
      const response = await fetch(API + path, options)
      const text = await response.text()
      let data = null
      if (text !== '') {
        try {
          data = JSON.parse(text)
        } catch (error) {
          data = null
        }
      }
      if (!response.ok) {
        const message = data !== null && typeof data.error === 'string' ? data.error : 'HTTP ' + response.status
        throw new Error(message)
      }
      return data
    }

    async function persist(next) {
      const document = await api('/annotations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: state.file, annotations: next }),
      })
      return document
    }

    /* --------------------------------------------------------------- iframe io */

    let frameEl = null

    /** Stable ref callback: React calls it on every render, so only a real swap resets readiness. */
    function setFrame(node) {
      if (node === frameEl) return
      frameEl = node
      if (node !== null) {
        state.bridgeReady = false
        state.bridgeAt = Date.now()
        store.publish()
      }
    }

    function toFrame(payload) {
      const frame = frameEl
      if (frame === null || frame.contentWindow === null) return
      payload.source = SOURCE
      try {
        frame.contentWindow.postMessage(payload, '*')
      } catch (error) {
        /* the frame may be navigating */
      }
    }

    function pushAnnotations() {
      toFrame({ type: 'set', annotations: state.annotations })
    }

    function pushMode() {
      toFrame({ type: 'mode', on: state.mode })
    }

    /** A phone prototype knows its width but not its height until it renders. */
    function applyArtboardMetrics(metrics) {
      if (state.artboard.autoHeight !== true) return
      const scrollHeight = Number(metrics?.scrollHeight)
      const viewportHeight = Number(metrics?.height)
      const height = scrollHeight > 0 ? scrollHeight : viewportHeight
      if (!Number.isFinite(height) || height < 320) return
      const clamped = Math.min(1600, Math.max(400, Math.round(height)))
      if (Math.abs(clamped - state.artboard.h) < 4) return
      state.artboard = { w: state.artboard.w, h: clamped, autoHeight: true }
    }

    /** One window-level listener keeps the panel and the frame in sync. */
    function onFrameMessage(event) {
      if (frameEl === null || event.source !== frameEl.contentWindow) return
      const data = event.data
      if (data === null || typeof data !== 'object' || data.source !== SOURCE) return

      if (data.type === 'ready') {
        state.bridgeReady = true
        state.bridgeAt = Date.now()
        applyArtboardMetrics(data)
        store.publish()
        pushAnnotations()
        pushMode()
        if (state.activeId !== null) toFrame({ type: 'active', id: state.activeId })
        return
      }
      if (data.type === 'metrics') {
        applyArtboardMetrics(data)
        store.publish()
        return
      }
      if (data.type === 'modeState') {
        state.mode = data.on === true
        store.publish()
        return
      }
      if (data.type === 'picked') {
        if (typeof data.selector !== 'string' || data.selector === '') return
        state.draft = {
          selector: data.selector,
          page: typeof data.page === 'string' ? data.page : '',
          conditions: Array.isArray(data.conditions) ? data.conditions : [],
          snapshot: data.snapshot !== null && typeof data.snapshot === 'object' ? data.snapshot : {},
        }
        state.draftNote = ''
        state.picker = false
        store.publish()
        return
      }
      if (data.type === 'shiftToggle') {
        toggleAnnotateMode(true)
        return
      }
      if (data.type === 'unpick') {
        state.draft = null
        state.draftNote = ''
        store.publish()
        return
      }
      if (data.type === 'activate') {
        if (typeof data.id !== 'string') return
        state.activeId = data.id
        state.pendingDelete = ''
        store.publish()
        return
      }
      if (data.type === 'recordStarted') {
        state.recordRun = typeof data.run === 'number' ? data.run : state.recordRun + 1
        state.pageTitle = typeof data.title === 'string' && data.title.trim() !== '' ? data.title.trim() : ''
        state.recording = true
        state.recordBusy = true
        state.steps = []
        state.board = null
        state.view = 'preview'
        store.publish()
        return
      }
      if (data.type === 'recordBusy') {
        if (typeof data.run === 'number' && data.run !== state.recordRun) return
        state.recordBusy = data.capturing === true
        if (state.recordBusy) {
          if (recordBusyTimer !== null) window.clearTimeout(recordBusyTimer)
          recordBusyTimer = window.setTimeout(() => {
            recordBusyTimer = null
            if (state.recordBusy) {
              state.recordBusy = false
              store.publish()
              toast(t('recordSlow'))
            }
          }, 25000)
        } else if (recordBusyTimer !== null) {
          window.clearTimeout(recordBusyTimer)
          recordBusyTimer = null
        }
        store.publish()
        return
      }
      if (data.type === 'recordStep') {
        if (typeof data.run === 'number' && data.run !== state.recordRun) return
        if (state.steps.some((step) => step.id === data.step?.id)) return
        if (data.step !== null && typeof data.step === 'object') {
          state.steps = [...state.steps, data.step]
          store.publish()
        }
        return
      }
      if (data.type === 'recordDone') {
        if (typeof data.run === 'number' && data.run !== state.recordRun) return
        const steps = Array.isArray(data.steps) ? data.steps : []
        finishRecording(steps)
        return
      }
      if (data.type === 'recordCancelled') {
        if (typeof data.run === 'number') state.recordRun = data.run
        clearRecordTimers()
        state.recording = false
        state.recordBusy = false
        state.stopping = false
        state.steps = []
        store.publish()
        return
      }
      if (data.type === 'recordError') {
        toast(t('recordFailed') + ': ' + String(data.message ?? ''))
        return
      }
      if (data.type === 'visible') {
        state.visibleIds = Array.isArray(data.ids) ? data.ids.filter((id) => typeof id === 'string') : []
        state.visibleKnown = true
        store.publish()
        return
      }
      if (data.type === 'focusResult') {
        if (data.ok === false) toast(t('focusFailed'))
        return
      }
    }

    /* -------------------------------------------------------------- operations */

    async function probeArtboard(target) {
      let viewportWidth = 0
      try {
        const probe = await api('/probe?path=' + encodeURIComponent(target))
        viewportWidth = probe !== null && typeof probe.viewportWidth === 'number' ? probe.viewportWidth : 0
      } catch (error) {
        viewportWidth = 0
      }
      if (viewportWidth >= 280 && viewportWidth <= 700) {
        return { w: viewportWidth, h: 894, autoHeight: true }
      }
      /* Desktop prototypes: render as a normal browser window. */
      return { w: 1280, h: 800, autoHeight: false }
    }

    async function openFile(file, options) {
      const target = String(file ?? '').trim()
      if (target === '') return
      state.file = target
      state.status = 'loading'
      state.error = ''
      state.annotations = []
      state.draft = null
      state.draftNote = ''
      state.activeId = null
      state.bridgeReady = false
      state.mode = false
      state.picker = false
      state.pendingDelete = ''
      state.visibleIds = []
      state.visibleKnown = false
      state.artboard = await probeArtboard(target)
      state.recording = false
      state.recordBusy = false
      state.steps = []
      state.board = null
      state.flowName = ''
      state.view = 'preview'
      state.stepPrompt = null
      rememberFile(target)
      store.publish()
      try {
        const document = await api('/annotations?path=' + encodeURIComponent(target))
        state.annotations = Array.isArray(document?.annotations) ? document.annotations : []
        if (document?.corrupt === true) toast(t('loadFailed') + ': sidecar JSON 解析失败')
        state.status = 'ready'
        state.iframeKey += 1
        state.bridgeAt = Date.now()
        store.publish()
      } catch (error) {
        state.status = 'error'
        state.error = String(error?.message ?? error)
        store.publish()
      }
    }

    function closeFile() {
      state.file = ''
      state.status = 'idle'
      state.annotations = []
      state.draft = null
      state.mode = false
      state.bridgeReady = false
      state.error = ''
      try {
        window.localStorage.removeItem(STORE_KEY)
      } catch (error) {
        /* ignore */
      }
      store.publish()
    }

    function reload() {
      if (state.file === '') return
      void openFile(state.file)
    }

    /** Shift tap and the toggle button share one guarded switch. */
    function toggleAnnotateMode(viaShortcut) {
      if (state.status !== 'ready' || state.file === '') return
      if (state.recording || state.stopping || state.view === 'board') return
      if (state.picker || state.stepPrompt !== null || state.picking) return
      const next = !state.mode
      setMode(next)
      if (viaShortcut === true) toast(next ? t('modeOn') : t('modeOff'))
    }

    function setMode(next) {
      state.mode = next
      if (next === true) {
        state.picker = false
        state.draft = null
      }
      store.publish()
      pushMode()
    }

    async function saveDraft() {
      const draft = state.draft
      if (draft === null || state.saving) return
      const note = state.draftNote.trim()
      if (note === '') {
        toast(t('notePlaceholder'))
        return
      }
      const now = new Date().toISOString()
      const annotation = {
        id: 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        selector: draft.selector,
        page: draft.page || '',
        note,
        status: 'open',
        conditions: draft.conditions,
        snapshot: draft.snapshot,
        createdAt: now,
        updatedAt: null,
      }
      state.saving = true
      store.publish()
      try {
        const next = [...state.annotations, annotation]
        await persist(next)
        state.annotations = next
        state.activeId = annotation.id
        state.draft = null
        state.draftNote = ''
        state.saving = false
        store.publish()
        toFrame({ type: 'lockClear' })
        pushAnnotations()
        toast(t('save') + ' ✓')
      } catch (error) {
        state.saving = false
        store.publish()
        toast(t('saveFailed') + ': ' + String(error?.message ?? error))
      }
    }

    async function deleteAnnotation(id) {
      const next = state.annotations.filter((item) => item.id !== id)
      if (next.length === state.annotations.length) return
      try {
        await persist(next)
        state.annotations = next
        if (state.activeId === id) state.activeId = null
        state.pendingDelete = ''
        store.publish()
        pushAnnotations()
        toast(t('deleted'))
      } catch (error) {
        toast(t('saveFailed') + ': ' + String(error?.message ?? error))
      }
    }

    async function toggleResolved(annotation) {
      const next = state.annotations.map((item) => item.id === annotation.id
        ? { ...item, status: item.status === 'resolved' ? 'open' : 'resolved', updatedAt: new Date().toISOString() }
        : item)
      try {
        await persist(next)
        state.annotations = next
        store.publish()
        pushAnnotations()
      } catch (error) {
        toast(t('saveFailed') + ': ' + String(error?.message ?? error))
      }
    }

    async function scanDirectory(directory) {
      const dir = String(directory ?? '').trim()
      if (dir === '') return
      state.pickerBusy = true
      state.pickerError = ''
      store.publish()
      try {
        const result = await api('/scan?dir=' + encodeURIComponent(dir))
        state.pickerFiles = Array.isArray(result?.files) ? result.files : []
        state.pickerBusy = false
        if (state.pickerFiles.length === 0) state.pickerError = t('scanEmpty')
        store.publish()
      } catch (error) {
        state.pickerBusy = false
        state.pickerError = String(error?.message ?? error)
        store.publish()
      }
    }

    /** Ask the Host to open the OS file dialog; it returns the real path. */
    async function pickNativeFile() {
      if (state.picking) return
      state.picking = true
      state.pickerError = ''
      store.publish()
      try {
        const dir = state.pickerDir !== ''
          ? state.pickerDir
          : (state.file !== '' && state.file.includes('/') ? state.file.slice(0, state.file.lastIndexOf('/')) : '')
        const result = await api('/pick-file?dir=' + encodeURIComponent(dir))
        state.picking = false
        if (result !== null && typeof result.path === 'string' && result.path !== '') {
          state.picker = false
          store.publish()
          void openFile(result.path)
          return
        }
        store.publish()
      } catch (error) {
        state.picking = false
        state.pickerError = t('pickFailed') + ': ' + String(error?.message ?? error)
        state.picker = true
        store.publish()
      }
    }

    function openPicker() {
      state.picker = true
      state.pickerError = ''
      state.pickerFiles = []
      if (state.pickerPath === '') {
        const candidate = state.file !== '' ? state.file : state.recents[0] ?? ''
        state.pickerPath = candidate
        const slash = candidate.lastIndexOf('/')
        state.pickerDir = slash > 0 ? candidate.slice(0, slash) : ''
      }
      store.publish()
    }

    function markdownForAnnotations() {
      const rows = []
      rows.push('# 设计标注 · ' + state.file)
      rows.push('')
      for (let index = 0; index < state.annotations.length; index += 1) {
        const annotation = state.annotations[index]
        rows.push('## ' + (index + 1) + '. ' + (annotation.page || '页面') + (annotation.status === 'resolved' ? '（已解决）' : ''))
        rows.push('- 文件：`' + state.file + '`')
        rows.push('- 选择器：`' + annotation.selector + '`')
        const snapshot = annotation.snapshot ?? {}
        if (typeof snapshot.tag === 'string' && snapshot.tag !== '') {
          rows.push('- 元素：`<' + snapshot.tag + '>`' + (typeof snapshot.text === 'string' && snapshot.text !== '' ? ' 文本「' + snapshot.text + '」' : ''))
        }
        if (Array.isArray(annotation.conditions) && annotation.conditions.length > 0) {
          rows.push('- 出现状态：' + annotation.conditions.map((condition) => '`' + condition.selector + '`').join(' + '))
        }
        rows.push('- 标注：' + (annotation.note === '' ? '（空）' : annotation.note))
        rows.push('')
      }
      return rows.join('\n')
    }

    /** Download the standalone `.annotated.html`: prototype + notes in one file. */
    function exportPackage() {
      if (state.file === '') return
      try {
        const anchor = document.createElement('a')
        anchor.href = API + '/export?path=' + encodeURIComponent(state.file)
        anchor.download = ''
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        if (anchor.parentNode !== null) anchor.parentNode.removeChild(anchor)
        toast(t('exported'))
      } catch (error) {
        toast(t('exportFailed') + ': ' + String(error?.message ?? error))
      }
    }

    async function copyAll() {
      if (state.annotations.length === 0) {
        toast(t('copyEmpty'))
        return
      }
      const text = markdownForAnnotations()
      try {
        await navigator.clipboard.writeText(text)
        toast(t('copied'))
        return
      } catch (error) {
        /* Clipboard permission is not always granted to a plugin surface. */
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        if (area.parentNode !== null) area.parentNode.removeChild(area)
        toast(ok ? t('copied') : t('copyFailed'))
      } catch (error) {
        toast(t('copyFailed'))
      }
    }

    /* -------------------------------------------------------------- flow board */

    function boardTitle() {
      return state.pageTitle !== '' ? state.pageTitle : filenameBase()
    }

    function filenameBase() {
      const name = state.file.split('/').pop() ?? 'prototype'
      return name.replace(/\.html?$/i, '')
    }

    function escapeXml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    /** Filesystem-safe fragment: no path separators or Windows-reserved characters. */
    function safeNamePart(value) {
      return String(value ?? '')
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
    }

    /** `<flow name>_<original file>.flow.<ext>`, e.g. 扫描运单识别流程_index.flow.html */
    function boardFileName(extension) {
      const flow = safeNamePart(state.flowName || boardTitle()).replace(/\s/g, '-')
      const base = safeNamePart(filenameBase()).replace(/\s/g, '-')
      const prefix = flow === ''
        ? base
        : (base === '' || base === flow ? flow : flow + '_' + base)
      return (prefix === '' ? 'flow' : prefix) + '.flow.' + extension
    }

    function downloadDataUrl(dataUrl, filename) {
      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = filename
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      if (anchor.parentNode !== null) anchor.parentNode.removeChild(anchor)
    }

    function downloadText(text, filename) {
      const blob = new Blob([text], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      if (anchor.parentNode !== null) anchor.parentNode.removeChild(anchor)
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    }

    function roundRect(ctx, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2)
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.arcTo(x + w, y, x + w, y + h, radius)
      ctx.arcTo(x + w, y + h, x, y + h, radius)
      ctx.arcTo(x, y + h, x, y, radius)
      ctx.arcTo(x, y, x + w, y, radius)
      ctx.closePath()
    }

    function drawArrowHead(ctx, x, y, angle, size) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-size, size * 0.55)
      ctx.lineTo(-size, -size * 0.55)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('缩略图加载失败'))
        image.src = src
      })
    }

    function annotationNotes(ids) {
      if (!Array.isArray(ids) || ids.length === 0) return []
      return state.annotations
        .filter((annotation) => ids.includes(annotation.id))
        .map((annotation) => annotation.note)
        .filter((note) => typeof note === 'string' && note !== '')
    }

    /**
     * Compose the flow board: one card per recorded step, with an arrow and the
     * next action as its label. Rendered into a canvas so the PNG and the HTML
     * board show exactly the same thing.
     */
    const BOARD_FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Arial, sans-serif'

    function wrapLines(ctx, text, maxWidth) {
      const source = String(text ?? '').replace(/\s+/g, ' ').trim()
      if (source === '') return ['']
      const lines = []
      let current = ''
      for (const character of source) {
        const next = current + character
        if (ctx.measureText(next).width > maxWidth && current !== '') {
          lines.push(current)
          current = character
        } else {
          current = next
        }
      }
      if (current !== '') lines.push(current)
      return lines
    }

    function drawBadge(ctx, x, y, number, size, font, color) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, size / 2, 0, Math.PI * 2)
      ctx.fillStyle = color || '#E4572E'
      ctx.fill()
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(number), x, y + 0.5)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
    }

    /**
     * Compose the flow board: steps on the left, every note listed on the right,
     * and a red number stamped on each element that carries a note.
     */
    /** Shared geometry so the PNG (with notes) and the HTML (without) line up. */
    function boardGeometry(steps) {
      /* Wide (desktop) artboards need a wider card so text stays readable; tall
         phone artboards keep the familiar 320px screen card. */
      const ratio = (steps[0]?.height || 800) / (steps[0]?.width || 1280)
      const THUMB_W = ratio < 1 ? Math.round(Math.min(560, Math.max(320, 380 / ratio))) : 320
      const PAD = 64
      const GAP_X = 108
      const GAP_Y = 96
      const COLS = Math.min(3, Math.max(1, steps.length))
      const rows = Math.ceil(steps.length / COLS)
      const cardW = THUMB_W + 24
      const ratioHeights = steps.map((step) => Math.round(THUMB_W * ((step.height || 715) / (step.width || 384))))
      const thumbH = Math.max.apply(null, ratioHeights)
      const labelH = 70
      const cardH = thumbH + labelH
      const headerH = 140
      const flowW = COLS * cardW + (COLS - 1) * GAP_X
      const flowHeight = headerH + rows * cardH + (rows - 1) * GAP_Y + PAD
      const positions = steps.map((step, index) => {
        const row = Math.floor(index / COLS)
        const colInRow = index % COLS
        const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow
        return {
          x: PAD + col * (cardW + GAP_X),
          y: headerH + row * (cardH + GAP_Y),
          row,
        }
      })
      return { THUMB_W, PAD, GAP_X, GAP_Y, COLS, rows, cardW, thumbH, labelH, cardH, headerH, flowW, flowHeight, positions }
    }

    /**
     * Draw one board image. `withNotes` adds the static notes column on the
     * right (the PNG download); without it, the flow alone is exported and the
     * HTML drives the notes panel interactively.
     */
    async function composeBoard(steps, notes, withNotes, withBadges) {
      const geo = boardGeometry(steps)
      const NOTES_W = 344
      const NOTES_GAP = 64
      const images = await Promise.all(steps.map((step) => loadImage(step.thumb)))
      const noteById = new Map(notes.map((note) => [note.annotation.id, note]))
      const measure = document.createElement('canvas').getContext('2d')
      let notesHeight = geo.headerH + 48
      const measuredNotes = notes.map((note) => {
        measure.font = '400 12.5px ' + BOARD_FONT
        const lines = wrapLines(measure, note.annotation.note, NOTES_W - 76)
        const height = 34 + lines.length * 19 + 20
        notesHeight += height + 14
        return { ...note, lines, height }
      })
      if (withNotes) notesHeight += 24

      const width = geo.PAD + geo.flowW + (withNotes ? NOTES_GAP + NOTES_W : 0) + geo.PAD
      const height = Math.max(geo.flowHeight, withNotes ? notesHeight : 0)

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * 2)
      canvas.height = Math.round(height * 2)
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)

      ctx.fillStyle = '#F4F5FA'
      ctx.fillRect(0, 0, width, height)

      /* Header */
      ctx.fillStyle = '#5F46C9'
      roundRect(ctx, geo.PAD, 44, 8, 54, 4)
      ctx.fill()
      ctx.fillStyle = '#1A1A22'
      ctx.font = '700 30px ' + BOARD_FONT
      /* Keep the title inside the flow area so a short flow cannot overlap the notes column. */
      ctx.fillText(clipText(ctx, state.flowName || boardTitle(), Math.max(180, geo.flowW - 24)), geo.PAD + 24, 74)
      ctx.fillStyle = '#6E6E7A'
      ctx.font = '400 14px ' + BOARD_FONT
      const stamp = new Date().toLocaleString('zh-CN', { hour12: false })
      ctx.fillText('共 ' + steps.length + ' 步 · ' + notes.length + ' 条备注 · 生成于 ' + stamp, geo.PAD + 24, 100)

      const { positions, cardW, cardH, thumbH, flowW } = geo
      const THUMB_W = geo.THUMB_W

      /* Arrows first so the cards sit on top of their ends. */
      for (let index = 0; index < steps.length - 1; index += 1) {
        const from = positions[index]
        const to = positions[index + 1]
        const label = steps[index + 1].label || ''
        ctx.strokeStyle = '#8E86C9'
        ctx.fillStyle = '#8E86C9'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (from.row === to.row) {
          const startX = from.x + cardW
          const endX = to.x - 6
          const midY = from.y + cardH / 2
          ctx.moveTo(startX, midY)
          ctx.lineTo(endX, midY)
          ctx.stroke()
          drawArrowHead(ctx, endX, midY, 0, 9)
          if (label !== '') drawArrowChip(ctx, (startX + endX) / 2, midY - 16, label)
        } else {
          const centerX = from.x + cardW / 2
          const startY = from.y + cardH
          const endY = to.y - 8
          ctx.moveTo(centerX, startY)
          ctx.lineTo(centerX, endY)
          ctx.stroke()
          drawArrowHead(ctx, centerX, endY, Math.PI / 2, 9)
          if (label !== '') drawArrowChip(ctx, centerX + 14, (startY + endY) / 2, label, true)
        }
      }

      /* Cards + red numbers, collecting their coordinates for the HTML hotspots. */
      const hotspots = []
      const cards = []
      const triggers = []
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]
        const at = positions[index]
        ctx.save()
        ctx.shadowColor = 'rgba(16, 18, 32, 0.12)'
        ctx.shadowBlur = 18
        ctx.shadowOffsetY = 6
        ctx.fillStyle = '#FFFFFF'
        roundRect(ctx, at.x, at.y, cardW, cardH, 14)
        ctx.fill()
        ctx.restore()

        const thumbX = at.x + 12
        const thumbY = at.y + 12
        cards.push({
          step: index + 1,
          left: (at.x / width) * 100,
          top: (at.y / height) * 100,
          w: (cardW / width) * 100,
          h: (cardH / height) * 100,
        })
        if (step.trigger !== null && step.trigger !== undefined) {
          if (step.trigger.point === true) {
            const markerSize = 26
            const centerX = Math.min(thumbX + THUMB_W - markerSize / 2, Math.max(thumbX + markerSize / 2, thumbX + step.trigger.x * THUMB_W))
            const centerY = Math.min(thumbY + thumbH - markerSize / 2, Math.max(thumbY + markerSize / 2, thumbY + step.trigger.y * thumbH))
            triggers.push({
              step: index + 1,
              point: true,
              left: ((centerX - markerSize / 2) / width) * 100,
              top: ((centerY - markerSize / 2) / height) * 100,
              w: (markerSize / width) * 100,
              h: (markerSize / height) * 100,
            })
          } else {
            triggers.push({
              step: index + 1,
              point: false,
              left: ((thumbX + step.trigger.x * THUMB_W) / width) * 100,
              top: ((thumbY + step.trigger.y * thumbH) / height) * 100,
              w: ((step.trigger.w * THUMB_W) / width) * 100,
              h: ((step.trigger.h * thumbH) / height) * 100,
            })
          }
        }
        ctx.save()
        roundRect(ctx, thumbX, thumbY, THUMB_W, thumbH, 8)
        ctx.clip()
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(thumbX, thumbY, THUMB_W, thumbH)
        ctx.drawImage(images[index], thumbX, thumbY, THUMB_W, thumbH)

        const marks = Array.isArray(step.marks) ? step.marks : []
        let stacked = 0
        for (const mark of marks) {
          const note = noteById.get(mark.id)
          if (note === undefined) continue
          const markX = thumbX + Math.min(THUMB_W - 12, Math.max(12, mark.x * THUMB_W)) - stacked * 18
          const markY = thumbY + Math.min(thumbH - 12, Math.max(12, mark.y * thumbH))
          if (withBadges) drawBadge(ctx, markX, markY, note.number, 20, '700 10.5px ' + BOARD_FONT, '#5F46C9')
          hotspots.push({ number: note.number, step: index + 1, x: markX, y: markY })
          stacked = Math.min(stacked + 1, 4)
        }
        ctx.restore()

        /* Step number */
        ctx.beginPath()
        ctx.arc(at.x + 12 + 16, at.y + 12 + 16, 13, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(26, 26, 34, 0.72)'
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.font = '700 12px ' + BOARD_FONT
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(index + 1), at.x + 12 + 16, at.y + 12 + 17)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'

        ctx.fillStyle = '#1A1A22'
        ctx.font = '600 15px ' + BOARD_FONT
        const labelText = typeof step.label === 'string' && step.label !== '' ? step.label : '操作'
        ctx.fillText(clipText(ctx, labelText, cardW - 28), at.x + 14, at.y + thumbH + 34)
        ctx.fillStyle = '#8A8A96'
        ctx.font = '400 11.5px ' + BOARD_FONT
        ctx.fillText(clipText(ctx, String(step.page ?? ''), cardW - 28), at.x + 14, at.y + thumbH + 54)
      }

      /* Static notes column (PNG only). */
      if (withNotes) {
        const columnX = geo.PAD + flowW + NOTES_GAP
        ctx.fillStyle = '#1A1A22'
        ctx.font = '700 17px ' + BOARD_FONT
        ctx.fillText('备注 · ' + notes.length + ' 条', columnX, 74)
        ctx.fillStyle = '#8A8A96'
        ctx.font = '400 11.5px ' + BOARD_FONT
        ctx.fillText('红色编号对应流程图上的位置', columnX, 96)

        let cursorY = geo.headerH
        for (const note of measuredNotes) {
          ctx.save()
          ctx.shadowColor = 'rgba(16, 18, 32, 0.08)'
          ctx.shadowBlur = 14
          ctx.shadowOffsetY = 4
          ctx.fillStyle = '#FFFFFF'
          roundRect(ctx, columnX, cursorY, NOTES_W, note.height, 12)
          ctx.fill()
          ctx.restore()

          drawBadge(ctx, columnX + 24, cursorY + 24, note.number, 22, '700 11px ' + BOARD_FONT, '#5F46C9')

          ctx.fillStyle = '#1A1A22'
          ctx.font = '400 12.5px ' + BOARD_FONT
          let lineY = cursorY + 30
          for (const line of note.lines) {
            ctx.fillText(line, columnX + 46, lineY)
            lineY += 19
          }
          const meta = (note.steps.length > 0 ? '第 ' + note.steps.join('、') + ' 步' : '未出现在录制步骤')
            + (note.annotation.page ? ' · ' + note.annotation.page : '')
          ctx.fillStyle = '#9AA0AC'
          ctx.font = '400 11px ' + BOARD_FONT
          ctx.fillText(clipText(ctx, meta, NOTES_W - 46), columnX + 46, lineY + 8)
          cursorY += note.height + 14
        }
      }

      return { dataUrl: canvas.toDataURL('image/png'), width, height, hotspots, cards, triggers }
    }

    async function buildBoard(steps) {
      const notes = state.annotations.map((annotation, index) => ({
        annotation,
        number: index + 1,
        steps: [],
      }))
      const noteById = new Map(notes.map((note) => [note.annotation.id, note]))
      steps.forEach((step, stepIndex) => {
        const ids = Array.isArray(step.annotations) ? step.annotations : []
        for (const id of ids) {
          const note = noteById.get(id)
          if (note !== undefined && !note.steps.includes(stepIndex + 1)) note.steps.push(stepIndex + 1)
        }
      })

      /* Two renders from the same geometry: the PNG keeps the static notes
         column, while the HTML page drives the notes panel on hover. */
      const staticBoard = await composeBoard(steps, notes, true, true)
      const flowOnly = await composeBoard(steps, notes, false, false)

      return {
        png: staticBoard.dataUrl,
        width: staticBoard.width,
        height: staticBoard.height,
        flowPng: flowOnly.dataUrl,
        flowWidth: flowOnly.width,
        flowHeight: flowOnly.height,
        cards: flowOnly.cards,
        triggers: flowOnly.triggers,
        hotspots: flowOnly.hotspots.map((spot) => ({
          ...spot,
          flowLeft: (spot.x / flowOnly.width) * 100,
          flowTop: (spot.y / flowOnly.height) * 100,
          panelLeft: (spot.x / staticBoard.width) * 100,
          panelTop: (spot.y / staticBoard.height) * 100,
        })),
        notes,
        steps,
        title: state.flowName || boardTitle(),
        createdAt: new Date().toISOString(),
      }
    }

    function clipText(ctx, text, maxWidth) {
      let value = String(text)
      if (ctx.measureText(value).width <= maxWidth) return value
      while (value.length > 1 && ctx.measureText(value + '…').width > maxWidth) value = value.slice(0, -1)
      return value + '…'
    }

    function drawArrowChip(ctx, x, y, text, alignLeft) {
      ctx.save()
      ctx.font = '500 11.5px -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Arial, sans-serif'
      const shown = clipText(ctx, text, alignLeft === true ? 150 : 92)
      const width = ctx.measureText(shown).width + 16
      const left = alignLeft === true ? x : x - width / 2
      ctx.fillStyle = '#FFFFFF'
      ctx.strokeStyle = '#DCD8F0'
      ctx.lineWidth = 1
      roundRect(ctx, left, y - 12, width, 24, 12)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#4A4460'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(shown, left + 8, y)
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
    }

    /* -------------------------------------------------------------- recording */

    function startRecording() {
      if (state.file === '') return
      if (state.mode) setMode(false)
      state.recording = true
      state.recordBusy = true
      state.steps = []
      state.board = null
      state.view = 'preview'
      state.draft = null
      state.picker = false
      store.publish()
      toFrame({ type: 'recordStart' })
    }

    function clearRecordTimers() {
      if (recordStopTimer !== null) {
        window.clearTimeout(recordStopTimer)
        recordStopTimer = null
      }
      if (recordBusyTimer !== null) {
        window.clearTimeout(recordBusyTimer)
        recordBusyTimer = null
      }
    }

    /** Single exit for a take: from the bridge, or from the local watchdog. */
    function finishRecording(steps) {
      clearRecordTimers()
      state.recording = false
      state.recordBusy = false
      state.stopping = false
      state.steps = steps
      if (steps.length === 0) {
        state.board = null
        state.view = 'preview'
        store.publish()
        toast(t('recordEmpty'))
        return
      }
      state.board = null
      state.view = 'preview'
      state.flowName = (state.pageTitle !== '' ? state.pageTitle : filenameBase()) + ' · 交互流程'
      store.publish()
      void buildBoard(steps).then((board) => {
        state.board = board
        state.view = 'board'
        state.boardHover = 0
        store.publish()
      }).catch((error) => {
        toast(t('recordFailed') + ': ' + String(error?.message ?? error))
      })
    }

    /**
     * Stop is always available: it must never wait for an in-flight capture.
     * If the bridge does not answer in time, the panel finishes the board with
     * the steps it already has.
     */
    function stopRecording() {
      if (!state.recording || state.stopping) return
      state.stopping = true
      state.recordBusy = true
      store.publish()
      toFrame({ type: 'recordStop' })
      /* Snapshot rasterization continues after stop; give it room, then fall
         back to whatever has already been produced. */
      recordStopTimer = window.setTimeout(() => {
        recordStopTimer = null
        if (state.stopping) finishRecording(state.steps)
      }, 25000)
    }

    function cancelRecording() {
      clearRecordTimers()
      state.recording = false
      state.recordBusy = false
      state.stopping = false
      state.steps = []
      store.publish()
      toFrame({ type: 'recordCancel' })
    }

    function openStepPrompt() {
      state.stepPrompt = { value: '' }
      store.publish()
    }

    function confirmStepPrompt() {
      const prompt = state.stepPrompt
      if (prompt === null) return
      const label = String(prompt.value ?? '').trim()
      if (label === '') return
      state.stepPrompt = null
      store.publish()
      toFrame({ type: 'recordStepManual', label })
    }

    /** Save the prototype plus its annotations as one reopenable local file. */
    async function saveSource() {
      if (state.file === '' || state.savingSource) return
      state.savingSource = true
      store.publish()
      try {
        const result = await api('/save-as?path=' + encodeURIComponent(state.file))
        state.savingSource = false
        store.publish()
        if (result !== null && result.canceled === true) {
          toast(t('saveCanceled'))
          return
        }
        if (result !== null && typeof result.path === 'string' && result.path !== '') {
          toast(t('savedTo') + ' ' + result.path)
        }
      } catch (error) {
        state.savingSource = false
        store.publish()
        const message = String(error?.message ?? error)
        /* A Host that predates this feature answers "未知接口": fall back to the
           attachment download so saving still works before the next restart. */
        if (/未知接口|unknown route|404/i.test(message)) {
          const anchor = document.createElement('a')
          anchor.href = API + '/export?path=' + encodeURIComponent(state.file)
          anchor.download = ''
          anchor.style.display = 'none'
          document.body.appendChild(anchor)
          anchor.click()
          if (anchor.parentNode !== null) anchor.parentNode.removeChild(anchor)
          toast(t('saveFallback'))
          return
        }
        toast(t('saveFailed') + ': ' + message)
      }
    }

    function downloadBoardPng() {
      if (state.board === null) return
      downloadDataUrl(state.board.png, boardFileName('png'))
      toast(t('boardExported'))
    }

    function downloadBoardHtml() {
      if (state.board === null) return
      const board = state.board
      const notes = Array.isArray(board.notes) ? board.notes : []
      const title = state.flowName || board.title
      const width = board.flowWidth || board.width || 1
      const height = board.flowHeight || board.height || 1
      const hotspots = (Array.isArray(board.hotspots) ? board.hotspots : []).map((spot) => {
        const left = Math.min(100, Math.max(0, (spot.x / width) * 100))
        const top = Math.min(100, Math.max(0, (spot.y / height) * 100))
        return '<button type="button" class="hs" data-n="' + spot.number + '"'
          + ' style="left:' + left.toFixed(3) + '%;top:' + top.toFixed(3) + '%"'
          + ' aria-label="备注 ' + spot.number + '">' + spot.number + '</button>'
      }).join('')
      const cards = Array.isArray(board.cards) ? board.cards : []
      const triggers = Array.isArray(board.triggers) ? board.triggers : []
      const stepHotspots = cards.map((card) => '<button type="button" class="step-hotspot" data-step="' + card.step + '"'
        + ' style="left:' + card.left.toFixed(3) + '%;top:' + card.top.toFixed(3) + '%'
        + ';width:' + card.w.toFixed(3) + '%;height:' + card.h.toFixed(3) + '%"'
        + ' aria-label="第 ' + card.step + ' 步"></button>').join('')
      const triggerMarks = triggers.map((mark) => '<div class="trigger-mark" data-step="' + mark.step + '"'
        + ' style="left:' + mark.left.toFixed(3) + '%;top:' + mark.top.toFixed(3) + '%'
        + ';width:' + mark.w.toFixed(3) + '%;height:' + mark.h.toFixed(3) + '%"></div>').join('')
      const noteItems = notes.map((note) => {
        const meta = (note.steps.length > 0 ? '第 ' + note.steps.join('、') + ' 步' : '未出现在录制步骤')
          + (note.annotation.page ? ' · ' + escapeXml(note.annotation.page) : '')
        return '<article class="note" data-n="' + note.number + '" tabindex="0">'
          + '<span class="no">' + note.number + '</span>'
          + '<div class="note-body"><p>' + escapeXml(note.annotation.note) + '</p>'
          + '<span class="note-meta">' + meta + '</span></div>'
          + '</article>'
      }).join('')

      const html = '<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>' + escapeXml(title) + '</title><style>'
        + 'html,body{margin:0;min-height:100%}'
        + 'body{background:#F4F5FA;color:#1A1A22;font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",Arial,sans-serif}'
        + '.app{display:flex;align-items:flex-start;min-height:100vh}'
        + '.stage{flex:1 1 auto;min-width:0;padding:32px}'
        + '.board{position:relative;display:inline-block;max-width:100%;background:#fff;border-radius:12px;'
        + 'box-shadow:0 10px 30px rgba(16,18,32,.12);overflow:hidden}'
        + '.board img{display:block;width:100%;height:auto}'
        + '.step-hotspot{position:absolute;padding:0;border:0;background:transparent;border-radius:12px;cursor:default;'
        + 'box-shadow:inset 0 0 0 0 rgba(228,87,46,0);transition:box-shadow .15s ease}'
        + '.step-hotspot:hover{box-shadow:inset 0 0 0 2px rgba(228,87,46,.45)}'
        + '.trigger-mark{position:absolute;display:none;border:2px solid #E4572E;border-radius:4px;box-sizing:border-box;'
        + 'pointer-events:none;box-shadow:0 0 0 4px rgba(228,87,46,.25);animation:trigger-blink .9s ease-in-out infinite}'
        + '.trigger-mark.on{display:block}'
        + '.trigger-mark[data-point="1"]::after{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;'
        + 'margin:-3px 0 0 -3px;border-radius:50%;background:#E4572E}'
        + '@keyframes trigger-blink{0%,100%{opacity:1}50%{opacity:.12}}'
        + '.hs{position:absolute;transform:translate(-50%,-50%);width:24px;height:24px;padding:0;'
        + 'border-radius:50%;border:2px solid #fff;background:#5F46C9;color:#fff;cursor:pointer;'
        + 'font:700 11px/1 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",Arial,sans-serif;'
        + 'display:flex;align-items:center;justify-content:center;'
        + 'box-shadow:0 2px 6px rgba(0,0,0,.25);'
        + 'transition:background .12s ease,transform .12s ease;outline:none}'
        + '.hs:hover,.hs:focus-visible,.hs.on{background:#E4572E;transform:translate(-50%,-50%) scale(1.1)}'
        + '.hs.dim{opacity:.4}'
        + '.side{flex:0 0 340px;position:sticky;top:0;align-self:flex-start;max-height:100vh;overflow:auto;'
        + 'background:#fff;border-left:1px solid #E7E7EF;padding:20px 18px;box-sizing:border-box}'
        + '.side-head{font-weight:700;font-size:14px;margin-bottom:12px}'
        + '.note{display:flex;gap:10px;border:1px solid #EEE;border-radius:10px;padding:10px;margin-bottom:8px;'
        + 'cursor:pointer;transition:border-color .12s ease,box-shadow .12s ease}'
        + '.note:hover{border-color:#D8D8E2}'
        + '.note.on{border-color:#E4572E;box-shadow:0 0 0 1px rgba(228,87,46,.35)}'
        + '.no{flex:none;width:22px;height:22px;border-radius:50%;background:#5F46C9;color:#fff;'
        + 'font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;'
        + 'transition:background .12s ease}'
        + '.note:hover .no,.note.on .no{background:#E4572E}'
        + '.note-body p{margin:0;white-space:pre-wrap}'
        + '.note-meta{display:block;margin-top:4px;color:#9AA0AC;font-size:11px}'
        + '.hint{color:#9AA0AC;font-size:11.5px;margin:10px 0 0}'
        + '@media (max-width:900px){.app{display:block}.side{position:static;max-height:none;border-left:0;'
        + 'border-top:1px solid #E7E7EF}}'
        + '</style></head><body><div class="app">'
        + '<main class="stage">'
        + '<div class="board"><img alt="flow board" src="' + board.flowPng + '">'
        + stepHotspots + triggerMarks + hotspots + '</div>'
        + '</main>'
        + '<aside class="side"><div class="side-head">备注 · ' + notes.length + ' 条</div>'
        + noteItems
        + '<p class="hint">把鼠标移到流程图上的红色数字，右侧会高亮对应备注；点备注可定位到图上位置。</p>'
        + '</aside></div>'
        + '<script>(function(){'
        + 'var marks=Array.prototype.slice.call(document.querySelectorAll(".hs"));'
        + 'var notes=Array.prototype.slice.call(document.querySelectorAll(".note"));'
        + 'function activate(n){'
        + 'notes.forEach(function(el){el.classList.toggle("on",n!==null&&el.getAttribute("data-n")===n)});'
        + 'marks.forEach(function(el){var active=n!==null&&el.getAttribute("data-n")===n;'
        + 'el.classList.toggle("on",active);el.classList.toggle("dim",n!==null&&!active)});'
        + 'if(n===null)return;'
        + 'var target=notes.filter(function(el){return el.getAttribute("data-n")===n})[0];'
        + 'if(target&&target.scrollIntoView){target.scrollIntoView({block:"nearest",behavior:"smooth"})}'
        + '}'
        + 'var stepZones=Array.prototype.slice.call(document.querySelectorAll(".step-hotspot"));'
        + 'var triggerMarks=Array.prototype.slice.call(document.querySelectorAll(".trigger-mark"));'
        + 'function showTrigger(step){'
        + 'triggerMarks.forEach(function(el){el.classList.toggle("on",el.getAttribute("data-step")===step)})'
        + '}'
        + 'stepZones.forEach(function(zone){'
        + 'zone.addEventListener("mouseenter",function(){showTrigger(zone.getAttribute("data-step"))});'
        + 'zone.addEventListener("mouseleave",function(){showTrigger(null)})'
        + '});'
        + 'marks.forEach(function(el){'
        + '["mouseenter","focus","click"].forEach(function(evt){el.addEventListener(evt,function(){activate(el.getAttribute("data-n"))})});'
        + 'el.addEventListener("mouseleave",function(){activate(null)});'
        + 'el.addEventListener("blur",function(){activate(null)})'
        + '});'
        + 'notes.forEach(function(el){'
        + 'el.addEventListener("mouseenter",function(){activate(el.getAttribute("data-n"))});'
        + 'el.addEventListener("mouseleave",function(){activate(null)});'
        + 'el.addEventListener("click",function(){'
        + 'var n=el.getAttribute("data-n");'
        + 'var mark=marks.filter(function(h){return h.getAttribute("data-n")===n})[0];'
        + 'if(mark&&mark.scrollIntoView){mark.scrollIntoView({block:"center",behavior:"smooth"})}'
        + 'activate(n)})'
        + '});'
        + '})();<\/script></body></html>'

      downloadText(html, boardFileName('html'))
      toast(t('boardExported'))
    }

    /* ----------------------------------------------------------------- styles */

    function injectStyles() {
      if (document.getElementById(STYLE_ID) !== null) return () => {}
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
        .annot-page {
          position: relative; height: 100%; width: 100%;
          display: flex; flex-direction: column;
          background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
          font-size: 13px; line-height: 1.45; overflow: hidden;
        }
        .annot-page, .annot-page * { box-sizing: border-box; }
        .annot-top {
          flex: none; display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
          background: var(--dsw-alias-bg-layer-1);
        }
        .annot-grow { flex: 1 1 auto; min-width: 0; }
        .annot-title { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .annot-file {
          font-size: 11px; color: var(--dsw-alias-label-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46vw;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .annot-btn {
          appearance: none; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
          color: var(--dsw-alias-label-primary); border-radius: 7px; padding: 5px 10px;
          font-size: 12px; cursor: pointer; white-space: nowrap; font-family: inherit;
          transition: background .12s ease, border-color .12s ease;
        }
        .annot-btn:hover { border-color: var(--dsw-alias-border-l2); }
        .annot-btn[disabled] { opacity: .5; cursor: default; }
        .annot-btn--primary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; }
        .annot-btn--primary:hover { filter: brightness(1.06); }
        .annot-btn--danger { color: var(--dsw-alias-state-error-primary); }
        .annot-btn--ghost { background: transparent; }
        .annot-btn--sm { padding: 3px 7px; font-size: 11px; border-radius: 6px; }
        .annot-btn--with-icon { display: inline-flex; align-items: center; gap: 6px; }
        .annot-toggle {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px 5px 8px;
          border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; cursor: pointer;
          background: var(--dsw-alias-bg-layer-2); font-size: 12px; user-select: none;
        }
        .annot-toggle[data-on="1"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
        .annot-toggle-dot {
          width: 24px; height: 14px; border-radius: 999px; background: var(--dsw-alias-border-l2);
          position: relative; transition: background .15s ease; flex: none;
        }
        .annot-toggle-dot::after {
          content: ''; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
          border-radius: 50%; background: #fff; transition: transform .15s ease;
        }
        .annot-toggle[data-on="1"] .annot-toggle-dot { background: var(--dsw-alias-brand-primary); }
        .annot-toggle[data-on="1"] .annot-toggle-dot::after { transform: translateX(10px); }
        .annot-body { flex: 1 1 auto; display: flex; min-height: 0; }
        .annot-canvas {
          flex: 1 1 auto; min-width: 0; position: relative; display: flex; align-items: center; justify-content: center;
          background: var(--dsw-alias-bg-layer-2); overflow: hidden;
          background-image: radial-gradient(circle at 1px 1px, var(--dsw-alias-border-l1) 1px, transparent 0);
          background-size: 16px 16px;
        }
        .annot-stage { position: relative; box-shadow: 0 10px 34px rgba(0,0,0,.18); border-radius: 10px; background: #fff; overflow: hidden; }
        .annot-frame { position: absolute; top: 0; left: 0; border: 0; transform-origin: top left; background: #fff; }
        .annot-side {
          flex: none; width: 316px; border-left: 1px solid var(--dsw-alias-border-l1);
          background: var(--dsw-alias-bg-layer-1); display: flex; flex-direction: column; min-height: 0;
        }
        .annot-side-head {
          flex: none; display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1);
        }
        .annot-side-title { font-weight: 600; font-size: 12px; letter-spacing: .02em; }
        .annot-list { flex: 1 1 auto; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
        .annot-group-label {
          font-size: 10px; letter-spacing: .04em; color: var(--dsw-alias-label-secondary);
          padding: 4px 4px 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .annot-item {
          border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; padding: 8px 9px;
          background: var(--dsw-alias-bg-base); cursor: pointer; display: flex; gap: 8px; align-items: flex-start;
          transition: border-color .12s ease, box-shadow .12s ease;
        }
        .annot-item:hover { border-color: var(--dsw-alias-border-l2); }
        .annot-item[data-active="1"] { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
        .annot-item[data-hover="1"] .annot-num { background: var(--dsw-alias-brand-primary); color: #fff; }
        .annot-item[data-resolved="1"] { opacity: .6; }
        .annot-num {
          flex: none; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; background: var(--dsw-alias-bg-layer-2);
          color: var(--dsw-alias-label-secondary); border: 1px solid var(--dsw-alias-border-l1);
        }
        .annot-item-body { flex: 1 1 auto; min-width: 0; }
        .annot-sel {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px;
          color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .annot-note { font-size: 12px; margin-top: 3px; word-break: break-word; white-space: pre-wrap; }
        .annot-meta { margin-top: 5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .annot-chip {
          font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
          color: var(--dsw-alias-label-secondary);
        }
        .annot-chip--warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
        .annot-chip--ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
        .annot-item-actions { display: flex; gap: 4px; margin-top: 6px; opacity: 0; transition: opacity .12s ease; }
        .annot-item:hover .annot-item-actions, .annot-item[data-active="1"] .annot-item-actions { opacity: 1; }
        .annot-empty {
          flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; padding: 24px; text-align: center; color: var(--dsw-alias-label-secondary);
        }
        .annot-empty-title { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
        .annot-empty-hint { font-size: 11.5px; max-width: 260px; }
        .annot-draft {
          border: 1px solid var(--dsw-alias-brand-primary); border-radius: 9px; padding: 9px; margin: 8px;
          background: var(--dsw-alias-bg-base); display: flex; flex-direction: column; gap: 7px;
        }
        .annot-draft-head { font-size: 10.5px; color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .annot-textarea {
          width: 100%; min-height: 76px; resize: vertical; font-family: inherit; font-size: 12px; line-height: 1.45;
          padding: 7px 8px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1);
          background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); outline: none;
        }
        .annot-textarea:focus { border-color: var(--dsw-alias-brand-primary); }
        .annot-row { display: flex; gap: 6px; justify-content: flex-end; }
        .annot-modal-mask {
          position: absolute; inset: 0; background: rgba(0,0,0,.32); display: flex; align-items: center; justify-content: center; z-index: 20;
        }
        .annot-modal {
          width: min(560px, 88%); max-height: 82%; display: flex; flex-direction: column;
          background: var(--dsw-alias-bg-overlay); border-radius: 12px; border: 1px solid var(--dsw-alias-border-l1);
          box-shadow: 0 20px 60px rgba(0,0,0,.3); overflow: hidden;
        }
        .annot-modal-head { padding: 12px 14px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
        .annot-modal-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
        .annot-field { display: flex; flex-direction: column; gap: 5px; }
        .annot-field-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
        .annot-input {
          font-family: inherit; font-size: 12px; padding: 7px 9px; border-radius: 7px;
          border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
          color: var(--dsw-alias-label-primary); outline: none;
        }
        .annot-input:focus { border-color: var(--dsw-alias-brand-primary); }
        .annot-files { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
        .annot-file-row {
          display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px; cursor: pointer;
          border: 1px solid transparent; text-align: left; background: transparent; color: inherit; font-family: inherit;
        }
        .annot-file-row:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l1); }
        .annot-file-name { font-size: 12px; }
        .annot-file-path { font-size: 10px; color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .annot-modal-foot { padding: 10px 14px; border-top: 1px solid var(--dsw-alias-border-l1); display: flex; gap: 8px; justify-content: flex-end; }
        .annot-error {
          margin: 8px 12px; padding: 8px 10px; border-radius: 8px; font-size: 11.5px;
          background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
          color: var(--dsw-alias-state-error-primary); border: 1px solid var(--dsw-alias-state-error-primary);
        }
        .annot-toast {
          position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
          background: #2B2B33; color: #fff; padding: 7px 14px; border-radius: 999px; font-size: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,.28); z-index: 30; max-width: 80%; text-align: center;
        }
        .annot-hint { font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
        .annot-row-side { flex: none; padding: 8px 12px; border-top: 1px solid var(--dsw-alias-border-l1); display: flex; gap: 8px; align-items: center; justify-content: space-between; }
        .annot-board {
          flex: 1 1 auto; min-height: 0; overflow: auto; position: relative;
          background: var(--dsw-alias-bg-layer-2); padding: 20px 20px 56px;
        }
        .annot-board-name {
          width: 240px; max-width: 30vw; font-family: inherit; font-size: 13px; font-weight: 600;
          padding: 5px 10px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l1);
          background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); outline: none;
        }
        .annot-board-name:focus { border-color: var(--dsw-alias-brand-primary); }
        .annot-board { text-align: center; }
        .annot-board--split { display: flex; align-items: stretch; padding: 0; text-align: left; }
        .annot-board-stage { flex: 1 1 auto; min-width: 0; overflow: auto; position: relative; padding: 20px 20px 56px; }
        .annot-board-notes {
          flex: 0 0 320px; border-left: 1px solid var(--dsw-alias-border-l1);
          background: var(--dsw-alias-bg-layer-1); overflow-y: auto;
          padding: 14px 12px 20px; display: flex; flex-direction: column; gap: 8px;
        }
        .annot-notes-head { font-weight: 600; font-size: 12px; padding: 0 2px 4px; }
        .annot-notes-empty { font-size: 11.5px; color: var(--dsw-alias-label-secondary); padding: 6px 2px; }
        .annot-note-card {
          display: flex; gap: 8px; align-items: flex-start;
          border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;
          background: var(--dsw-alias-bg-base); padding: 9px;
          cursor: default; transition: border-color .12s ease, box-shadow .12s ease;
        }
        .annot-note-card[data-active="1"] {
          border-color: #E4572E; box-shadow: 0 0 0 1px rgba(228,87,46,.35);
        }
        .annot-note-no {
          flex: none; width: 20px; height: 20px; border-radius: 50%;
          background: #5F46C9; color: #fff; font-size: 10.5px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          transition: background .12s ease;
        }
        .annot-note-card[data-active="1"] .annot-note-no { background: #E4572E; }
        .annot-note-body { min-width: 0; }
        .annot-note-body p { margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
        .annot-note-meta {
          display: block; margin-top: 4px; font-size: 10.5px;
          color: var(--dsw-alias-label-secondary);
        }
        .annot-board-canvas { position: relative; display: inline-block; max-width: 100%; }
        .annot-board-img {
          display: block; max-width: 100%; height: auto;
          border-radius: 10px; box-shadow: 0 12px 36px rgba(16,18,32,.16); background: #F4F5FA;
        }
        .annot-hotspot {
          position: absolute; transform: translate(-50%, -50%);
          width: 22px; height: 22px; padding: 0; border-radius: 50%;
          background: #5F46C9; color: #fff; border: 1.5px solid #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,.25); cursor: pointer;
          font: 700 11px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Arial, sans-serif;
          display: flex; align-items: center; justify-content: center;
          transition: background .12s ease, transform .12s ease, opacity .12s ease;
        }
        .annot-hotspot[data-dim="1"] { opacity: .4; }
        .annot-hotspot:hover, .annot-hotspot:focus-visible,
        .annot-hotspot[data-active="1"] {
          background: #E4572E; transform: translate(-50%, -50%) scale(1.1);
        }
        .annot-step-hotspot {
          position: absolute; padding: 0; border: 0; background: transparent;
          border-radius: 12px; cursor: default;
          box-shadow: inset 0 0 0 0 rgba(228,87,46,0);
          transition: box-shadow .15s ease;
        }
        .annot-step-hotspot:hover {
          box-shadow: inset 0 0 0 2px rgba(228,87,46,.45);
        }
        .annot-trigger {
          position: absolute; border: 2px solid #E4572E; border-radius: 4px;
          pointer-events: none; box-sizing: border-box;
          box-shadow: 0 0 0 4px rgba(228,87,46,.25);
          animation: annot-blink .9s ease-in-out infinite;
        }
        .annot-trigger[data-point="1"]::after, .trigger-mark[data-point="1"]::after {
          content: ''; position: absolute; left: 50%; top: 50%;
          width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%;
          background: #E4572E;
        }
        @keyframes annot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: .12; }
        }
        .annot-board-bar {
          position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 16px;
          pointer-events: none;
          background: var(--dsw-alias-bg-layer-1); border-top: 1px solid var(--dsw-alias-border-l1);
          font-size: 11px; color: var(--dsw-alias-label-secondary);
        }
        .annot-rec-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px;
          border-radius: 999px; background: rgba(228,87,46,.10); color: #E4572E;
          border: 1px solid rgba(228,87,46,.45); font-size: 12px; white-space: nowrap;
        }
        .annot-rec-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #E4572E; flex: none;
          animation: annot-pulse 1.4s ease-in-out infinite;
        }
        @keyframes annot-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.82); } }
        .annot-rec-busy { color: #8A5A4A; font-size: 11px; }
        .annot-page[data-recording="1"] .annot-canvas { box-shadow: inset 0 0 0 2px rgba(228,87,46,.55); }
      `
      document.head.appendChild(style)
      return () => {
        if (style.parentNode !== null) style.parentNode.removeChild(style)
      }
    }

    /* --------------------------------------------------------------- components */

    function Glyph({ size }) {
      const px = size === undefined ? 18 : Math.max(12, Math.min(20, size))
      return h('svg', {
        viewBox: '0 0 20 20', width: px, height: px, 'aria-hidden': true, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
        h('rect', { x: 2.5, y: 3, width: 15, height: 11, rx: 2.5 }),
        h('path', { d: 'M6 6.6h8M6 9.6h5' }),
        h('path', { d: 'M15 12.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z', fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M15 13.6v2.1M15 16.9v.2', stroke: '#fff', strokeWidth: 1.1 })
      )
    }

    function SidebarGlyph({ size }) {
      return h('span', { style: { display: 'inline-flex', alignItems: 'center' } }, h(Glyph, { size }))
    }

    function Toggle() {
      return h('button', {
        type: 'button',
        className: 'annot-toggle',
        'data-on': state.mode ? '1' : '0',
        title: t('annotateHint'),
        onClick: () => setMode(!state.mode),
      },
        h('span', { className: 'annot-toggle-dot' }),
        h('span', null, t('annotateMode')))
    }

    function Picker() {
      if (!state.picker) return null
      const close = () => {
        state.picker = false
        store.publish()
      }
      const choose = (file) => {
        state.picker = false
        store.publish()
        void openFile(file, { fromPicker: true })
      }

      const nativeRow = h('div', { className: 'annot-field', key: 'native' },
        h('button', {
          type: 'button',
          className: 'annot-btn annot-btn--primary',
          disabled: state.picking,
          onClick: () => void pickNativeFile(),
        }, state.picking ? t('picking') : t('chooseLocal')),
        h('span', { className: 'annot-hint' }, t('chooseLocalHint')))

      const pathField = h('div', { className: 'annot-field', key: 'path' },
        h('span', { className: 'annot-field-label' }, t('pathLabel')),
        h('input', {
          className: 'annot-input',
          value: state.pickerPath,
          placeholder: t('pathPlaceholder'),
          spellCheck: false,
          onChange: (event) => {
            state.pickerPath = event.target.value
            store.publish()
          },
          onKeyDown: (event) => {
            if (event.key === 'Enter') choose(state.pickerPath)
          },
        }))

      const scanField = h('div', { className: 'annot-field', key: 'scan' },
        h('span', { className: 'annot-field-label' }, t('scanLabel')),
        h('div', { style: { display: 'flex', gap: 6 } },
          h('input', {
            className: 'annot-input',
            style: { flex: '1 1 auto' },
            value: state.pickerDir,
            placeholder: t('scanPlaceholder'),
            spellCheck: false,
            onChange: (event) => {
              state.pickerDir = event.target.value
              store.publish()
            },
            onKeyDown: (event) => {
              if (event.key === 'Enter') void scanDirectory(state.pickerDir)
            },
          }),
          h('button', {
            type: 'button',
            className: 'annot-btn',
            disabled: state.pickerBusy,
            onClick: () => void scanDirectory(state.pickerDir),
          }, state.pickerBusy ? t('scanning') : t('scan'))))

      const errorBox = state.pickerError === ''
        ? null
        : h('div', { className: 'annot-error', style: { margin: 0 }, key: 'err' }, state.pickerError)

      const fileList = state.pickerFiles.length === 0
        ? null
        : h('div', { className: 'annot-files', key: 'files' }, state.pickerFiles.map((file) => h('button', {
          key: file.path,
          type: 'button',
          className: 'annot-file-row',
          onClick: () => choose(file.path),
        },
          h('span', { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
            h('span', { className: 'annot-file-name' }, file.name),
            h('span', { className: 'annot-file-path' }, file.path)))))

      const recentList = state.recents.length === 0
        ? null
        : h('div', { className: 'annot-field', key: 'recent' },
          h('span', { className: 'annot-field-label' }, t('recent')),
          h('div', { className: 'annot-files' }, state.recents.map((file) => h('button', {
            key: file,
            type: 'button',
            className: 'annot-file-row',
            onClick: () => choose(file),
          }, h('span', { className: 'annot-file-path', style: { fontSize: 11 } }, file)))))

      const foot = h('div', { className: 'annot-modal-foot' },
        h('button', { type: 'button', className: 'annot-btn', onClick: close }, t('cancel')),
        h('button', {
          type: 'button',
          className: 'annot-btn annot-btn--primary',
          disabled: state.pickerPath.trim() === '',
          onClick: () => choose(state.pickerPath),
        }, t('confirm')))

      const modal = h('div', { className: 'annot-modal', role: 'dialog', 'aria-label': t('openTitle') },
        h('div', { className: 'annot-modal-head' }, t('openTitle')),
        h('div', { className: 'annot-modal-body' }, nativeRow, pathField, scanField, errorBox, fileList, recentList),
        foot)

      return h('div', {
        className: 'annot-modal-mask',
        onClick: (event) => {
          if (event.target === event.currentTarget) close()
        },
      }, modal)
    }

    function EmptyState() {
      return h('div', { className: 'annot-empty' },
        h('div', null, h(Glyph, { size: 34 })),
        h('div', { className: 'annot-empty-title' }, t('noFileTitle')),
        h('div', { className: 'annot-empty-hint' }, t('chooseLocalHint')),
        h('button', {
          type: 'button',
          className: 'annot-btn annot-btn--primary',
          style: { marginTop: 4 },
          disabled: state.picking,
          onClick: () => void pickNativeFile(),
        }, state.picking ? t('picking') : t('chooseLocal')),
        h('button', {
          type: 'button',
          className: 'annot-btn annot-btn--ghost annot-btn--sm',
          style: { marginTop: 2 },
          onClick: openPicker,
        }, t('manualPath')))
    }

    function DraftCard() {
      const draft = state.draft
      if (draft === null) return null
      const snapshot = draft.snapshot ?? {}
      const text = typeof snapshot.text === 'string' && snapshot.text !== '' ? snapshot.text : ''
      return h('div', { className: 'annot-draft' },
        h('div', { className: 'annot-draft-head' }, t('picked') + ' · ' + draft.selector),
        h('div', { className: 'annot-hint' }, t('lockedHint')),
        text !== '' ? h('div', { className: 'annot-hint' }, '「' + text + '」') : null,
        h('textarea', {
          className: 'annot-textarea',
          autoFocus: true,
          placeholder: t('notePlaceholder'),
          value: state.draftNote,
          onChange: (event) => {
            state.draftNote = event.target.value
            store.publish()
          },
          onKeyDown: (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void saveDraft()
            }
            if (event.key === 'Escape') {
              state.draft = null
              state.draftNote = ''
              store.publish()
            }
          },
        }),
        h('div', { className: 'annot-row' },
          h('button', {
            type: 'button', className: 'annot-btn annot-btn--sm', onClick: () => {
              state.draft = null
              state.draftNote = ''
              store.publish()
              toFrame({ type: 'lockClear' })
            },
          }, t('discard')),
          h('button', {
            type: 'button', className: 'annot-btn annot-btn--sm annot-btn--primary',
            disabled: state.saving, onClick: () => void saveDraft(),
          }, state.saving ? t('saving') : t('save'))))
    }

    function AnnotationItem({ annotation, index }) {
      const active = state.activeId === annotation.id
      const hover = state.hoverId === annotation.id
      const pending = state.pendingDelete === annotation.id
      return h('div', {
        className: 'annot-item',
        'data-active': active ? '1' : '0',
        'data-hover': hover ? '1' : '0',
        'data-resolved': annotation.status === 'resolved' ? '1' : '0',
        onClick: () => {
          state.activeId = annotation.id
          state.pendingDelete = ''
          store.publish()
          toFrame({ type: 'active', id: annotation.id })
          toFrame({ type: 'focus', id: annotation.id })
        },
        onMouseEnter: () => {
          state.hoverId = annotation.id
          store.publish()
          toFrame({ type: 'hover', id: annotation.id })
        },
        onMouseLeave: () => {
          if (state.hoverId === annotation.id) state.hoverId = ''
          store.publish()
          toFrame({ type: 'hover', id: null })
        },
      },
        h('span', { className: 'annot-num' }, String(index + 1)),
        h('div', { className: 'annot-item-body' },
          h('div', { className: 'annot-sel', title: annotation.selector }, annotation.selector),
          h('div', { className: 'annot-note' }, annotation.note),
          h('div', { className: 'annot-meta' },
            annotation.page !== '' ? h('span', { className: 'annot-chip' }, annotation.page) : null,
            h('span', {
              className: 'annot-chip ' + (annotation.status === 'resolved' ? 'annot-chip--ok' : ''),
            }, annotation.status === 'resolved' ? t('statusResolved') : t('statusOpen')),
            state.visibleKnown && !state.visibleIds.includes(annotation.id)
              ? h('span', { className: 'annot-chip annot-chip--warn' }, t('hiddenNow'))
              : null),
          h('div', { className: 'annot-item-actions' },
            h('button', {
              type: 'button', className: 'annot-btn annot-btn--sm annot-btn--ghost',
              onClick: (event) => {
                event.stopPropagation()
                void toggleResolved(annotation)
              },
            }, annotation.status === 'resolved' ? t('reopen') : t('resolve')),
            h('button', {
              type: 'button',
              className: 'annot-btn annot-btn--sm annot-btn--ghost ' + (pending ? 'annot-btn--danger' : ''),
              title: pending ? t('deleteConfirmHint') : t('delete'),
              onClick: (event) => {
                event.stopPropagation()
                if (!pending) {
                  state.pendingDelete = annotation.id
                  store.publish()
                  return
                }
                void deleteAnnotation(annotation.id)
              },
            }, pending ? t('deleteConfirm') : t('delete')))))
    }

    function AnnotationList() {
      if (state.draft !== null) return h(DraftCard)
      if (state.annotations.length === 0) {
        return h('div', { className: 'annot-empty' },
          h('div', { className: 'annot-empty-title' }, t('emptyTitle')),
          h('div', { className: 'annot-empty-hint' }, t('emptyHint')))
      }
      const groups = []
      const index = new Map()
      for (const annotation of state.annotations) {
        const label = annotation.page === '' ? '页面' : annotation.page
        if (!index.has(label)) {
          index.set(label, groups.length)
          groups.push({ label, items: [] })
        }
        groups[index.get(label)].items.push(annotation)
      }
      return h('div', { className: 'annot-list' }, groups.map((group) => h('div', { key: group.label },
        h('div', { className: 'annot-group-label' }, group.label + ' · ' + group.items.length),
        group.items.map((annotation) => h(AnnotationItem, {
          key: annotation.id,
          annotation,
          index: state.annotations.indexOf(annotation),
        })))))
    }

    function Canvas() {
      const canvasRef = useRef(null)
      const [size, setSize] = useState({ w: 0, h: 0 })
      useEffect(() => {
        const element = canvasRef.current
        if (element === null) return undefined
        const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight })
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
      }, [])
      const artboardW = state.artboard.w
      const artboardH = state.artboard.h
      const scale = Math.max(0.2, Math.min(1, Math.min((size.w - 56) / artboardW, (size.h - 56) / artboardH)))
      const width = Math.round(artboardW * scale)
      const height = Math.round(artboardH * scale)
      return h('div', { className: 'annot-canvas', ref: canvasRef },
        state.status === 'ready' && state.file !== ''
          ? h('div', { className: 'annot-stage', style: { width, height } },
            h('iframe', {
              key: state.iframeKey,
              className: 'annot-frame',
              title: 'prototype',
              src: API + '/serve?path=' + encodeURIComponent(state.file) + '&v=' + state.iframeKey,
              style: { width: artboardW, height: artboardH, transform: 'scale(' + scale + ')' },
              allow: 'camera; microphone; autoplay; clipboard-read; clipboard-write',
              ref: setFrame,
            }))
          : state.status === 'loading'
            ? h('div', { className: 'annot-hint' }, t('loading'))
            : h(EmptyState))
    }

    function BoardView() {
      const board = state.board
      const hover = Number(state.boardHover) || 0
      const setHover = (value) => {
        if (state.boardHover === value) return
        state.boardHover = value
        store.publish()
      }
      if (board === null) {
        return h('div', { className: 'annot-empty' },
          h('div', { className: 'annot-empty-title' }, t('boardTitle')),
          h('div', { className: 'annot-empty-hint' }, t('recordEmpty')))
      }
      const notes = Array.isArray(board.notes) ? board.notes : []
      const hotspots = Array.isArray(board.hotspots) ? board.hotspots : []
      const cards = Array.isArray(board.cards) ? board.cards : []
      const triggers = Array.isArray(board.triggers) ? board.triggers : []
      const stepHover = Number(state.boardStepHover) || 0
      const triggerFor = (step) => triggers.find((item) => item.step === step)
      const noteFor = (number) => notes.find((note) => note.number === number)
      /* Same layout as the exported HTML: flow on the left, notes on the right,
         badges dim to 40% while another one is hovered. */
      return h('div', { className: 'annot-board annot-board--split' },
        h('div', { className: 'annot-board-stage' },
          h('div', { className: 'annot-board-canvas' },
            h('img', {
              className: 'annot-board-img',
              src: board.flowPng || board.png,
              alt: board.title,
              draggable: false,
            }),
            cards.map((card) => h('button', {
              key: 'step-hover-' + card.step,
              type: 'button',
              className: 'annot-step-hotspot',
              style: {
                left: card.left.toFixed(3) + '%',
                top: card.top.toFixed(3) + '%',
                width: card.w.toFixed(3) + '%',
                height: card.h.toFixed(3) + '%',
              },
              'aria-label': t('stepOf', { n: card.step }),
              onMouseEnter: () => {
                if (state.boardStepHover !== card.step) {
                  state.boardStepHover = card.step
                  store.publish()
                }
              },
              onMouseLeave: () => {
                if (state.boardStepHover !== 0) {
                  state.boardStepHover = 0
                  store.publish()
                }
              },
            })),
            stepHover !== 0 && triggerFor(stepHover) !== undefined
              ? h('div', {
                className: 'annot-trigger',
                'data-point': triggerFor(stepHover).point ? '1' : '0',
                style: {
                  left: triggerFor(stepHover).left.toFixed(3) + '%',
                  top: triggerFor(stepHover).top.toFixed(3) + '%',
                  width: triggerFor(stepHover).w.toFixed(3) + '%',
                  height: triggerFor(stepHover).h.toFixed(3) + '%',
                },
              })
              : null,
            hotspots.map((spot, index) => {
              const note = noteFor(spot.number)
              const dim = hover !== 0 && hover !== spot.number
              return h('button', {
                key: 'hotspot-' + index,
                type: 'button',
                className: 'annot-hotspot',
                'data-dim': dim ? '1' : '0',
                'data-active': hover === spot.number ? '1' : '0',
                style: {
                  left: (spot.flowLeft !== undefined ? spot.flowLeft : spot.panelLeft).toFixed(3) + '%',
                  top: (spot.flowTop !== undefined ? spot.flowTop : spot.panelTop).toFixed(3) + '%',
                },
                title: note ? note.annotation.note : '',
                'aria-label': t('annotations') + ' ' + spot.number,
                onMouseEnter: () => setHover(spot.number),
                onMouseLeave: () => setHover(0),
                onFocus: () => setHover(spot.number),
                onBlur: () => setHover(0),
              }, String(spot.number))
            })),
          h('div', { className: 'annot-board-bar' }, t('boardHint'))),
        h('aside', { className: 'annot-board-notes' },
          h('div', { className: 'annot-notes-head' }, t('notesTitle') + ' · ' + notes.length + ' 条'),
          notes.length === 0
            ? h('div', { className: 'annot-notes-empty' }, t('emptyHint'))
            : notes.map((note) => {
              const meta = (note.steps.length > 0 ? '第 ' + note.steps.join('、') + ' 步' : '未出现在录制步骤')
                + (note.annotation.page ? ' · ' + note.annotation.page : '')
              return h('article', {
                key: 'note-' + note.number,
                className: 'annot-note-card',
                'data-active': hover === note.number ? '1' : '0',
                onMouseEnter: () => setHover(note.number),
                onMouseLeave: () => setHover(0),
              },
                h('span', { className: 'annot-note-no' }, String(note.number)),
                h('div', { className: 'annot-note-body' },
                  h('p', null, note.annotation.note),
                  h('span', { className: 'annot-note-meta' }, meta)))
            })))
    }

    function StepPrompt() {
      if (state.stepPrompt === null) return null
      const close = () => {
        state.stepPrompt = null
        store.publish()
      }
      const confirm = () => confirmStepPrompt()
      return h('div', {
        className: 'annot-modal-mask',
        onClick: (event) => {
          if (event.target === event.currentTarget) close()
        },
      },
        h('div', { className: 'annot-modal', role: 'dialog', 'aria-label': t('stepPromptTitle'), style: { width: 'min(420px, 88%)' } },
          h('div', { className: 'annot-modal-head' }, t('stepPromptTitle')),
          h('div', { className: 'annot-modal-body' },
            h('div', { className: 'annot-field' },
              h('span', { className: 'annot-field-label' }, t('stepPromptLabel')),
              h('input', {
                className: 'annot-input',
                autoFocus: true,
                value: state.stepPrompt.value,
                placeholder: t('stepPromptPlaceholder'),
                onChange: (event) => {
                  state.stepPrompt.value = event.target.value
                  store.publish()
                },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') confirm()
                  if (event.key === 'Escape') close()
                },
              })),
            h('div', { className: 'annot-hint' }, t('stepPromptHint'))),
          h('div', { className: 'annot-modal-foot' },
            h('button', { type: 'button', className: 'annot-btn', onClick: close }, t('cancel')),
            h('button', {
              type: 'button',
              className: 'annot-btn annot-btn--primary',
              disabled: String(state.stepPrompt.value).trim() === '',
              onClick: confirm,
            }, t('stepPromptConfirm')))))
    }

    function RecordingControls() {
      return h(React.Fragment, null,
        h('span', { className: 'annot-rec-pill', title: t('recordIdleHint') },
          h('span', { className: 'annot-rec-dot' }),
          t('recording') + ' · ' + state.steps.length + ' 步',
          state.recordBusy ? h('span', { className: 'annot-rec-busy' }, t('recordBusy')) : null),
        h('button', {
          type: 'button', className: 'annot-btn', onClick: openStepPrompt,
        }, t('insertStep')),
        h('button', {
          type: 'button', className: 'annot-btn annot-btn--danger', onClick: cancelRecording,
        }, t('cancelRecord')),
        h('button', {
          type: 'button',
          className: 'annot-btn annot-btn--primary',
          onClick: stopRecording,
          disabled: state.stopping,
        }, state.stopping ? t('finishing') : t('finishRecord')))
    }

    function AnnotatePage() {
      useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      const [bridgeStale, setBridgeStale] = useState(false)

      /* A stored prototype should reopen by itself; a panel switch must not
         lose the file the user was working on. */
      useEffect(() => {
        if (state.file !== '' && state.status === 'idle') void openFile(state.file)
      }, [])

      /* Shift tap toggles annotate mode, Ctrl/Cmd+Enter saves the draft — even
         when focus sits in the prototype iframe (activeElement is the iframe). */
      useEffect(() => {
        let shiftDown = false
        let downAt = 0
        let dirty = false
        const editable = (target) => target !== null && target !== undefined && target.nodeType === 1
          && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable === true)
        /* The panel only exists while the plugin panel is the active main panel,
           so it is the mount, not the focused element, that decides. */
        const panelMounted = () => document.querySelector('.annot-page') !== null
        const onDown = (event) => {
          if (event.key === 'Shift') {
            shiftDown = true
            downAt = Date.now()
            dirty = false
            return
          }
          if (shiftDown) dirty = true
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && state.draft !== null) {
            event.preventDefault()
            void saveDraft()
          }
        }
        const onUp = (event) => {
          if (event.key !== 'Shift') return
          const wasDown = shiftDown
          const wasDirty = dirty
          const elapsed = wasDown ? Date.now() - downAt : 0
          shiftDown = false
          dirty = false
          if (wasDirty) return
          if (wasDown && elapsed > 600) return
          if (editable(event.target)) return
          if (!panelMounted()) return
          toggleAnnotateMode(true)
        }
        const onMouseDown = () => {
          if (shiftDown) dirty = true
        }
        window.addEventListener('keydown', onDown, true)
        window.addEventListener('keyup', onUp, true)
        window.addEventListener('mousedown', onMouseDown, true)
        return () => {
          window.removeEventListener('keydown', onDown, true)
          window.removeEventListener('keyup', onUp, true)
          window.removeEventListener('mousedown', onMouseDown, true)
        }
      }, [])

      /* A frame that never reports ready usually means the route answered with an
         error page; surface a retry instead of an eternal empty canvas. */
      useEffect(() => {
        if (state.status !== 'ready') {
          setBridgeStale(false)
          return undefined
        }
        const timer = window.setInterval(() => {
          if (state.bridgeReady) {
            setBridgeStale(false)
            return
          }
          if (state.iframeKey > 0 && state.bridgeAt > 0 && Date.now() - state.bridgeAt > 8000) setBridgeStale(true)
        }, 1500)
        return () => window.clearInterval(timer)
      }, [state.status, state.iframeKey, state.bridgeReady])

      const ready = state.status === 'ready' && state.file !== ''


      const boardView = state.view === 'board'
      return h('div', { className: 'annot-page', 'data-recording': state.recording ? '1' : '0' },
        h('div', { className: 'annot-top' },
          h('div', { className: 'annot-title' }, h(Glyph, { size: 16 }), boardView ? t('boardTitle') : t('title')),
          h('div', { className: 'annot-grow annot-file', title: state.file }, ready || boardView ? state.file : t('subtitle')),
          boardView
            ? h(React.Fragment, null,
              h('input', {
                className: 'annot-board-name',
                value: state.flowName,
                title: t('flowNameHint'),
                placeholder: t('flowNamePlaceholder'),
                spellCheck: false,
                onChange: (event) => {
                  state.flowName = event.target.value
                  store.publish()
                  scheduleBoardRebuild()
                },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                },
              }),
              h('button', {
                type: 'button', className: 'annot-btn', onClick: () => {
                  state.view = 'preview'
                  store.publish()
                },
              }, t('backToProto')),
              h('button', { type: 'button', className: 'annot-btn', onClick: downloadBoardPng }, t('downloadPng')),
              h('button', {
                type: 'button', className: 'annot-btn annot-btn--primary', onClick: downloadBoardHtml,
              }, t('downloadHtml')))
            : ready
              ? (state.recording
                ? h(RecordingControls)
                : h(React.Fragment, null,
                  h(Toggle),
                  h('button', {
                    type: 'button',
                    className: 'annot-btn annot-btn--with-icon',
                    title: state.mode ? t('recordNeedsModeOff') : t('recordIdleHint'),
                    disabled: state.mode,
                    onClick: startRecording,
                  },
                    h('svg', {
                      viewBox: '0 0 16 16',
                      width: 14,
                      height: 14,
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: 1.4,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                      'aria-hidden': true,
                    },
                      h('rect', { x: 1.4, y: 4.6, width: 9.2, height: 7.2, rx: 2 }),
                      h('path', { d: 'M10.6 8.4 14.4 6.2v5.8l-3.8-2.2z' }),
                      h('circle', { cx: 6, cy: 8.2, r: 1.8 })),
                    h('span', null, t('record'))),
                  h('button', {
                    type: 'button', className: 'annot-btn', title: t('reload'), onClick: reload,
                  }, t('reload')),
                  h('button', {
                    type: 'button',
                    className: 'annot-btn',
                    disabled: state.savingSource,
                    title: t('saveSourceHint'),
                    onClick: () => void saveSource(),
                  }, state.savingSource ? t('savingSource') : t('saveSource')),
                  h('button', {
                    type: 'button',
                    className: 'annot-btn',
                    disabled: state.picking,
                    title: t('chooseLocalHint'),
                    onClick: () => void pickNativeFile(),
                  }, state.picking ? t('picking') : t('change'))))
              : h('button', {
                type: 'button',
                className: 'annot-btn annot-btn--primary',
                disabled: state.picking,
                title: t('chooseLocalHint'),
                onClick: () => void pickNativeFile(),
              }, state.picking ? t('picking') : t('open'))),
        state.error !== '' ? h('div', { className: 'annot-error' }, state.error) : null,
        boardView ? h(BoardView) : h('div', { className: 'annot-body' },
          h(Canvas),
          h('div', { className: 'annot-side' },
            h('div', { className: 'annot-side-head' },
              h('span', { className: 'annot-side-title' }, t('annotations') + ' · ' + t('count', { n: state.annotations.length })),
              h('div', { style: { display: 'flex', gap: 4 } },
                h('button', {
                  type: 'button', className: 'annot-btn annot-btn--sm annot-btn--ghost',
                  disabled: state.annotations.length === 0, onClick: exportPackage,
                }, t('exportPkg')),
                h('button', {
                  type: 'button', className: 'annot-btn annot-btn--sm annot-btn--ghost',
                  disabled: state.annotations.length === 0, onClick: () => void copyAll(),
                }, t('copyAll')))),
            bridgeStale
              ? h('div', { className: 'annot-error' }, t('bridgeWait') + ' ', h('button', {
                type: 'button', className: 'annot-btn annot-btn--sm', onClick: reload,
              }, t('reloadBridge')))
              : null,
            h(AnnotationList),
            h('div', { className: 'annot-row-side' },
              h('span', { className: 'annot-hint' }, state.mode ? t('annotateHint') : t('subtitle'))))),
        state.toast !== '' ? h('div', { className: 'annot-toast' }, state.toast) : null,
        h(Picker),
        h(StepPrompt))
    }

    /* -------------------------------------------------------------------- mount */

    function apply(ctx, config) {
      const bound = ctx.locale.bind(NS)
      translate = (key) => {
        const text = bound(key)
        return typeof text === 'string' && text !== '' ? text : (zh[key] ?? en[key] ?? String(key))
      }
      /* Exposed for support: lets a bug report show exactly what the panel holds. */
      try {
        window.__DSH_ANNOTATE_STATE__ = state
      } catch (error) {
        /* ignore */
      }
      ctx.effect(() => injectStyles(), 'annotate: stylesheet')
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'annotate: dictionaries')
      ctx.effect(() => {
        window.addEventListener('message', onFrameMessage)
        return () => {
          window.removeEventListener('message', onFrameMessage)
          frameEl = null
        }
      }, 'annotate: frame messages')
      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, AnnotatePage)), 'annotate: panel')
      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 21,
        label: () => t('title'),
        locale: NS,
      }, SidebarGlyph)), 'annotate: sidebar row')

      /* Config defaults arrive after activation in some compositions; a stored
         file always wins, so only seed when the user has none. */
      if (config !== null && typeof config === 'object' && typeof config.defaultFile === 'string'
        && config.defaultFile !== '' && state.file === '' && state.annotations.length === 0) {
        state.file = config.defaultFile
        state.recents = [config.defaultFile, ...state.recents.filter((item) => item !== config.defaultFile)]
      }
    }

    return {
      inject: ['slots', 'locale', 'layout'],
      apply,
    }
  },
})
