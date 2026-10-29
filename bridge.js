/**
 * Design annotation — prototype bridge.
 *
 * Injected into the served prototype document by the Host's `/annotate-api/serve`
 * route. It owns everything that needs the prototype's DOM: element picking,
 * stable selector generation, the "flow state" conditions captured at pick time,
 * and the pins that reappear whenever those conditions hold again.
 *
 * It never talks to the network. The parent panel owns persistence; this file
 * only exchanges messages with it.
 */
(function () {
  'use strict';

  if (window.__DSH_ANNOTATE_BRIDGE__ === true) return;
  window.__DSH_ANNOTATE_BRIDGE__ = true;

  var SOURCE = 'dsh-annotate';
  var PIN_SIZE = 22;
  var STATE_CLASS = /^(is-|has-)/;
  var STATE_EXACT = /^(active|open|opened|show|shown|visible|hidden|selected|current|on|off|expanded|collapsed|focus)$/;

  /** Current interaction mode: picking elements instead of driving the prototype. */
  var mode = false;
  /** Annotations delivered by the panel. */
  var annotations = [];
  var activeId = null;
  var hoveredId = null;

  var overlay = null;
  var hoverBox = null;
  var hoverLabel = null;
  var pinLayer = null;
  var flashBox = null;
  var pinEls = Object.create(null);
  var hoveredEl = null;
  /* A picked element stays locked until another area is clicked, so the mouse
     can travel to the note editor without moving the selection. */
  var locked = null;
  var lockBox = null;
  var lockChip = null;
  var frameRequested = false;
  var rendering = false;

  /* Flow recording: every click is snapshotted at that moment as static HTML,
     then rasterized later, so a burst of clicks can never drop a step. */
  var recording = false;
  var recordRun = 0;
  var recordSteps = [];
  var recordStartedAt = 0;
  var lastChangeAt = 0;
  var h2cPromise = null;
  var snapshotQueue = [];
  var snapshotTimer = null;
  var pendingClick = null;
  var rasterizing = false;
  var nextStepIndex = 0;

  /* ---------------------------------------------------------------- messaging */

  function post(payload) {
    payload.source = SOURCE;
    try {
      window.parent.postMessage(payload, '*');
    } catch (error) {
      /* a detached frame has no parent to talk to */
    }
  }

  function onMessage(event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (data === null || typeof data !== 'object' || data.source !== SOURCE) return;

    if (data.type === 'mode') {
      setMode(data.on === true);
      return;
    }
    if (data.type === 'recordStart') {
      startRecording();
      return;
    }
    if (data.type === 'recordStepManual') {
      flushPendingClick();
      takeSnapshot({ run: recordRun, label: typeof data.label === 'string' && data.label !== '' ? data.label.slice(0, 24) : '手动步骤', selector: null, point: null });
      return;
    }
    if (data.type === 'recordStop') {
      stopRecording();
      return;
    }
    if (data.type === 'recordCancel') {
      recording = false;
      recordRun += 1;
      recordSteps = [];
      snapshotQueue = [];
      pendingClick = null;
      if (snapshotTimer !== null) { window.clearTimeout(snapshotTimer); snapshotTimer = null; }
      post({ type: 'recordCancelled', run: recordRun });
      return;
    }
    if (data.type === 'set') {
      annotations = Array.isArray(data.annotations) ? data.annotations : [];
      renderPins();
      return;
    }
    if (data.type === 'lockClear') {
      clearLock(false);
      return;
    }
    if (data.type === 'focus') {
      focusAnnotation(data.id);
      return;
    }
    if (data.type === 'hover') {
      hoveredId = typeof data.id === 'string' ? data.id : null;
      renderPins();
      return;
    }
    if (data.type === 'active') {
      activeId = typeof data.id === 'string' ? data.id : null;
      renderPins();
    }
  }

  /* ---------------------------------------------------------------- selectors */

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (character) {
      return '\\' + character;
    });
  }

  function unique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (error) {
      return false;
    }
  }

  /** A stable-enough selector: id, then a unique data attribute, then a DOM path. */
  function selectorFor(element) {
    if (element === null || element.nodeType !== 1) return null;
    if (element.id) {
      var byId = '#' + cssEscape(element.id);
      if (unique(byId)) return byId;
    }
    var attributes = element.attributes;
    for (var index = 0; index < attributes.length; index += 1) {
      var attribute = attributes[index];
      if (attribute.name.indexOf('data-') !== 0) continue;
      if (attribute.value === '' || attribute.value.length > 80) continue;
      var byData = '[' + attribute.name + '="' + String(attribute.value).replace(/["\\]/g, '\\$&') + '"]';
      if (unique(byData)) return byData;
    }

    var parts = [];
    var node = element;
    while (node !== null && node.nodeType === 1 && node !== document.documentElement) {
      if (node.id) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      var part = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent !== null) {
        var sameTag = [];
        for (var child = 0; child < parent.children.length; child += 1) {
          if (parent.children[child].tagName === node.tagName) sameTag.push(parent.children[child]);
        }
        if (sameTag.length > 1) part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function resolve(selector) {
    if (typeof selector !== 'string' || selector === '') return null;
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  /* ------------------------------------------------------------- flow states */

  function stateClasses(element) {
    var out = [];
    if (!element.classList) return out;
    for (var index = 0; index < element.classList.length; index += 1) {
      var name = element.classList[index];
      if (STATE_CLASS.test(name) || STATE_EXACT.test(name)) out.push(name);
    }
    return out.sort();
  }

  function isStateful(element) {
    if (element.hasAttribute('aria-hidden')) return true;
    if (element.hasAttribute('hidden')) return true;
    if (stateClasses(element).length > 0) return true;
    if (element.tagName === 'DIALOG' || element.tagName === 'DETAILS') return true;
    var inline = element.getAttribute('style') || '';
    return /display\s*:|visibility\s*:/.test(inline);
  }

  function signatureOf(element) {
    var style = window.getComputedStyle(element);
    return {
      ariaHidden: element.getAttribute ? element.getAttribute('aria-hidden') : null,
      hiddenAttr: element.hasAttribute('hidden') ? '1' : null,
      cls: stateClasses(element),
      display: style.display,
      visibility: style.visibility,
      open: element.tagName === 'DIALOG' || element.tagName === 'DETAILS'
        ? (element.hasAttribute('open') ? '1' : '0')
        : null
    };
  }

  function sameSignature(left, right) {
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return true;
    return left.ariaHidden === right.ariaHidden
      && left.hiddenAttr === right.hiddenAttr
      && left.display === right.display
      && left.visibility === right.visibility
      && left.open === right.open
      && (left.cls || []).join(' ') === (right.cls || []).join(' ');
  }

  /** The stateful ancestors that must still hold the same state for the pin to show. */
  function conditionsFor(element) {
    var conditions = [];
    var node = element.parentElement;
    while (node !== null && node !== document.documentElement && conditions.length < 8) {
      if (isStateful(node)) {
        var selector = selectorFor(node);
        if (selector !== null) conditions.push({ selector: selector, sig: signatureOf(node) });
      }
      node = node.parentElement;
    }
    return conditions;
  }

  function hasBox(element) {
    return element.getClientRects().length > 0;
  }

  /** Whether the element's own box lies inside the viewport at all. */
  function inViewport(element) {
    var box = element.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) return false;
    return box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
  }

  /**
   * Whether another layer covers the element — a prototype overlay above the
   * page it was opened from. Our own layer is pointer-transparent, so the hit
   * test only ever sees the prototype's own stack.
   */
  function occluded(element) {
    var box = element.getBoundingClientRect();
    var points = [
      [box.left + box.width / 2, box.top + box.height / 2],
      [box.left + Math.min(12, box.width / 2), box.top + Math.min(12, box.height / 2)]
    ];
    for (var index = 0; index < points.length; index += 1) {
      var x = points[index][0];
      var y = points[index][1];
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      var hit = document.elementFromPoint(x, y);
      if (hit === null) return true;
      if (hit === element || element.contains(hit) || hit.contains(element)) return false;
      return true;
    }
    /* Every probe point sat outside the viewport: the element is scrolled away. */
    return true;
  }

  function visibleNow(annotation) {
    var element = resolve(annotation.selector);
    if (element === null || !hasBox(element)) return false;
    if (!inViewport(element)) return false;
    if (occluded(element)) return false;
    var conditions = Array.isArray(annotation.conditions) ? annotation.conditions : [];
    for (var index = 0; index < conditions.length; index += 1) {
      var node = resolve(conditions[index].selector);
      if (node === null) return false;
      if (!sameSignature(signatureOf(node), conditions[index].sig)) return false;
    }
    return true;
  }

  /* --------------------------------------------------------------- overlays */

  function ensureChrome() {
    if (overlay !== null) return;
    var style = document.createElement('style');
    style.setAttribute('data-dsh-annot-ui', '1');
    style.textContent = [
      'html.__dsh-annot-mode, html.__dsh-annot-mode *:not([data-dsh-annot-ui]):not([data-dsh-annot-ui] *){cursor:crosshair !important}',
      '.dsh-annot-layer{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif}',
      '.dsh-annot-hover{position:fixed;border:2px solid #5F46C9;background:rgba(95,70,201,.10);border-radius:4px;pointer-events:none;display:none;box-sizing:border-box}',
      '.dsh-annot-label{position:fixed;max-width:280px;padding:4px 8px;border-radius:6px;background:#2B2B33;color:#fff;font-size:11px;line-height:1.3;pointer-events:none;display:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.25)}',
      '.dsh-annot-pin{position:absolute;width:' + PIN_SIZE + 'px;height:' + PIN_SIZE + 'px;margin:-11px 0 0 -11px;border-radius:50%;border:2px solid #fff;background:#5F46C9;color:#fff;font:700 11px/1 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.28);padding:0}',
      '.dsh-annot-pin[data-active="1"]{background:#E4572E;transform:scale(1.12)}',
      '.dsh-annot-pin[data-hover="1"]{transform:scale(1.12)}',
      '.dsh-annot-flash{position:fixed;border:2px solid #E4572E;border-radius:4px;pointer-events:none;box-shadow:0 0 0 4px rgba(228,87,46,.18);transition:opacity .35s ease;opacity:1}',
      '.dsh-annot-lock{position:fixed;border:2px solid #5F46C9;border-radius:4px;pointer-events:none;display:none;box-sizing:border-box;box-shadow:0 0 0 3px rgba(95,70,201,.18)}',
      '.dsh-annot-lock-chip{position:fixed;padding:2px 7px;border-radius:4px;background:#5F46C9;color:#fff;font-size:10.5px;line-height:1.4;pointer-events:none;display:none;white-space:nowrap}'
    ].join('\n');
    document.documentElement.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'dsh-annot-layer';
    overlay.setAttribute('data-dsh-annot-ui', '1');
    hoverBox = document.createElement('div');
    hoverBox.className = 'dsh-annot-hover';
    hoverBox.setAttribute('data-dsh-annot-ui', '1');
    hoverLabel = document.createElement('div');
    hoverLabel.className = 'dsh-annot-label';
    hoverLabel.setAttribute('data-dsh-annot-ui', '1');
    lockBox = document.createElement('div');
    lockBox.className = 'dsh-annot-lock';
    lockBox.setAttribute('data-dsh-annot-ui', '1');
    lockChip = document.createElement('div');
    lockChip.className = 'dsh-annot-lock-chip';
    lockChip.setAttribute('data-dsh-annot-ui', '1');
    lockChip.textContent = '已锁定';
    pinLayer = document.createElement('div');
    pinLayer.className = 'dsh-annot-pins';
    pinLayer.setAttribute('data-dsh-annot-ui', '1');
    pinLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    overlay.appendChild(hoverBox);
    overlay.appendChild(hoverLabel);
    overlay.appendChild(lockBox);
    overlay.appendChild(lockChip);
    overlay.appendChild(pinLayer);
    document.body.appendChild(overlay);
  }

  function showHoverBox(element) {
    ensureChrome();
    if (element === null || element === document.body || element === document.documentElement) {
      hoverBox.style.display = 'none';
      hoverLabel.style.display = 'none';
      return;
    }
    var box = element.getBoundingClientRect();
    hoverBox.style.display = 'block';
    hoverBox.style.left = box.left + 'px';
    hoverBox.style.top = box.top + 'px';
    hoverBox.style.width = box.width + 'px';
    hoverBox.style.height = box.height + 'px';

    var label = element.tagName.toLowerCase();
    if (element.id) label += '#' + element.id;
    var cls = element.className;
    if (typeof cls === 'string' && cls.trim() !== '') label += '.' + cls.trim().split(/\s+/).slice(0, 2).join('.');
    var text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (text !== '') label += ' · ' + text;

    hoverLabel.textContent = label;
    hoverLabel.style.display = 'block';
    var labelTop = box.top > 26 ? box.top - 24 : box.bottom + 6;
    hoverLabel.style.left = Math.max(4, Math.min(box.left, window.innerWidth - 290)) + 'px';
    hoverLabel.style.top = labelTop + 'px';
  }

  function hideHoverBox() {
    if (hoverBox !== null) hoverBox.style.display = 'none';
    if (hoverLabel !== null) hoverLabel.style.display = 'none';
  }

  /* ------------------------------------------------------------------- pins */

  function placePin(element, annotation, order, index) {
    var box = element.getBoundingClientRect();
    var pin = pinEls[annotation.id];
    if (pin === undefined || pin.parentNode !== pinLayer) {
      pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'dsh-annot-pin';
      pin.setAttribute('data-dsh-annot-ui', '1');
      pin.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        post({ type: 'activate', id: annotation.id });
      });
      pinLayer.appendChild(pin);
      pinEls[annotation.id] = pin;
    }
    pin.textContent = String(index + 1);
    pin.title = annotation.note || annotation.selector;
    pin.style.left = Math.min(window.innerWidth - 14, Math.max(14, box.right - 4)) + 'px';
    pin.style.top = Math.min(window.innerHeight - 14, Math.max(14, box.top + 4)) + 'px';
    pin.setAttribute('data-active', activeId === annotation.id ? '1' : '0');
    pin.setAttribute('data-hover', hoveredId === annotation.id ? '1' : '0');
  }

  /** Ids visible right now, reported so the panel can mark the others. */
  var lastVisibleKey = null;

  function reportVisible(seen) {
    var ids = [];
    for (var index = 0; index < annotations.length; index += 1) {
      var id = annotations[index] === null ? undefined : annotations[index].id;
      if (typeof id === 'string' && seen[id] === true) ids.push(id);
    }
    var key = ids.join('|');
    if (key === lastVisibleKey) return;
    lastVisibleKey = key;
    post({ type: 'visible', ids: ids });
  }

  function renderPins() {
    if (document.body === null) return;
    if (locked !== null) positionLock();
    if (annotations.length === 0) {
      if (pinLayer !== null) {
        pinLayer.textContent = '';
        pinEls = Object.create(null);
      }
      reportVisible(Object.create(null));
      return;
    }
    ensureChrome();
    rendering = true;
    var seen = Object.create(null);
    for (var index = 0; index < annotations.length; index += 1) {
      var annotation = annotations[index];
      if (annotation === null || typeof annotation !== 'object' || typeof annotation.selector !== 'string') continue;
      if (!visibleNow(annotation)) continue;
      var element = resolve(annotation.selector);
      if (element === null) continue;
      seen[annotation.id] = true;
      placePin(element, annotation, index, index);
    }
    for (var id in pinEls) {
      if (seen[id] !== true) {
        var stale = pinEls[id];
        if (stale.parentNode !== null) stale.parentNode.removeChild(stale);
        delete pinEls[id];
      }
    }
    rendering = false;
    reportVisible(seen);
  }

  function scheduleRender() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(function () {
      frameRequested = false;
      renderPins();
    });
  }

  /* ------------------------------------------------------------------- mode */

  function setMode(next) {
    mode = next === true;
    ensureChrome();
    if (mode) document.documentElement.classList.add('__dsh-annot-mode');
    else {
      document.documentElement.classList.remove('__dsh-annot-mode');
      hideHoverBox();
      hoveredEl = null;
      clearLock(false);
    }
    post({ type: 'modeState', on: mode });
  }

  function elementFrom(point) {
    var element = document.elementFromPoint(point.clientX, point.clientY);
    if (element === null) return null;
    if (overlay !== null && overlay.contains(element)) return null;
    return element;
  }

  function onPointerMove(event) {
    if (!mode || locked !== null) return;
    var element = elementFrom(event);
    hoveredEl = element;
    showHoverBox(element);
  }

  function onPointerDown(event) {
    if (shiftDown) shiftDirty = true;
    if (!mode) return;
    /* Picking must not drive the prototype: swallow the interaction itself. */
    event.preventDefault();
    event.stopPropagation();
  }

  var lastPickAt = 0;

  /** Picking listens on pointerup: a click can be suppressed when the prototype
   * (or our own pointerdown guard) cancels compatibility mouse events. */
  function onPointerUp(event) {
    if (!mode) return;
    var raw = event.target;
    if (overlay !== null && raw !== null && raw.nodeType === 1 && overlay.contains(raw)) return;
    if (Date.now() - lastPickAt < 350) return;
    var picked = hoveredEl !== null && hoveredEl.isConnected ? hoveredEl : elementFrom(event);
    if (picked === null) return;
    event.preventDefault();
    event.stopPropagation();
    lastPickAt = Date.now();
    pick(picked);
  }

  function onClick(event) {
    if (mode) {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - lastPickAt < 350) return;
      var picked = hoveredEl !== null && hoveredEl.isConnected ? hoveredEl : elementFrom(event);
      if (picked === null) {
        clearLock(true);
        return;
      }
      lastPickAt = Date.now();
      pick(picked);
      return;
    }
    if (!recording) return;
    var target = event.target !== null && event.target.nodeType === 1 ? event.target : null;
    if (target === null) return;
    if (overlay !== null && overlay.contains(target)) return;
    var point = event.isTrusted === false ? null : {
      x: Math.min(1, Math.max(0, event.clientX / window.innerWidth)),
      y: Math.min(1, Math.max(0, event.clientY / window.innerHeight))
    };
    queueClickSnapshot(actionLabel(target), selectorFor(target), point);
  }

  var shiftDown = false;
  var shiftDownAt = 0;
  var shiftDirty = false;

  function isEditableTarget(target) {
    if (target === null || target === undefined || target.nodeType !== 1) return false;
    var tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
  }

  function onKeyDown(event) {
    /* A tap of Shift toggles annotate mode; any other key or a drag while it is
       held marks the press as part of a shortcut instead. */
    if (event.key === 'Shift') {
      shiftDown = true;
      shiftDownAt = Date.now();
      shiftDirty = false;
      return;
    }
    if (shiftDown) shiftDirty = true;
    if (!mode) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMode(false);
    }
  }

  function onKeyUp(event) {
    if (event.key !== 'Shift') return;
    var wasDown = shiftDown;
    var dirty = shiftDirty;
    var elapsed = wasDown ? Date.now() - shiftDownAt : 0;
    shiftDown = false;
    shiftDirty = false;
    if (dirty) return;
    if (wasDown && elapsed > 600) return;
    if (isEditableTarget(event.target)) return;
    post({ type: 'shiftToggle' });
  }

  function snapshotFor(element) {
    var box = element.getBoundingClientRect();
    var text = (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || '',
      cls: typeof element.className === 'string' ? element.className : '',
      role: element.getAttribute('role') || '',
      text: text,
      rect: { x: Math.round(box.left), y: Math.round(box.top), w: Math.round(box.width), h: Math.round(box.height) }
    };
  }

  function pageLabelFor(element, conditions) {
    for (var index = 0; index < conditions.length; index += 1) {
      var selector = conditions[index].selector;
      if (selector.charAt(0) === '#') return selector;
    }
    var node = element.parentElement;
    while (node !== null && node !== document.body) {
      if (node.id) return '#' + node.id;
      node = node.parentElement;
    }
    return '页面';
  }

  function positionLock() {
    if (lockBox === null || locked === null) return;
    var element = locked.element;
    if (element === null || !element.isConnected) {
      clearLock(false);
      return;
    }
    var box = element.getBoundingClientRect();
    lockBox.style.display = 'block';
    lockBox.style.left = box.left + 'px';
    lockBox.style.top = box.top + 'px';
    lockBox.style.width = box.width + 'px';
    lockBox.style.height = box.height + 'px';
    lockChip.style.display = 'block';
    lockChip.style.left = Math.max(4, box.left) + 'px';
    lockChip.style.top = (box.top > 24 ? box.top - 22 : box.bottom + 4) + 'px';
  }

  /** Release the selection; `notify` tells the panel to drop its draft. */
  function clearLock(notify) {
    if (locked === null && lockBox !== null && lockBox.style.display === 'none') return;
    locked = null;
    if (lockBox !== null) lockBox.style.display = 'none';
    if (lockChip !== null) lockChip.style.display = 'none';
    if (notify !== false) post({ type: 'unpick' });
  }

  function pick(element) {
    if (element === document.body || element === document.documentElement) {
      clearLock(true);
      return;
    }
    if (locked !== null && locked.element === element) return;
    if (locked !== null && element !== null && locked.element.contains(element)) return;
    var selector = selectorFor(element);
    if (selector === null) return;
    var conditions = conditionsFor(element);
    post({
      type: 'picked',
      selector: selector,
      page: pageLabelFor(element, conditions),
      conditions: conditions,
      snapshot: snapshotFor(element)
    });
    /* Annotate mode stays on until the user turns it off (toggle or Esc), so a
       review pass can mark several elements without re-arming it each time. */
    locked = { element: element };
    hoveredEl = null;
    hideHoverBox();
    positionLock();
    renderPins();
  }

  /* ------------------------------------------------------------------ focus */

  function focusAnnotation(id) {
    var annotation = null;
    for (var index = 0; index < annotations.length; index += 1) {
      if (annotations[index].id === id) {
        annotation = annotations[index];
        break;
      }
    }
    if (annotation === null) return;
    activeId = id;
    var element = resolve(annotation.selector);
    if (element === null) {
      post({ type: 'focusResult', id: id, ok: false });
      renderPins();
      return;
    }
    try {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    } catch (error) {
      element.scrollIntoView();
    }
    flashAt(element);
    post({ type: 'focusResult', id: id, ok: visibleNow(annotation) });
    renderPins();
  }

  function flashAt(element) {
    ensureChrome();
    if (flashBox !== null && flashBox.parentNode !== null) flashBox.parentNode.removeChild(flashBox);
    var box = element.getBoundingClientRect();
    flashBox = document.createElement('div');
    flashBox.className = 'dsh-annot-flash';
    flashBox.setAttribute('data-dsh-annot-ui', '1');
    flashBox.style.left = box.left + 'px';
    flashBox.style.top = box.top + 'px';
    flashBox.style.width = box.width + 'px';
    flashBox.style.height = box.height + 'px';
    overlay.appendChild(flashBox);
    window.setTimeout(function () {
      if (flashBox !== null) flashBox.style.opacity = '0';
    }, 900);
    window.setTimeout(function () {
      if (flashBox !== null && flashBox.parentNode !== null) flashBox.parentNode.removeChild(flashBox);
      flashBox = null;
    }, 1400);
  }

  /* --------------------------------------------------------------- recording */

  /** The human-readable action behind a click, preferring the label the design
   * already exposes (aria-label, then placeholder/title, then visible text). */
  function actionLabel(element) {
    if (element === null || element.nodeType !== 1) return '操作';
    var candidates = ['aria-label', 'title', 'placeholder'];
    for (var index = 0; index < candidates.length; index += 1) {
      var value = element.getAttribute(candidates[index]);
      if (value !== null && value.trim() !== '') return value.trim().slice(0, 18);
    }
    var text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (text !== '') return text.slice(0, 18);
    return element.tagName.toLowerCase();
  }

  /** Load the vendored rasterizer once; recording is impossible without it. */
  function ensureRasterizer() {
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
    if (h2cPromise !== null) return h2cPromise;
    h2cPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = '/annotate-api/html2canvas.js';
      script.onload = function () {
        if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
        else reject(new Error('截图组件未就绪'));
      };
      script.onerror = function () { reject(new Error('截图组件加载失败')); };
      document.head.appendChild(script);
    });
    return h2cPromise;
  }

  function visibleAnnotationIds() {
    var ids = [];
    for (var index = 0; index < annotations.length; index += 1) {
      var annotation = annotations[index];
      if (annotation !== null && typeof annotation === 'object' && visibleNow(annotation)) ids.push(annotation.id);
    }
    return ids;
  }

  /** Where each visible annotation sits, normalised to the viewport, so the
   * board can stamp its number right on the element inside the thumbnail. */
  function annotationMarks() {
    var marks = [];
    for (var index = 0; index < annotations.length; index += 1) {
      var annotation = annotations[index];
      if (annotation === null || typeof annotation !== 'object') continue;
      if (!visibleNow(annotation)) continue;
      var element = resolve(annotation.selector);
      if (element === null) continue;
      var box = element.getBoundingClientRect();
      marks.push({
        id: annotation.id,
        x: Math.min(1, Math.max(0, (box.right - 4) / window.innerWidth)),
        y: Math.min(1, Math.max(0, (box.top + 2) / window.innerHeight))
      });
    }
    return marks;
  }

  /**
   * Which screen the step actually shows: the open overlay on top wins, then the
   * container that owns the clicked element, then the document itself.
   */
  function currentPageLabel(anchor) {
    var open = [];
    var nodes = document.querySelectorAll('[aria-hidden="false"][id]');
    for (var index = 0; index < nodes.length; index += 1) open.push(nodes[index]);
    if (anchor !== null && anchor !== undefined && anchor.getBoundingClientRect !== undefined) {
      var box = anchor.getBoundingClientRect();
      var hit = document.elementFromPoint(box.left + Math.min(10, box.width / 2), box.top + Math.min(10, box.height / 2));
      for (var probe = 0; probe < open.length; probe += 1) {
        if (hit !== null && open[probe].contains(hit)) return '#' + open[probe].id;
      }
      for (var owner = 0; owner < open.length; owner += 1) {
        if (open[owner].contains(anchor)) return '#' + open[owner].id;
      }
    }
    if (open.length > 0) {
      var last = open[open.length - 1];
      if (last.id) return '#' + last.id;
    }
    var main = document.querySelector('main[id], [role="main"][id]');
    if (main !== null) return '#' + main.id;
    return '页面';
  }

  /** Box of the clicked element at snapshot time; the raw point is the fallback. */
  function measureTrigger(selector, point) {
    var element = selector ? resolve(selector) : null;
    if (element !== null) {
      var box = element.getBoundingClientRect();
      var onScreen = box.width >= 2 && box.height >= 2
        && box.bottom > 0 && box.right > 0
        && box.top < window.innerHeight && box.left < window.innerWidth;
      if (onScreen) {
        return {
          x: Math.min(1, Math.max(0, box.left / window.innerWidth)),
          y: Math.min(1, Math.max(0, box.top / window.innerHeight)),
          w: Math.min(1, Math.max(0, box.width / window.innerWidth)),
          h: Math.min(1, Math.max(0, box.height / window.innerHeight)),
          point: false
        };
      }
    }
    if (point !== null && point !== undefined) {
      return { x: point.x, y: point.y, point: true };
    }
    return null;
  }

  /** Scroll offsets of every scrolled container, tagged so the frozen copy can
   * restore them (outerHTML alone renders every scroller at offset zero). */
  function captureScrollState() {
    var list = [];
    var nodes = document.querySelectorAll('*');
    var stamp = 0;
    for (var index = 0; index < nodes.length && list.length < 300; index += 1) {
      var element = nodes[index];
      if (overlay !== null && overlay.contains(element)) continue;
      if (element.scrollTop === 0 && element.scrollLeft === 0) continue;
      var style = window.getComputedStyle(element);
      if (style.overflowY === 'visible' && style.overflowX === 'visible') continue;
      element.setAttribute('data-dsh-scroll', String(stamp));
      list.push({ key: String(stamp), top: Math.round(element.scrollTop), left: Math.round(element.scrollLeft) });
      stamp += 1;
    }
    if (window.scrollY > 0 || window.scrollX > 0) {
      document.documentElement.setAttribute('data-dsh-scroll', 'root');
      list.push({ key: 'root', top: Math.round(window.scrollY), left: Math.round(window.scrollX) });
    }
    return list;
  }

  function clearScrollMarks() {
    var marked = document.querySelectorAll('[data-dsh-scroll]');
    for (var index = 0; index < marked.length; index += 1) marked[index].removeAttribute('data-dsh-scroll');
  }

  /** Serialize the *current* page, freeze it (scripts stripped), queue it. */
  function takeSnapshot(capture) {
    if (capture.run !== recordRun) return;
    var overlayWas = overlay !== null ? overlay.style.display : null;
    if (overlay !== null) overlay.style.display = 'none';
    var scrolls = captureScrollState();
    var html = '';
    try {
      html = '<!doctype html>' + document.documentElement.outerHTML;
    } catch (error) {
      html = '';
    }
    clearScrollMarks();
    if (overlay !== null) overlay.style.display = overlayWas === null ? '' : overlayWas;
    if (html === '') return;
    /* A frame is a picture of a moment: no scripts may run in it. */
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

    var element = capture.selector ? resolve(capture.selector) : null;
    var trigger = measureTrigger(capture.selector, capture.point);
    var width = Math.max(240, Math.round(window.innerWidth));
    var height = Math.max(320, Math.round(window.innerHeight));
    var queueItem = {
      run: capture.run,
      label: capture.label,
      selector: capture.selector,
      page: currentPageLabel(element),
      at: new Date().toISOString(),
      annotations: visibleAnnotationIds(),
      marks: annotationMarks(),
      trigger: trigger,
      html: html,
      scrolls: scrolls,
      width: width,
      height: height
    };
    snapshotQueue.push(queueItem);
    scheduleDrain();
  }

  var drainScheduled = false;
  function scheduleDrain() {
    if (drainScheduled) return;
    drainScheduled = true;
    window.setTimeout(function () {
      drainScheduled = false;
      void drainSnapshots();
    }, 0);
  }

  function postBusy() {
    post({ type: 'recordBusy', capturing: rasterizing || snapshotQueue.length > 0, run: recordRun });
  }

  function drainSnapshots() {
    if (rasterizing) return;
    if (snapshotQueue.length === 0) return;
    var item = snapshotQueue.shift();
    rasterizing = true;
    postBusy();
    rasterizeSnapshot(item)
      .then(function (shot) {
        if (item.run !== recordRun) return;
        var step = {
          id: 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5),
          index: nextStepIndex,
          label: item.label,
          selector: item.selector,
          page: item.page,
          at: item.at,
          annotations: item.annotations,
          marks: item.marks,
          trigger: item.trigger,
          thumb: shot.data,
          width: shot.w,
          height: shot.h
        };
        nextStepIndex += 1;
        recordSteps.push(step);
        post({ type: 'recordStep', step: step, run: recordRun });
      }, function (error) {
        if (item.run === recordRun) post({ type: 'recordError', message: String(error && error.message ? error.message : error) });
      })
      .then(function () {
        rasterizing = false;
        postBusy();
        scheduleDrain();
      });
  }

  /** Rasterize one frozen HTML frame in a hidden iframe (same origin, no net). */
  function rasterizeSnapshot(item) {
    return ensureRasterizer().then(function (html2canvas) {
      return new Promise(function (resolve, reject) {
        var frame = document.createElement('iframe');
        frame.setAttribute('data-dsh-annot-ui', '1');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;left:-20000px;top:0;border:0;pointer-events:none;'
          + 'width:' + item.width + 'px;height:' + item.height + 'px';
        var settled = false;
        var timer = window.setTimeout(function () { done(new Error('快照渲染超时')); }, 10000);
        function done(error) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (frame.parentNode !== null) frame.parentNode.removeChild(frame);
          if (error) reject(error);
        }
        frame.onload = function () {
          window.setTimeout(function () {
            var doc = frame.contentDocument;
            if (doc === null) { done(new Error('快照不可用')); return; }
            var scrolls = Array.isArray(item.scrolls) ? item.scrolls : [];
            for (var cursor = 0; cursor < scrolls.length; cursor += 1) {
              var mark = scrolls[cursor];
              var target = mark.key === 'root' ? doc.scrollingElement : doc.querySelector('[data-dsh-scroll="' + mark.key + '"]');
              if (target !== null && target !== undefined) {
                target.scrollTop = mark.top;
                target.scrollLeft = mark.left;
              }
            }
            var scale = Math.min(0.8, 1100 / Math.max(item.width, item.height));
            html2canvas(doc.documentElement, {
              width: item.width,
              height: item.height,
              windowWidth: item.width,
              windowHeight: item.height,
              backgroundColor: '#ffffff',
              scale: scale,
              logging: false,
              useCORS: true
            }).then(function (canvas) {
              var data = canvas.toDataURL('image/png');
              done(null);
              resolve({ data: data, w: canvas.width, h: canvas.height });
            }, function (error) {
              done(null);
              reject(error);
            });
          }, 120);
        };
        document.body.appendChild(frame);
        try {
          frame.srcdoc = item.html;
        } catch (error) {
          done(error);
        }
      });
    });
  }

  /** One click = one queued frame; a second click flushes the first one first. */
  function queueClickSnapshot(label, selector, point) {
    if (pendingClick !== null) flushPendingClick();
    pendingClick = {
      run: recordRun,
      label: label,
      selector: selector,
      point: point,
      at: Date.now()
    };
    snapshotTimer = window.setTimeout(flushPendingClick, 150);
  }

  function flushPendingClick() {
    if (snapshotTimer !== null) {
      window.clearTimeout(snapshotTimer);
      snapshotTimer = null;
    }
    if (pendingClick === null) return;
    var capture = pendingClick;
    pendingClick = null;
    takeSnapshot(capture);
  }

  function snapshotsIdle() {
    return pendingClick === null && snapshotQueue.length === 0 && !rasterizing;
  }

  function waitForSnapshots(timeoutMs) {
    var deadline = Date.now() + timeoutMs;
    return new Promise(function (resolve) {
      (function check() {
        if (snapshotsIdle()) { resolve(true); return; }
        if (Date.now() >= deadline) { resolve(false); return; }
        window.setTimeout(check, 120);
      })();
    });
  }

  function startRecording() {
    recording = true;
    recordRun += 1;
    recordSteps = [];
    snapshotQueue = [];
    pendingClick = null;
    rasterizing = false;
    nextStepIndex = 0;
    lastChangeAt = Date.now();
    recordStartedAt = Date.now();
    post({ type: 'recordStarted', run: recordRun, title: document.title || '' });
    ensureRasterizer().catch(function () {
      post({ type: 'recordError', message: '截图组件加载失败，无法录制流程' });
    });
    takeSnapshot({ run: recordRun, label: '初始界面', selector: null, point: null });
    postBusy();
  }

  function stopRecording() {
    recording = false;
    flushPendingClick();
    var run = recordRun;
    waitForSnapshots(30000).then(function () {
      if (run !== recordRun) return;
      post({
        type: 'recordDone',
        steps: recordSteps.slice().sort(function (a, b) { return a.index - b.index; }),
        startedAt: recordStartedAt,
        run: run
      });
    });
  }

  /* ------------------------------------------------------------------ boot */

  function boot() {
    ensureChrome();
    /* The prototype's own state machine may flip overlays without any DOM
       change we can observe cheaply, so a low-frequency backstop keeps pins
       honest. It costs one visibility pass per second and only while needed. */
    window.setInterval(function () {
      if (annotations.length > 0) renderPins();
    }, 500);

    document.addEventListener('mousemove', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, { capture: true, passive: false });
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);

    window.addEventListener('resize', function () {
      scheduleRender();
      post({
        type: 'metrics',
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body !== null ? document.body.scrollWidth : 0),
        scrollHeight: Math.max(document.documentElement.scrollHeight, document.body !== null ? document.body.scrollHeight : 0)
      });
    });
    window.addEventListener('scroll', scheduleRender, true);

    var observer = new MutationObserver(function (records) {
      if (rendering) return;
      var oursOnly = true;
      for (var probe = 0; probe < records.length; probe += 1) {
        var probed = records[probe].target;
        if (probed === null || probed.nodeType !== 1 || overlay === null || !overlay.contains(probed)) {
          oursOnly = false;
          break;
        }
      }
      if (!oursOnly) lastChangeAt = Date.now();
      for (var index = 0; index < records.length; index += 1) {
        var target = records[index].target;
        if (target !== null && target.nodeType === 1 && overlay !== null && overlay.contains(target)) continue;
        var added = records[index].addedNodes;
        var onlyOurs = added.length > 0;
        for (var child = 0; child < added.length; child += 1) {
          var node = added[child];
          if (!(node.nodeType === 1 && overlay !== null && overlay.contains(node))) onlyOurs = false;
        }
        if (!onlyOurs) {
          scheduleRender();
          return;
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden', 'hidden', 'open'] });

    window.addEventListener('message', onMessage);
    post({
      type: 'ready',
      title: document.title || '',
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body !== null ? document.body.scrollWidth : 0),
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body !== null ? document.body.scrollHeight : 0)
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
