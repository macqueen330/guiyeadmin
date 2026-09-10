/*!
 * GUIYE 官网埋点脚本 —— 给 guiyecy.com 用。
 *
 * 一行接入（放在 </body> 前）：
 *   <script defer src="https://<后台域名>/guiye-track.js"
 *           data-endpoint="https://<后台域名>/api/analytics/collect"></script>
 *
 * 它把事件打到后台的 /api/analytics/collect，落进 web_events，再由
 * gy_rollup_web_day() 汇总，供后台「数据分析 → 官网数据」展示。
 *
 * 与 Vercel Web Analytics 的分工：
 *   * Vercel Analytics 给 Vercel 控制台看的实时 PV/UV，装上即用，但**数据取不出来**
 *     （@vercel/analytics 只有 inject/track/pageview，没有任何读取接口）。
 *   * 这个脚本给的是你自己库里的一方数据，能和订单表关联、能做单品漏斗。
 *   两者可以同时装，互不影响。
 *
 * 自动采集：page_view、page_leave（带停留秒数）、SPA 路由切换。
 * 手动埋点：window.guiye.track('add_cart', { product_id: 'p-1' })
 *
 * 商品详情页请标出当前商品，page_view / page_leave 会自动带上它 ——
 * 后台「单品分析」的平均停留就靠这个：
 *   <body data-gy-product="sample-p-1">
 * 或者 <meta name="gy-product" content="sample-p-1">
 *
 * 地域不在这里采集：浏览器拿不到，也不该为此索要定位权限。
 * 服务端会从托管商的请求头（Vercel / Cloudflare）补上国家、省份、城市。
 *
 * 不使用 Cookie；visitor_id 存 localStorage，session_id 存 sessionStorage。
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var ENDPOINT =
    (script && script.getAttribute("data-endpoint")) ||
    (script && script.src.replace(/\/guiye-track\.js.*$/, "/api/analytics/collect")) ||
    "/api/analytics/collect";
  var TOKEN = script && script.getAttribute("data-token");

  // 后台 web_event_types 里的白名单。不在其中的事件服务端会直接丢弃，
  // 所以这里先挡一道，省一次无效请求。
  var ALLOWED = [
    "page_view", "page_leave",
    "product_impression", "product_click", "product_view",
    "add_cart", "checkout", "order_submit", "purchase",
    "inquiry", "download", "wechat_click", "whatsapp_click",
    "video_play", "video_complete", "story_click",
  ];

  // ---- 身份 ---------------------------------------------------------------
  function uid() {
    try {
      return crypto.randomUUID();
    } catch (_e) {
      return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }
  }
  function stored(store, key) {
    try {
      var v = store.getItem(key);
      if (!v) { v = uid(); store.setItem(key, v); }
      return v;
    } catch (_e) {
      return uid(); // 隐私模式 / 禁用存储时退化为一次性 id
    }
  }
  var visitorId = stored(window.localStorage, "gy_vid");
  var sessionId = stored(window.sessionStorage, "gy_sid");

  // ---- 设备与来源 ----------------------------------------------------------
  function device() {
    var w = window.innerWidth || 1024;
    var touch = "ontouchstart" in window;
    if (w < 768 && touch) return "mobile";
    if (w < 1180 && touch) return "tablet";
    return "desktop";
  }

  /**
   * 当前页面对应的商品 id。商品详情页在 <body data-gy-product> 或
   * <meta name="gy-product"> 里标出来即可 —— page_view / page_leave 会自动带上，
   * 后台的单品停留时长依赖它。以前 page_leave 从不带 product_id，
   * 于是「平均停留」永远是空的。
   */
  function currentProduct() {
    try {
      var b = document.body && document.body.getAttribute("data-gy-product");
      if (b) return b;
      var m = document.querySelector('meta[name="gy-product"]');
      return (m && m.getAttribute("content")) || null;
    } catch (_e) {
      return null;
    }
  }

  /** 优先看 utm_source，其次按 referrer 归类；都没有算直接访问。 */
  function source() {
    try {
      var utm = new URLSearchParams(location.search).get("utm_source");
      if (utm) return utm.toLowerCase().slice(0, 40);
      var r = document.referrer;
      if (!r) return "direct";
      var h = new URL(r).hostname.replace(/^www\./, "");
      if (h === location.hostname) return null;                 // 站内跳转不算来源
      if (/xiaohongshu|xhslink/.test(h)) return "xhs";
      if (/weixin|qq\.com/.test(h)) return "wechat";
      if (/instagram/.test(h)) return "instagram";
      if (/whatsapp/.test(h)) return "whatsapp";
      if (/google|bing|baidu|duckduckgo|yahoo/.test(h)) return "search";
      return h.slice(0, 40);
    } catch (_e) {
      return "direct";
    }
  }

  // ---- 发送 ---------------------------------------------------------------
  var queue = [];
  var timer = null;

  function flush(sync) {
    if (queue.length === 0) return;
    var payload = JSON.stringify({
      visitor_id: visitorId,
      session_id: sessionId,
      events: queue.splice(0, 50), // 服务端单次上限 50 条
    });
    // 关页面时用 sendBeacon，浏览器会保证发出去
    if (sync && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
        return;
      } catch (_e) { /* 落到 fetch */ }
    }
    var headers = { "Content-Type": "application/json" };
    if (TOKEN) headers["x-guiye-token"] = TOKEN;
    try {
      fetch(ENDPOINT, { method: "POST", headers: headers, body: payload, keepalive: true, mode: "cors" })
        .catch(function () {});
    } catch (_e) { /* 埋点失败绝不能影响页面 */ }
  }

  function push(eventKey, props) {
    if (ALLOWED.indexOf(eventKey) === -1) {
      if (window.console && console.warn) console.warn("[guiye-track] 未知事件，已忽略:", eventKey);
      return;
    }
    var src = source();
    var e = {
      event_key: eventKey,
      occurred_at: new Date().toISOString(),
      page_path: location.pathname,
      page_title: document.title,
      referrer: document.referrer || null,
      device: device(),
    };
    if (src) e.source = src;
    var pid = currentProduct();
    if (pid) e.product_id = pid;
    // 显式传入的 props 优先于页面上标注的商品
    if (props) for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) e[k] = props[k];
    queue.push(e);

    clearTimeout(timer);
    timer = setTimeout(flush, 800); // 攒一小会儿再发，减少请求数
  }

  // ---- 自动：页面浏览 + 停留时长 --------------------------------------------
  var enteredAt = Date.now();
  var lastPath = null;

  function pageView() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    enteredAt = Date.now();
    push("page_view");
  }

  function pageLeave() {
    var sec = Math.round((Date.now() - enteredAt) / 1000);
    if (sec < 1 || sec > 3600) return;      // 明显不合理的停留不上报
    push("page_leave", { value: sec });     // 汇总函数读的就是这个 value
  }

  pageView();

  // SPA 路由：pushState / replaceState / 前进后退
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      pageLeave();
      var r = orig.apply(this, arguments);
      pageView();
      return r;
    };
  });
  window.addEventListener("popstate", function () { pageLeave(); pageView(); });

  // 关闭 / 切到后台时结算停留并强制发出
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { pageLeave(); flush(true); }
  });
  window.addEventListener("pagehide", function () { pageLeave(); flush(true); });

  // ---- 自动：带 data-gy-* 标记的元素 ----------------------------------------
  // 用法：<a data-gy-event="product_click" data-gy-product="sample-p-1">买它</a>
  document.addEventListener(
    "click",
    function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest("[data-gy-event]");
      if (!el) return;
      var props = {};
      var pid = el.getAttribute("data-gy-product");
      if (pid) props.product_id = pid;
      var val = el.getAttribute("data-gy-value");
      if (val) props.value = Number(val);
      push(el.getAttribute("data-gy-event"), props);
    },
    true,
  );

  // ---- 手动 API ------------------------------------------------------------
  window.guiye = window.guiye || {};
  window.guiye.track = push;
  window.guiye.flush = function () { flush(false); };
  window.guiye.visitorId = visitorId;
  window.guiye.sessionId = sessionId;
})();
