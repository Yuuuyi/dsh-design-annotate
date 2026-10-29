/**
 * Design annotation — standalone export viewer.
 *
 * Inlined into the exported `.annotated.html` by the Host's `/annotate-api/export`
 * route, together with `window.__DSH_ANNOTATE_DATA__`. It is read-only: pins,
 * a note popover, and a collapsible index group the notes by flow state.
 *
 * This file must stay dependency-free and work from `file://`, so it inlines its
 * own styles and never touches the network.
 */
(function () {
  'use strict';

  if (window.__DSH_ANNOTATE_EXPORT__ === true) return;
  window.__DSH_ANNOTATE_EXPORT__ = true;

  var data = window.__DSH_ANNOTATE_DATA__;
  if (data === null || typeof data !== 'object' || !Array.isArray(data.annotations)) return;

  var annotations = data.annotations.filter(function (item) {
    return item !== null && typeof item === 'object' && typeof item.selector === 'string';
  });
  if (annotations.length === 0) return;

  var PIN = 22;
  var state = { activeId: null, drawer: false };
  var pinEls = Object.create(null);
  var layer = null;
  var pins = null;
  var popover = null;
  var drawer = null;
  var toolbar = null;
  var toolbarText = null;
  var rendering = false;

  /* ---------------------------------------------------------------- utilities */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolve(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function signatureOf(element) {
    var STATE_CLASS = /^(is-|has-)/;
    var STATE_EXACT = /^(active|open|opened|show|shown|visible|hidden|selected|current|on|off|expanded|collapsed|focus)$/;
    var style = window.getComputedStyle(element);
    var classes = [];
    if (element.classList) {
      for (var index = 0; index < element.classList.length; index += 1) {
        var name = element.classList[index];
        if (STATE_CLASS.test(name) || STATE_EXACT.test(name)) classes.push(name);
      }
      classes.sort();
    }
    return {
      ariaHidden: element.getAttribute ? element.getAttribute('aria-hidden') : null,
      hiddenAttr: element.hasAttribute('hidden') ? '1' : null,
      cls: classes,
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

  function inViewport(element) {
    var box = element.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) return false;
    return box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
  }

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
    return true;
  }

  function visibleNow(annotation) {
    var element = resolve(annotation.selector);
    if (element === null || element.getClientRects().length === 0) return false;
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

  /* -------------------------------------------------------------------- style */

  function injectStyle() {
    var style = document.createElement('style');
    style.setAttribute('data-dsh-annot-export', '1');
    style.textContent = [
      '.dsh-export-layer{position:fixed;inset:0;z-index:2147483000;pointer-events:none;',
      'font:500 12px/1.45 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",Arial,sans-serif;color:#1A1A1A}',
      '.dsh-export-pin{position:absolute;width:' + PIN + 'px;height:' + PIN + 'px;margin:-11px 0 0 -11px;border-radius:50%;',
      'border:2px solid #fff;background:#5F46C9;color:#fff;font:700 11px/1 inherit;display:flex;align-items:center;',
      'justify-content:center;pointer-events:auto;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.28);padding:0}',
      '.dsh-export-pin[data-active="1"]{background:#E4572E;transform:scale(1.12)}',
      '.dsh-export-pin[data-resolved="1"]{background:#9AA0AC}',
      '.dsh-export-flash{position:fixed;border:2px solid #E4572E;border-radius:4px;pointer-events:none;',
      'box-shadow:0 0 0 4px rgba(228,87,46,.18);transition:opacity .35s ease}',
      '.dsh-export-card{position:fixed;width:300px;max-width:calc(100vw - 24px);background:#fff;border-radius:10px;',
      'box-shadow:0 12px 36px rgba(0,0,0,.28);padding:12px;pointer-events:auto;display:none;z-index:2147483001}',
      '.dsh-export-card[data-open="1"]{display:block}',
      '.dsh-export-card-head{display:flex;align-items:center;gap:7px;margin-bottom:6px}',
      '.dsh-export-num{flex:none;width:20px;height:20px;border-radius:50%;background:#5F46C9;color:#fff;',
      'font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}',
      '.dsh-export-page{font-size:10.5px;color:#6E6E6E;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsh-export-close{margin-left:auto;border:0;background:transparent;cursor:pointer;color:#9AA0AC;font-size:14px;padding:0 2px}',
      '.dsh-export-note{font-size:12.5px;white-space:pre-wrap;word-break:break-word}',
      '.dsh-export-sel{margin-top:8px;font-size:10px;color:#9AA0AC;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsh-export-chip{display:inline-block;margin-top:8px;font-size:10px;padding:1px 7px;border-radius:999px;',
      'border:1px solid #E5E5E5;color:#6E6E6E}',
      '.dsh-export-chip--resolved{color:#1F9D55;border-color:#1F9D55}',
      '.dsh-export-toolbar{position:fixed;right:16px;bottom:16px;display:flex;gap:6px;pointer-events:auto}',
      '.dsh-export-btn{appearance:none;border:1px solid #E5E5E5;background:#fff;color:#1A1A1A;border-radius:999px;',
      'padding:7px 13px;font-size:12px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.14);font-family:inherit}',
      '.dsh-export-btn:hover{border-color:#BEBEBE}',
      '.dsh-export-drawer{position:fixed;right:16px;bottom:60px;width:320px;max-width:calc(100vw - 32px);',
      'max-height:min(60vh,520px);background:#fff;border-radius:12px;box-shadow:0 16px 44px rgba(0,0,0,.26);',
      'display:none;flex-direction:column;overflow:hidden;pointer-events:auto;z-index:2147483001}',
      '.dsh-export-drawer[data-open="1"]{display:flex}',
      '.dsh-export-drawer-head{padding:10px 12px;border-bottom:1px solid #EEE;display:flex;align-items:center;gap:8px;',
      'font-weight:600;font-size:12px}',
      '.dsh-export-drawer-body{overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:6px}',
      '.dsh-export-group{font-size:10px;color:#9AA0AC;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:4px 4px 0}',
      '.dsh-export-item{display:flex;gap:8px;align-items:flex-start;border:1px solid #EEE;border-radius:9px;padding:8px;',
      'cursor:pointer;background:#fff;text-align:left;font-family:inherit;color:inherit}',
      '.dsh-export-item:hover{border-color:#CFCFCF}',
      '.dsh-export-item[data-active="1"]{border-color:#5F46C9;box-shadow:0 0 0 1px #5F46C9}',
      '.dsh-export-item[data-resolved="1"]{opacity:.65}',
      '.dsh-export-item-note{font-size:11.5px;white-space:pre-wrap;word-break:break-word;margin-top:2px}',
      '.dsh-export-item-sel{font-size:9.5px;color:#9AA0AC;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dsh-export-hidden{color:#C28B00;font-size:9.5px;margin-top:3px}'
    ].join('');
    document.documentElement.appendChild(style);
  }

  /* -------------------------------------------------------------------- render */

  function ensureChrome() {
    if (layer !== null) return;
    injectStyle();
    layer = document.createElement('div');
    layer.className = 'dsh-export-layer';
    layer.setAttribute('data-dsh-annot-export-ui', '1');
    pins = document.createElement('div');
    pins.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    layer.appendChild(pins);

    popover = document.createElement('div');
    popover.className = 'dsh-export-card';
    popover.setAttribute('data-dsh-annot-export-ui', '1');

    toolbar = document.createElement('div');
    toolbar.className = 'dsh-export-toolbar';
    toolbarText = document.createElement('button');
    toolbarText.type = 'button';
    toolbarText.className = 'dsh-export-btn';
    toolbarText.addEventListener('click', function () {
      state.drawer = !state.drawer;
      paintDrawer();
    });
    toolbar.appendChild(toolbarText);

    drawer = document.createElement('div');
    drawer.className = 'dsh-export-drawer';
    drawer.setAttribute('data-dsh-annot-export-ui', '1');

    document.body.appendChild(layer);
    document.body.appendChild(popover);
    document.body.appendChild(toolbar);
    document.body.appendChild(drawer);
    toolbarText.textContent = '标注 ' + annotations.length + ' 条';
  }

  function placePin(element, annotation, index) {
    var box = element.getBoundingClientRect();
    var pin = pinEls[annotation.id];
    if (pin === undefined || pin.parentNode !== pins) {
      pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'dsh-export-pin';
      pin.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openCard(annotation, index);
      });
      pins.appendChild(pin);
      pinEls[annotation.id] = pin;
    }
    pin.textContent = String(index + 1);
    pin.title = annotation.note || '';
    pin.style.left = Math.min(window.innerWidth - 14, Math.max(14, box.right - 4)) + 'px';
    pin.style.top = Math.min(window.innerHeight - 14, Math.max(14, box.top + 4)) + 'px';
    pin.setAttribute('data-active', state.activeId === annotation.id ? '1' : '0');
    pin.setAttribute('data-resolved', annotation.status === 'resolved' ? '1' : '0');
  }

  function render() {
    if (document.body === null) return;
    ensureChrome();
    rendering = true;
    var seen = Object.create(null);
    for (var index = 0; index < annotations.length; index += 1) {
      var annotation = annotations[index];
      if (!visibleNow(annotation)) continue;
      var element = resolve(annotation.selector);
      if (element === null) continue;
      seen[annotation.id] = true;
      placePin(element, annotation, index);
    }
    for (var id in pinEls) {
      if (seen[id] !== true) {
        var stale = pinEls[id];
        if (stale.parentNode !== null) stale.parentNode.removeChild(stale);
        delete pinEls[id];
      }
    }
    rendering = false;
    if (state.drawer) paintDrawer();
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      render();
    });
  }

  /* ---------------------------------------------------------------------- card */

  function openCard(annotation, index) {
    state.activeId = annotation.id;
    render();
    var element = resolve(annotation.selector);
    if (element === null) return;
    var box = element.getBoundingClientRect();
    var width = 300;
    var left = Math.min(window.innerWidth - width - 12, Math.max(12, box.right + 10));
    var top = Math.min(window.innerHeight - 160, Math.max(12, box.top));
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
    popover.innerHTML = '<div class="dsh-export-card-head">'
      + '<span class="dsh-export-num">' + (index + 1) + '</span>'
      + '<span class="dsh-export-page">' + escapeHtml(annotation.page || '页面') + '</span>'
      + '<button type="button" class="dsh-export-close" aria-label="关闭">×</button>'
      + '</div>'
      + '<div class="dsh-export-note">' + escapeHtml(annotation.note || '') + '</div>'
      + '<div class="dsh-export-sel">' + escapeHtml(annotation.selector) + '</div>'
      + '<span class="dsh-export-chip' + (annotation.status === 'resolved' ? ' dsh-export-chip--resolved' : '') + '">'
      + (annotation.status === 'resolved' ? '已解决' : '待处理') + '</span>';
    popover.setAttribute('data-open', '1');
    var close = popover.querySelector('.dsh-export-close');
    if (close !== null) {
      close.addEventListener('click', function () {
        popover.setAttribute('data-open', '0');
        state.activeId = null;
        render();
      });
    }
  }

  function focusAnnotation(annotation, index) {
    var element = resolve(annotation.selector);
    state.activeId = annotation.id;
    if (element === null) {
      render();
      return;
    }
    try {
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    } catch (error) {
      element.scrollIntoView();
    }
    var box = element.getBoundingClientRect();
    var flash = document.createElement('div');
    flash.className = 'dsh-export-flash';
    flash.style.left = box.left + 'px';
    flash.style.top = box.top + 'px';
    flash.style.width = box.width + 'px';
    flash.style.height = box.height + 'px';
    document.body.appendChild(flash);
    window.setTimeout(function () { flash.style.opacity = '0'; }, 900);
    window.setTimeout(function () {
      if (flash.parentNode !== null) flash.parentNode.removeChild(flash);
    }, 1400);
    openCard(annotation, index);
  }

  /* -------------------------------------------------------------------- drawer */

  function paintDrawer() {
    if (drawer === null) return;
    drawer.setAttribute('data-open', state.drawer ? '1' : '0');
    if (!state.drawer) return;
    var groups = [];
    var indexOfGroup = {};
    for (var index = 0; index < annotations.length; index += 1) {
      var annotation = annotations[index];
      var label = annotation.page === '' || annotation.page === undefined ? '页面' : annotation.page;
      if (indexOfGroup[label] === undefined) {
        indexOfGroup[label] = groups.length;
        groups.push({ label: label, items: [] });
      }
      groups[indexOfGroup[label]].items.push({ annotation: annotation, index: index });
    }
    var html = '<div class="dsh-export-drawer-head">'
      + '<span>标注 · ' + annotations.length + ' 条</span>'
      + '<span style="margin-left:auto;font-size:10.5px;color:#9AA0AC;font-weight:400">只读预览</span>'
      + '</div><div class="dsh-export-drawer-body">';
    for (var groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      var group = groups[groupIndex];
      html += '<div class="dsh-export-group">' + escapeHtml(group.label) + ' · ' + group.items.length + '</div>';
      for (var itemIndex = 0; itemIndex < group.items.length; itemIndex += 1) {
        var entry = group.items[itemIndex];
        var visible = visibleNow(entry.annotation);
        html += '<button type="button" class="dsh-export-item" data-id="' + escapeHtml(entry.annotation.id) + '"'
          + ' data-index="' + entry.index + '"'
          + (state.activeId === entry.annotation.id ? ' data-active="1"' : '')
          + (entry.annotation.status === 'resolved' ? ' data-resolved="1"' : '') + '>'
          + '<span class="dsh-export-num">' + (entry.index + 1) + '</span>'
          + '<span style="min-width:0;flex:1 1 auto">'
          + '<span class="dsh-export-item-sel">' + escapeHtml(entry.annotation.selector) + '</span>'
          + '<span class="dsh-export-item-note">' + escapeHtml(entry.annotation.note || '') + '</span>'
          + (visible ? '' : '<span class="dsh-export-hidden">当前状态不可见</span>')
          + '</span></button>';
      }
    }
    html += '</div>';
    drawer.innerHTML = html;
    var buttons = drawer.querySelectorAll('.dsh-export-item');
    for (var hit = 0; hit < buttons.length; hit += 1) {
      buttons[hit].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var at = Number(this.getAttribute('data-index'));
        for (var scan = 0; scan < annotations.length; scan += 1) {
          if (annotations[scan].id === id) {
            focusAnnotation(annotations[scan], at);
            break;
          }
        }
      });
    }
  }

  /* ---------------------------------------------------------------------- boot */

  function boot() {
    ensureChrome();
    render();
    paintDrawer();
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      state.drawer = false;
      state.activeId = null;
      if (popover !== null) popover.setAttribute('data-open', '0');
      paintDrawer();
      render();
    });
    document.addEventListener('click', function (event) {
      if (popover === null || popover.getAttribute('data-open') !== '1') return;
      var target = event.target;
      if (target === null || target.nodeType !== 1) return;
      if (popover.contains(target)) return;
      if (target.classList && target.classList.contains('dsh-export-pin')) return;
      popover.setAttribute('data-open', '0');
      state.activeId = null;
      render();
    }, true);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    var observer = new MutationObserver(function (records) {
      if (rendering) return;
      for (var index = 0; index < records.length; index += 1) {
        var target = records[index].target;
        if (target !== null && target.nodeType === 1 && target.hasAttribute('data-dsh-annot-export-ui')) continue;
        schedule();
        return;
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'hidden', 'open']
    });
    window.setInterval(render, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
