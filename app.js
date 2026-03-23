// ══════════════════════════════════════════════════════════
//  設定
// ══════════════════════════════════════════════════════════
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwkmtjTY17bFra0Q4dX4JGjbVUW4f6G1FPSCNbxttPJH3kD7tjuhxLA34XMF7_qMqtrFA/exec';

// JSONP API helper
function api(action, params) {
  params = params || {};
  return new Promise(function(resolve, reject) {
    var cbName = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    var url = new URL(SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', cbName);
    Object.keys(params).forEach(function(k) { url.searchParams.set(k, params[k]); });

    var timer = setTimeout(function() {
      delete window[cbName];
      reject(new Error('timeout'));
    }, 15000);

    window[cbName] = function(data) {
      clearTimeout(timer);
      delete window[cbName];
      if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
      resolve(data);
    };

    var sc = document.createElement('script');
    sc.src = url.toString();
    sc.onerror = function() {
      clearTimeout(timer);
      delete window[cbName];
      reject(new Error('script load error'));
    };
    document.head.appendChild(sc);
  });
}

function apiPost(action, body) {
  return api(action, { body: JSON.stringify(body) });
}

function showLoading(msg) {
  var el = document.getElementById('global-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loading';
    el.style.cssText = 'position:fixed;top:52px;left:0;right:0;background:var(--gold);color:white;text-align:center;padding:8px;font-size:13px;z-index:999;letter-spacing:1px;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
}
function hideLoading() {
  var el = document.getElementById('global-loading');
  if (el) el.style.display = 'none';
}
function showError(msg) {
  hideLoading();
  alert('⚠️ ' + msg);
}

// State
var state = {
  currentPanel: 0,
  member: null,
  selectedDate: null,
  selectedTime: null,
  pax: 2,
  cart: {},
  config: { advance_days: 2, open_days: '3,4,5', time_start: '13:00', time_end: '20:00', time_interval: 30 },
  menu: null
};

// INIT
document.addEventListener('DOMContentLoaded', function() {
  showLoading('載入系統設定…');
  Promise.all([api('getConfig'), api('getMenu')])
    .then(function(results) {
      var configRes = results[0], menuRes = results[1];
      if (configRes.success) state.config = Object.assign({}, state.config, configRes.config);
      if (menuRes.success) state.menu = menuRes.menu;
      hideLoading();
      buildDateGrid();
      buildMenus();
    })
    .catch(function(e) {
      console.warn('無法連線 Apps Script，使用預設菜單', e);
      state.menu = FALLBACK_MENU;
      hideLoading();
      buildDateGrid();
      buildMenus();
    });

  var input = document.getElementById('lookup-input');
  if (input) input.addEventListener('keydown', function(e) { if (e.key === 'Enter') lookupMember(); });
});

// Fallback menu
var FALLBACK_MENU = {
  coffee: [
    { name: '有機冰滴拿鐵（招牌）', price: 250 },
    { name: '有機冰滴咖啡', price: 250 },
    { name: '有機愛爾蘭拿鐵', price: 250 },
    { name: '有機黑糖拿鐵', price: 180 },
    { name: '有機棉花糖拿鐵', price: 180 },
    { name: '有機楓糖拿鐵', price: 180 },
    { name: '有機焦糖拿鐵', price: 180 },
    { name: '有機原味拿鐵', price: 180 },
    { name: '阿芙加朵（冰淇淋+濃縮）', price: 250 },
    { name: '有機美式咖啡', price: 160 },
    { name: '有機義式濃縮咖啡', price: 160 }
  ],
  tea: [
    { name: '有機智慧女神茶', price: 180 },
    { name: '有機維納斯美神茶', price: 180 },
    { name: '有機紓壓放鬆茶', price: 180 },
    { name: '有機南非醉茄茶（印度人蔘）', price: 180 },
    { name: '有機北美松葉茶', price: 180 },
    { name: '有機蓮花圓滿茶', price: 180 },
    { name: '有機南非國寶茶', price: 180 },
    { name: '有機日月潭紅玉（台茶18號）', price: 180 },
    { name: '有機英式伯爵茶', price: 140 },
    { name: '有機茉莉綠茶', price: 140 },
    { name: '有機牛蒡養生茶', price: 160 },
    { name: '有機山苦瓜平衡茶', price: 160 }
  ],
  food: [
    { name: '鷹嘴豆蛋沙拉三明治', price: 180 },
    { name: '鮪魚蘋果三明治', price: 180 },
    { name: '家常泡麵（辣）', price: 160 },
    { name: '綠色活氧蔬果汁', price: 190 },
    { name: '紅色元氣蔬果汁', price: 190 }
  ],
  energy: [
    { name: '經典紓壓能量球', price: 75, note: '3個 $190' },
    { name: '花生燕麥能量球', price: 60, note: '3個 $145，可混搭' },
    { name: '堅果巧克力能量球', price: 60, note: '3個 $145，可混搭' }
  ],
  snack: [
    { name: '經典爆米花－焦糖奶油', price: 100 },
    { name: '經典爆米花－鹹甜肉桂', price: 100 },
    { name: '紅豆紫米粥（溫熱）', price: 80 },
    { name: '花生杏仁湯（溫熱）', price: 80 },
    { name: '養生芝麻糊（溫熱）', price: 80 },
    { name: '冰淇淋', price: 120 },
    { name: '水果雪酪（限量）', price: 150 }
  ]
};

// Member lookup
function lookupMember() {
  var val = document.getElementById('lookup-input').value.trim();
  if (!val) return;
  showLoading('查詢會員資料…');
  api('lookupMember', { query: val })
    .then(function(res) {
      hideLoading();
      var found = document.getElementById('member-found');
      var notFound = document.getElementById('member-not-found');
      if (res.success) {
        state.member = res.member;
        document.getElementById('member-name').textContent = res.member.name;
        document.getElementById('member-avatar').textContent = res.member.name[0];
        document.getElementById('btn-step1').disabled = false;
        found.classList.add('show');
        notFound.style.display = 'none';
      } else {
        state.member = null;
        document.getElementById('btn-step1').disabled = true;
        found.classList.remove('show');
        notFound.style.display = 'block';
      }
    })
    .catch(function(e) {
      showError('無法連線，請稍後再試');
    });
}

// Date grid
function buildDateGrid() {
  var grid = document.getElementById('date-grid');
  var now = new Date();
  var days = ['日','一','二','三','四','五','六'];
  var months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var advanceDays = Number(state.config.advance_days) || 2;
  var openDays = String(state.config.open_days || '3,4,5').split(',').map(Number);
  grid.innerHTML = '';
  var count = 0;
  for (var i = advanceDays; i <= 60 && count < 9; i++) {
    var d = new Date(now);
    d.setDate(now.getDate() + i);
    var dow = d.getDay();
    var isOpen = openDays.indexOf(dow) !== -1;
    var dateStr = (d.getMonth()+1) + '/' + d.getDate();
    var btn = document.createElement('div');
    btn.className = 'date-btn' + (isOpen ? '' : ' disabled');
    btn.innerHTML = '<div class="dow">' + days[dow] + '</div><div class="d">' + d.getDate() + '</div><div class="mon">' + months[d.getMonth()] + '</div>';
    if (isOpen) (function(b, ds, dw) { b.onclick = function() { selectDate(b, ds, dw); }; })(btn, dateStr, days[dow]);
    grid.appendChild(btn);
    count++;
  }
}

function selectDate(btn, dateStr, dow) {
  document.querySelectorAll('.date-btn').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  state.selectedDate = dateStr + '（週' + dow + '）';
  buildTimeGrid();
  document.getElementById('time-card').style.display = 'block';
  document.getElementById('pax-card').style.display = 'none';
  state.selectedTime = null;
  document.querySelectorAll('.time-btn').forEach(function(t) { t.classList.remove('selected'); });
  document.getElementById('btn-step2').disabled = true;
}

function buildTimeGrid() {
  var grid = document.getElementById('time-grid');
  var interval = Number(state.config.time_interval) || 30;

  // Google Sheets 可能把時間存成小數（例如 0.541667 代表 13:00）
  // 需要處理字串格式 "13:00" 和數字格式兩種情況
  function toMinutes(val) {
    if (typeof val === 'string' && val.indexOf(':') !== -1) {
      var parts = val.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    if (typeof val === 'number' && val < 1) {
      // Sheets 時間小數：0 = 00:00, 0.5 = 12:00, 1 = 24:00
      return Math.round(val * 24 * 60);
    }
    return 13 * 60; // 預設 13:00
  }

  var startMin = toMinutes(state.config.time_start);
  var endMin   = toMinutes(state.config.time_end);

  // 防呆：若解析結果不合理，用預設值
  if (startMin < 0 || startMin > 1440) startMin = 13 * 60;
  if (endMin   < 0 || endMin   > 1440) endMin   = 20 * 60;

  grid.innerHTML = '';
  for (var m = startMin; m <= endMin; m += interval) {
    var hh = String(Math.floor(m/60)).padStart(2,'0');
    var mm = String(m%60).padStart(2,'0');
    var t = hh + ':' + mm;
    var btn = document.createElement('div');
    btn.className = 'time-btn';
    btn.textContent = t;
    (function(b, time) { b.onclick = function() { selectTime(b, time); }; })(btn, t);
    grid.appendChild(btn);
  }
}

function selectTime(btn, t) {
  document.querySelectorAll('.time-btn').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  state.selectedTime = t;
  document.getElementById('pax-card').style.display = 'block';
  checkStep2();
}

function changePax(d) {
  var max = Number(state.config.max_pax) || 12;
  state.pax = Math.max(1, Math.min(max, state.pax + d));
  document.getElementById('pax-num').textContent = state.pax;
  checkStep2();
}

function checkStep2() {
  document.getElementById('btn-step2').disabled = !(state.selectedDate && state.selectedTime);
}

// Menu
function buildMenus() {
  var menu = state.menu || FALLBACK_MENU;
  var catMap = { coffee:'menu-coffee', tea:'menu-tea', food:'menu-food', energy:'menu-energy', snack:'menu-snack' };
  Object.keys(catMap).forEach(function(cat) {
    buildMenuSection(menu[cat] || [], catMap[cat]);
  });
}

function buildMenuSection(items, containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(function(item) {
    var key = item.name;
    var div = document.createElement('div');
    div.className = 'menu-item';
    div.id = 'item-' + key;
    div.innerHTML =
      '<div class="menu-item-name">' + item.name +
      (item.note ? '<br><span style="font-size:11px;color:var(--soft);">' + item.note + '</span>' : '') +
      '</div>' +
      '<div class="menu-item-price">$' + item.price + '</div>' +
      '<div class="qty-ctrl">' +
        '<button class="qty-btn" onclick="changeQty(\'' + key + '\',' + item.price + ',-1);event.stopPropagation()">−</button>' +
        '<span class="qty-display" id="qty-' + key + '">0</span>' +
        '<button class="qty-btn" onclick="changeQty(\'' + key + '\',' + item.price + ',1);event.stopPropagation()">＋</button>' +
      '</div>';
    div.onclick = function() { changeQty(key, item.price, 1); };
    container.appendChild(div);
  });
}

function changeQty(key, price, delta) {
  var cur = state.cart[key] ? state.cart[key].qty : 0;
  var next = Math.max(0, cur + delta);
  if (next === 0) delete state.cart[key];
  else state.cart[key] = { name: key, qty: next, price: price };
  var el = document.getElementById('qty-' + key);
  if (el) el.textContent = next;
  var itemEl = document.getElementById('item-' + key);
  if (itemEl) itemEl.classList.toggle('in-cart', next > 0);
  updateOrderBar();
}

function updateOrderBar() {
  var total = 0, count = 0;
  Object.values(state.cart).forEach(function(v) { total += v.price * v.qty; count += v.qty; });
  document.getElementById('bar-count').textContent = count + ' 個品項';
  document.getElementById('bar-total').textContent = '$' + total;
}

// Panel navigation
function gotoPanel(n) {
  if (n === 3) buildConfirmDetail();
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('panel-' + n).classList.add('active');
  state.currentPanel = n;
  for (var i = 0; i < 4; i++) {
    var s = document.getElementById('step-' + i);
    if (!s) continue;
    s.classList.remove('active','done');
    if (i < n) s.classList.add('done');
    else if (i === n) s.classList.add('active');
  }
  document.getElementById('order-bar').style.display = n === 2 ? 'flex' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildConfirmDetail() {
  var cartHtml = Object.values(state.cart).length
    ? Object.values(state.cart).map(function(v) { return v.name + ' × ' + v.qty; }).join('、')
    : '（未點選任何餐飲）';
  var total = 0;
  Object.values(state.cart).forEach(function(v) { total += v.price * v.qty; });
  document.getElementById('confirm-detail').innerHTML =
    '<div class="confirm-row"><span class="label">姓名</span><span class="value">' + (state.member ? state.member.name : '—') + '</span></div>' +
    '<div class="confirm-row"><span class="label">日期</span><span class="value">' + (state.selectedDate || '—') + '</span></div>' +
    '<div class="confirm-row"><span class="label">時段</span><span class="value">' + (state.selectedTime || '—') + '</span></div>' +
    '<div class="confirm-row"><span class="label">人數</span><span class="value">' + state.pax + ' 位</span></div>' +
    '<div class="confirm-row"><span class="label">餐飲</span><span class="value" style="text-align:right;max-width:200px;">' + cartHtml + '</span></div>' +
    '<div class="confirm-row"><span class="label">預估金額</span><span class="value" style="color:var(--gold);">$' + total + '</span></div>';
}

// Submit reservation
function submitReservation() {
  var notes = document.getElementById('notes-input').value;
  var cartArr = Object.values(state.cart).map(function(v) { return { name: v.name, qty: v.qty, price: v.price }; });
  var total = 0;
  cartArr.forEach(function(v) { total += v.price * v.qty; });
  var body = {
    memberName:  state.member ? state.member.name  : '',
    memberEmail: state.member ? state.member.email : '',
    memberPhone: state.member ? state.member.phone : '',
    date:  state.selectedDate || '',
    time:  state.selectedTime || '',
    pax:   state.pax,
    cart:  cartArr,
    notes: notes
  };
  showLoading('送出預約中…');
  apiPost('submitReservation', body)
    .then(function(res) {
      hideLoading();
      if (!res.success) { showError(res.error || '送出失敗，請稍後再試'); return; }
      var cartHtml = cartArr.length
        ? cartArr.map(function(v) { return v.name + ' × ' + v.qty; }).join('、')
        : '（未點選餐飲）';
      document.getElementById('success-detail').innerHTML =
        '<div class="confirm-row"><span class="label">預約編號</span><span class="value" style="color:var(--gold);">' + res.orderId + '</span></div>' +
        '<div class="confirm-row"><span class="label">姓名</span><span class="value">' + body.memberName + '</span></div>' +
        '<div class="confirm-row"><span class="label">日期</span><span class="value">' + body.date + '</span></div>' +
        '<div class="confirm-row"><span class="label">時段</span><span class="value">' + body.time + '</span></div>' +
        '<div class="confirm-row"><span class="label">人數</span><span class="value">' + body.pax + ' 位</span></div>' +
        '<div class="confirm-row"><span class="label">餐飲</span><span class="value" style="text-align:right;">' + cartHtml + '</span></div>' +
        '<div class="confirm-row"><span class="label">預估金額</span><span class="value" style="color:var(--gold);">$' + total + '</span></div>';
      gotoPanel(4);
    })
    .catch(function(e) { showError('網路錯誤，請稍後再試'); });
}

function resetForm() {
  state.currentPanel = 0; state.member = null; state.selectedDate = null;
  state.selectedTime = null; state.pax = 2; state.cart = {};
  document.getElementById('lookup-input').value = '';
  document.getElementById('member-found').classList.remove('show');
  document.getElementById('member-not-found').style.display = 'none';
  document.getElementById('btn-step1').disabled = true;
  document.querySelectorAll('.date-btn').forEach(function(b) { b.classList.remove('selected'); });
  document.querySelectorAll('.time-btn').forEach(function(b) { b.classList.remove('selected'); });
  document.querySelectorAll('.menu-item').forEach(function(b) { b.classList.remove('in-cart'); });
  document.querySelectorAll('.qty-display').forEach(function(b) { b.textContent = '0'; });
  document.getElementById('pax-num').textContent = '2';
  document.getElementById('time-card').style.display = 'none';
  document.getElementById('pax-card').style.display = 'none';
  document.getElementById('notes-input').value = '';
  gotoPanel(0);
}
