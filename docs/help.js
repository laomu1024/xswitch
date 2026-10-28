// 复制按钮
document.querySelectorAll('.copy-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var code = btn.parentElement.querySelector('pre').innerText;
    var done = function () {
      btn.textContent = '已复制';
      setTimeout(function () { btn.textContent = '复制'; }, 1200);
    };
    navigator.clipboard.writeText(code).then(done).catch(function () {
      // 扩展页面剪贴板权限受限时退化为选区复制
      var range = document.createRange();
      range.selectNodeContents(btn.parentElement.querySelector('pre'));
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
      done();
    });
  });
});

// 目录滚动高亮
var links = document.querySelectorAll('#toc a');
var map = {};
links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
var observer = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) {
    if (e.isIntersecting && map[e.target.id]) {
      links.forEach(function (a) { a.classList.remove('active'); });
      map[e.target.id].classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });
document.querySelectorAll('section[id]').forEach(function (s) { observer.observe(s); });

// ---- 在线示例 Demo ----
(function () {
  var runBtn = document.getElementById('demo-run');
  if (!runBtn) return;

  // 去掉 JSONC 注释（跳过字符串内部），便于 JSON.parse
  function stripJsonc(text) {
    var out = '', inStr = false, esc = false, i = 0;
    while (i < text.length) {
      var c = text[i], n = text[i + 1];
      if (inStr) {
        out += c;
        if (esc) { esc = false; }
        else if (c === '\\') { esc = true; }
        else if (c === '"') { inStr = false; }
        i++; continue;
      }
      if (c === '"') { inStr = true; out += c; i++; continue; }
      if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') {
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2; continue;
      }
      out += c; i++;
    }
    return out;
  }

  // proxy/headers 模式：RE2 整条 URL 全匹配，默认忽略大小写，(?-i) 区分
  function dnrRegex(pattern) {
    var ci = true, p = pattern;
    if (p.indexOf('(?-i)') === 0) { ci = false; p = p.slice(5); }
    // RE2 不支持前后行断言等语法，浏览器会直接拒绝这类规则
    if (/\(\?[:=<!]/.test(p)) throw new Error('RE2 不支持该语法');
    return new RegExp('^(?:' + p + ')$', ci ? 'i' : '');
  }

  // cors 模式：urlFilter 子串 + * 通配，其余字符按字面
  function urlFilterRegex(pattern) {
    var parts = pattern.split('*').map(function (seg) {
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return new RegExp(parts.join('.*'), 'i');
  }

  function card(box, kind, title) {
    var el = document.createElement('div');
    el.className = 'demo-card ' + (kind === 'hit' ? 'demo-hit' : kind === 'err' ? 'demo-err' : 'demo-miss');
    var t = document.createElement('div');
    t.className = 'demo-card-title';
    t.textContent = title;
    el.appendChild(t);
    box.appendChild(el);
    return el;
  }

  function line(el, text, cls) {
    var d = document.createElement('div');
    d.className = 'demo-line' + (cls ? ' ' + cls : '');
    d.textContent = text;
    el.appendChild(d);
    return d;
  }

  function run() {
    var box = document.getElementById('demo-result');
    box.textContent = '';
    var config;
    try {
      config = JSON.parse(stripJsonc(document.getElementById('demo-config').value));
    } catch (e) {
      card(box, 'err', '配置解析失败').appendChild(document.createTextNode(e.message));
      return;
    }
    var url = document.getElementById('demo-url').value.trim();
    if (!url) return;

    // proxy：与 DNR 一致，第一个整条匹配的规则生效，不做链式改写
    var proxyCard = card(box, 'miss', '转发 proxy');
    line(proxyCard, '原始 URL：' + url);
    var redirected = null, proxyInvalid = [];
    var proxyRules = Array.isArray(config.proxy) ? config.proxy : [];
    for (var i = 0; i < proxyRules.length; i++) {
      var rule = proxyRules[i];
      if (!Array.isArray(rule) || !rule[0] || typeof rule[1] !== 'string') continue;
      try {
        var re = dnrRegex(rule[0]);
      } catch (e) {
        proxyInvalid.push('第 ' + (i + 1) + ' 条正则不合法（浏览器会跳过并显示红色 !）');
        continue;
      }
      if (re.test(url)) {
        redirected = url.replace(re, rule[1]);
        proxyCard.className = 'demo-card demo-hit';
        line(proxyCard, '命中第 ' + (i + 1) + ' 条：' + rule[0] + ' → ' + rule[1]);
        line(proxyCard, '最终 URL：' + redirected, 'demo-arrow');
        break;
      }
    }
    if (redirected === null) line(proxyCard, '无规则命中，请求按原 URL 发出');
    proxyInvalid.forEach(function (m) { line(proxyCard, m); });

    // cors：子串/通配命中即注入固定响应头
    var corsList = Array.isArray(config.cors) ? config.cors : [];
    var corsCard = card(box, 'miss', '跨域 cors');
    var corsHits = [];
    corsList.forEach(function (pattern, idx) {
      try {
        if (urlFilterRegex(String(pattern)).test(url)) corsHits.push('第 ' + (idx + 1) + ' 条「' + pattern + '」');
      } catch (e) { /* 非法模式忽略 */ }
    });
    if (corsHits.length) {
      corsCard.className = 'demo-card demo-hit';
      line(corsCard, '命中：' + corsHits.join('、'));
      line(corsCard, '响应将设置 Access-Control-Allow-Origin: * 等 4 个跨域头');
    } else {
      line(corsCard, corsList.length ? '无 cors 条目命中' : '未配置 cors 条目');
    }

    // headers：整条 URL 正则全匹配，列出将注入的请求头
    var headerList = Array.isArray(config.headers) ? config.headers : [];
    var headerCard = card(box, 'miss', '请求头 headers');
    var injected = [];
    headerList.forEach(function (rule, idx) {
      if (!Array.isArray(rule) || !rule[0] || !rule[1] || typeof rule[1] !== 'object') return;
      try {
        if (dnrRegex(rule[0]).test(url)) {
          Object.keys(rule[1]).forEach(function (name) {
            injected.push(name + ': ' + String(rule[1][name]));
          });
          line(headerCard, '命中第 ' + (idx + 1) + ' 条：' + rule[0]);
        }
      } catch (e) {
        line(headerCard, '第 ' + (idx + 1) + ' 条正则不合法（会被浏览器跳过）');
      }
    });
    if (injected.length) {
      headerCard.className = 'demo-card demo-hit';
      line(headerCard, '将注入请求头（覆盖同名头，URL 不变）：' + injected.join('，'));
    } else if (!headerList.length) {
      line(headerCard, '未配置 headers 条目');
    } else {
      line(headerCard, '无 headers 条目命中');
    }
  }

  runBtn.addEventListener('click', run);
})();
