/* DOMPET TAYE — aplikasi keuangan offline yang dapat diedit di VS Code.
   Tidak perlu instalasi library atau koneksi internet. */
(() => {
  'use strict';

  const USERNAME = 'taye123';
  const PASSWORD = 'taye123';
  const STORAGE_KEY = 'dompet-taye-mobile-v2';
  const OLD_KEYS = ['dompet-rapi-data-taye123', 'dompet-rapi-v1'];
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const rupiah = (value) => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);
  const isoToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const readableDate = (iso) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`));
  const validAmount = (n) => Number.isSafeInteger(Number(n)) && Number(n) > 0;
  const freshState = () => ({ openingBalance: 0, transactions: [] });
  let state = freshState();
  let signedIn = false;
  let storeWorks = false;
  let editing = null;
  let activeKind = 'all';
  let toastTimer;
  // Browser yang menolak localStorage tetap bisa menjalankan aplikasi sementara.
  const fallbackStore = new Map();

  function readStorage(key) {
    try { return localStorage.getItem(key); }
    catch (_) { return fallbackStore.get(key) || null; }
  }
  function writeStorage(key, value) {
    fallbackStore.set(key, value);
    try { localStorage.setItem(key, value); storeWorks = true; return true; }
    catch (_) { storeWorks = false; return false; }
  }
  function testStorage() {
    try { const key = '__dt_storage_test__'; localStorage.setItem(key, 'ok'); localStorage.removeItem(key); return true; }
    catch (_) { return false; }
  }
  function normalizeState(raw) {
    const clean = freshState();
    if (!raw || typeof raw !== 'object') return clean;
    const opening = Number(raw.openingBalance);
    clean.openingBalance = Number.isSafeInteger(opening) && opening >= 0 ? opening : 0;
    if (Array.isArray(raw.transactions)) {
      clean.transactions = raw.transactions.filter((t) => t && isDate(t.date) && validAmount(t.amount) && (t.type === 'income' || t.type === 'expense'))
        .map((t, index) => ({
          id: String(t.id || `old-${index}`),
          date: t.date,
          description: t.type === 'income' ? 'Tambah saldo' : String(t.description || 'Pengeluaran').slice(0, 150),
          amount: Number(t.amount),
          type: t.type,
          order: Number.isFinite(Number(t.order)) ? Number(t.order) : index + 1
        }));
    }
    return clean;
  }
  function loadData() {
    let saved = readStorage(STORAGE_KEY);
    if (saved === null) {
      for (const previousKey of OLD_KEYS) {
        const old = readStorage(previousKey);
        if (old !== null) { saved = old; break; }
      }
      if (saved !== null) writeStorage(STORAGE_KEY, saved);
    }
    try { state = normalizeState(saved ? JSON.parse(saved) : null); }
    catch (_) { state = freshState(); }
  }
  function saveData() {
    const result = writeStorage(STORAGE_KEY, JSON.stringify(state));
    $('#storageWarning').hidden = result;
    if (!result) toast('Penyimpanan browser dibatasi. Harap ekspor cadangan sebelum keluar.');
    return result;
  }
  function toast(message) {
    const target = $('#toast');
    target.textContent = message;
    target.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => target.classList.remove('show'), 3100);
  }
  function balance() { return state.openingBalance + state.transactions.reduce((n, t) => n + (t.type === 'income' ? t.amount : -t.amount), 0); }
  function incomeTotal() { return state.transactions.filter(t => t.type === 'income').reduce((n, t) => n + t.amount, 0); }
  function expenseTotal() { return state.transactions.filter(t => t.type === 'expense').reduce((n, t) => n + t.amount, 0); }
  function sortedRows() {
    let current = state.openingBalance;
    return [...state.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.id.localeCompare(b.id))
      .map(t => ({ ...t, remaining: (current += t.type === 'income' ? t.amount : -t.amount) }));
  }
  function nextOrder() { return Math.max(0, ...state.transactions.map(t => t.order || 0)) + 1; }
  function uniqueId() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

  function login(event) {
    event.preventDefault();
    const username = $('#username').value.trim().toLowerCase();
    const password = $('#password').value;
    if (username !== USERNAME || password !== PASSWORD) {
      $('#loginError').textContent = 'Username atau password salah. Coba lagi.';
      $('#loginError').hidden = false;
      return;
    }
    $('#loginError').hidden = true;
    signedIn = true;
    storeWorks = testStorage();
    loadData();
    $('#loginScreen').hidden = true;
    $('#appShell').hidden = false;
    $('#storageWarning').hidden = storeWorks;
    $('#password').value = '';
    $('#openingInput').value = state.openingBalance;
    $('#searchInput').value = '';
    $('#periodFilter').value = 'all';
    activeKind = 'all';
    $$('.segment').forEach(el => el.classList.toggle('active', el.dataset.kind === 'all'));
    setPage('home');
    render();
    toast('Berhasil masuk ke DOMPET TAYE!');
  }
  function logout() {
    signedIn = false;
    editing = null;
    state = freshState();
    $('#appShell').hidden = true;
    $('#loginScreen').hidden = false;
    $('#username').value = USERNAME;
    $('#password').value = '';
    $('#loginError').hidden = true;
    $('#password').focus();
  }
  function setPage(name) {
    if (!signedIn || !['home', 'history', 'settings'].includes(name)) return;
    $$('.page-section').forEach(el => { el.hidden = el.id !== `page-${name}`; });
    $$('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === name));
    if (name === 'settings') $('#openingInput').value = state.openingBalance;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function icon(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${id}`);
    svg.appendChild(use);
    return svg;
  }
  function span(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function addTransactionCard(row, target) {
    const article = span('article', 'transaction-item');
    const incoming = row.type === 'income';
    const mark = span('span', `transaction-icon ${incoming ? 'income' : 'expense'}`);
    mark.appendChild(icon(incoming ? 'arrowdown' : 'arrowup'));
    const main = span('div', 'transaction-main');
    main.append(span('strong', '', row.description), span('small', '', readableDate(row.date)));
    const end = span('div', 'transaction-end');
    const amount = span('div', 'transaction-amount');
    amount.append(span('strong', incoming ? 'positive' : 'negative', `${incoming ? '+' : '−'} ${rupiah(row.amount)}`), span('small', row.remaining < 0 ? 'low' : '', `Sisa ${rupiah(row.remaining)}`));
    const tools = span('div', 'row-tools');
    const edit = span('button', 'row-tool');
    edit.type = 'button'; edit.title = 'Edit transaksi'; edit.setAttribute('aria-label', `Edit ${row.description}`);
    edit.appendChild(icon('edit')); edit.addEventListener('click', () => editTransaction(row.id));
    const remove = span('button', 'row-tool danger');
    remove.type = 'button'; remove.title = 'Hapus transaksi'; remove.setAttribute('aria-label', `Hapus ${row.description}`);
    remove.appendChild(icon('trash')); remove.addEventListener('click', () => deleteTransaction(row.id));
    tools.append(edit, remove); end.append(amount, tools); article.append(mark, main, end); target.appendChild(article);
  }
  function paintTransactions(el, rows) {
    el.replaceChildren();
    if (!rows.length) {
      const empty = span('div', 'empty-state');
      empty.append(span('span', 'empty-emoji', '📝'), span('strong', '', 'Belum ada catatan'), span('span', '', 'Tambahkan saldo atau pengeluaran untuk mulai mencatat.'));
      el.appendChild(empty);
      return;
    }
    rows.forEach(r => addTransactionCard(r, el));
  }
  function render() {
    if (!signedIn) return;
    $('#balanceValue').textContent = rupiah(balance());
    $('#incomeValue').textContent = rupiah(incomeTotal());
    $('#expenseValue').textContent = rupiah(expenseTotal());
    $('#balanceStatus').textContent = balance() < 0 ? 'Saldo minus — cek pengeluaranmu' : 'Saldo terhitung otomatis';
    const d = new Date();
    $('#helloDate').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(d).toUpperCase();
    $('#monthLabel').textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
    const rows = sortedRows().reverse();
    paintTransactions($('#latestList'), rows.slice(0, 4));
    const search = $('#searchInput').value.trim().toLocaleLowerCase('id-ID');
    const byMonth = $('#periodFilter').value === 'month';
    const month = isoToday().slice(0, 7);
    const filtered = rows.filter(r => (activeKind === 'all' || r.type === activeKind)
      && (!byMonth || r.date.startsWith(month))
      && (!search || r.description.toLocaleLowerCase('id-ID').includes(search)));
    $('#historyCount').textContent = `${filtered.length} dari ${rows.length} transaksi`;
    paintTransactions($('#historyList'), filtered);
  }
  function closeModal(name) { const dialog = $(`#${name}`); if (dialog.open) dialog.close(); }
  function showModal(name) { const dialog = $(`#${name}`); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
  function updateIncomePreview() {
    const amt = Number($('#incomeAmount').value) || 0;
    const previous = editing && editing.type === 'income' ? editing.amount : 0;
    $('#incomePreview').textContent = rupiah(balance() - previous + amt);
  }
  function updateExpensePreview() {
    const amt = Number($('#expenseAmount').value) || 0;
    const previous = editing && editing.type === 'expense' ? editing.amount : 0;
    $('#expensePreview').textContent = rupiah(balance() + previous - amt);
  }
  function openIncome(row = null) {
    editing = row;
    $('#incomeDialogTitle').textContent = row ? 'Edit tambah saldo' : 'Tambah saldo';
    $('#incomeHelp').textContent = row ? 'Ubah nominal atau tanggal saldo masuk.' : 'Cukup isi jumlah. Keterangan otomatis “Tambah saldo” dan tanggal hari ini.';
    $('#incomeDateBox').hidden = !row;
    $('#incomeDate').value = row ? row.date : isoToday();
    $('#incomeAmount').value = row ? row.amount : '';
    $('#incomeSubmit').textContent = row ? 'Simpan perubahan' : 'Tambah saldo';
    updateIncomePreview();
    showModal('incomeDialog');
    $('#incomeAmount').focus();
  }
  function openExpense(row = null) {
    editing = row;
    $('#expenseDialogTitle').textContent = row ? 'Edit pengeluaran' : 'Catat pengeluaran';
    $('#expenseDate').value = row ? row.date : isoToday();
    $('#expenseDescription').value = row ? row.description : '';
    $('#expenseAmount').value = row ? row.amount : '';
    $('#expenseSubmit').textContent = row ? 'Simpan perubahan' : 'Simpan pengeluaran';
    updateExpensePreview();
    showModal('expenseDialog');
    (row ? $('#expenseAmount') : $('#expenseDescription')).focus();
  }
  function editTransaction(id) {
    const row = state.transactions.find(r => r.id === id);
    if (!row) return;
    row.type === 'income' ? openIncome(row) : openExpense(row);
  }
  function deleteTransaction(id) {
    const row = state.transactions.find(r => r.id === id);
    if (!row || !confirm(`Hapus ${row.description} sebesar ${rupiah(row.amount)}?`)) return;
    state.transactions = state.transactions.filter(r => r.id !== id);
    saveData(); render(); toast('Transaksi berhasil dihapus.');
  }
  function submitIncome(event) {
    event.preventDefault();
    const amount = Number($('#incomeAmount').value);
    if (!validAmount(amount)) { toast('Masukkan nominal saldo yang valid.'); return; }
    const editingRow = editing && state.transactions.find(r => r.id === editing.id);
    const date = editingRow ? $('#incomeDate').value : isoToday();
    if (!isDate(date)) { toast('Tanggal tidak valid.'); return; }
    if (editingRow) { editingRow.amount = amount; editingRow.date = date; }
    else state.transactions.push({ id: uniqueId(), date, description: 'Tambah saldo', amount, type: 'income', order: nextOrder() });
    saveData(); render(); closeModal('incomeDialog'); editing = null;
    toast(editingRow ? 'Tambah saldo diperbarui.' : 'Saldo bertambah dan masuk ke riwayat!');
  }
  function submitExpense(event) {
    event.preventDefault();
    const amount = Number($('#expenseAmount').value);
    const date = $('#expenseDate').value;
    const description = $('#expenseDescription').value.trim();
    if (!isDate(date) || !description || !validAmount(amount)) { toast('Lengkapi tanggal, keterangan dan nominal yang valid.'); return; }
    const editingRow = editing && state.transactions.find(r => r.id === editing.id);
    if (editingRow) Object.assign(editingRow, { date, description, amount });
    else state.transactions.push({ id: uniqueId(), date, description, amount, type: 'expense', order: nextOrder() });
    saveData(); render(); closeModal('expenseDialog'); editing = null;
    toast(editingRow ? 'Pengeluaran berhasil diperbarui.' : 'Pengeluaran berhasil masuk ke riwayat!');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function exportBackup() {
    const json = JSON.stringify({ app: 'DOMPET TAYE', version: 2, exportedAt: new Date().toISOString(), ...state }, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), `DOMPET_TAYE_BACKUP_${isoToday()}.json`);
    toast('Backup JSON berhasil disiapkan.');
  }
  async function restoreBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || !Array.isArray(raw.transactions) || !('openingBalance' in raw)) throw new Error('Format backup tidak dikenali');
      if (!confirm('Pulihkan backup ini? Data DOMPET TAYE yang saat ini ada akan diganti.')) return;
      state = normalizeState(raw);
      saveData(); render(); setPage('home');
      toast('Backup berhasil dipulihkan.');
    } catch (_) { toast('File backup tidak valid atau tidak dapat dibaca.'); }
    finally { event.target.value = ''; }
  }

  // Pembuat Excel asli (.xlsx) menggunakan XML Office Open XML dan ZIP tanpa library/CDN.
  const encoder = new TextEncoder();
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const inline = (ref, value, style = 0) => `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  const number = (ref, value, style = 3, formula = '') => `<c r="${ref}" s="${style}">${formula ? `<f>${esc(formula)}</f>` : ''}<v>${Number(value)}</v></c>`;
  const dateSerial = (date) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000);
  const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Catatan Keuangan" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="0" calcMode="auto" fullCalcOnLoad="1"/></workbook>';
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0;[Red](&quot;Rp&quot; #,##0)"/><numFmt numFmtId="165" formatCode="dd mmm yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/><color rgb="FF20375C"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF1B4BAE"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function worksheetXml() {
    const list = sortedRows(); const end = Math.max(9, list.length + 8);
    let lines = `<row r="1" ht="27" customHeight="1">${inline('A1', 'DOMPET TAYE — CATATAN KEUANGAN', 1)}</row>`;
    lines += `<row r="3">${inline('A3', 'Saldo awal', 1)}${number('B3', state.openingBalance, 5)}</row>`;
    lines += `<row r="4">${inline('A4', 'Uang masuk', 1)}${number('B4', incomeTotal(), 5, `SUM(D9:D${end})`)}</row>`;
    lines += `<row r="5">${inline('A5', 'Pengeluaran', 1)}${number('B5', expenseTotal(), 5, `SUM(E9:E${end})`)}</row>`;
    lines += `<row r="6">${inline('A6', 'Sisa uang', 1)}${number('B6', balance(), 5, 'B3+B4-B5')}</row>`;
    lines += `<row r="8" ht="24" customHeight="1">${inline('A8','Tanggal',2)}${inline('B8','Keterangan',2)}${inline('C8','Jenis',2)}${inline('D8','Uang Masuk (+)',2)}${inline('E8','Pengeluaran (-)',2)}${inline('F8','Sisa Uang',2)}</row>`;
    for (const [i, t] of list.entries()) {
      const r = i + 9; const incoming = t.type === 'income';
      lines += `<row r="${r}">${number(`A${r}`,dateSerial(t.date),4)}${inline(`B${r}`,t.description)}${inline(`C${r}`,incoming?'Uang masuk':'Pengeluaran')}${incoming?number(`D${r}`,t.amount):''}${!incoming?number(`E${r}`,t.amount):''}${number(`F${r}`,t.remaining,3,i?`F${r-1}+D${r}-E${r}`:`$B$3+D${r}-E${r}`)}</row>`;
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:F${Math.max(8,end)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="21" customWidth="1"/><col min="4" max="6" width="23" customWidth="1"/></cols><sheetData>${lines}</sheetData><mergeCells count="1"><mergeCell ref="A1:F1"/></mergeCells><autoFilter ref="A8:F${Math.max(8,end)}"/></worksheet>`;
  }
  const crcTable = (() => { const a = new Uint32Array(256); for (let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);a[i]=c>>>0;}return a; })();
  function crc32(data) { let c=0xffffffff; for(const b of data)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
  function zipEntries(files) {
    const local = [], central = []; let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameData=encoder.encode(name), data=encoder.encode(content), checksum=crc32(data);
      const lh=new Uint8Array(30+nameData.length),lv=new DataView(lh.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);
      lv.setUint32(14,checksum,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,nameData.length,true);lh.set(nameData,30);
      local.push(lh,data);
      const ch=new Uint8Array(46+nameData.length),cv=new DataView(ch.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);
      cv.setUint32(16,checksum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nameData.length,true);cv.setUint32(42,offset,true);ch.set(nameData,46);
      central.push(ch); offset += lh.length+data.length;
    }
    const centralSize=central.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),v=new DataView(end.buffer),count=central.length;
    v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function exportExcel() {
    if (!signedIn) return;
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': workbookXml,
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': stylesXml,
      'xl/worksheets/sheet1.xml': worksheetXml()
    };
    downloadBlob(zipEntries(files), `DOMPET_TAYE_${isoToday()}.xlsx`);
    toast('File Excel (.xlsx) berhasil disiapkan!');
  }

  // Semua tombol interaktif.
  $('#loginForm').addEventListener('submit', login);
  $('#togglePassword').addEventListener('click', () => {
    const inp=$('#password'); inp.type=inp.type==='password'?'text':'password';
  });
  $('#logoutBtn').addEventListener('click', logout);
  $$('[data-page]').forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.page)));
  $$('[data-open]').forEach(btn => btn.addEventListener('click', () => btn.dataset.open === 'income' ? openIncome() : openExpense()));
  $$('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  $('#incomeDialog').addEventListener('close', () => editing = null);
  $('#expenseDialog').addEventListener('close', () => editing = null);
  $('#incomeForm').addEventListener('submit', submitIncome);
  $('#expenseForm').addEventListener('submit', submitExpense);
  $('#incomeAmount').addEventListener('input', updateIncomePreview);
  $('#expenseAmount').addEventListener('input', updateExpensePreview);
  $('#openingForm').addEventListener('submit', event => {
    event.preventDefault();
    const amount=Number($('#openingInput').value);
    if (!(Number.isSafeInteger(amount) && amount >= 0)) { toast('Saldo awal tidak valid.'); return; }
    state.openingBalance=amount; saveData(); render(); toast('Saldo awal berhasil diperbarui.');
  });
  $('#searchInput').addEventListener('input', render);
  $('#periodFilter').addEventListener('change', render);
  $$('.segment').forEach(btn => btn.addEventListener('click', () => {
    activeKind=btn.dataset.kind;
    $$('.segment').forEach(el => el.classList.toggle('active', el===btn));
    render();
  }));
  ['headerExport','historyExport','settingsExcel'].forEach(id => $(`#${id}`).addEventListener('click', exportExcel));
  $('#backupBtn').addEventListener('click', exportBackup);
  $('#restoreBtn').addEventListener('click', () => $('#restoreFile').click());
  $('#restoreFile').addEventListener('change', restoreBackup);
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Hapus semua riwayat dan saldo awal DOMPET TAYE di browser ini?')) return;
    state=freshState();saveData();render();$('#openingInput').value=0;toast('Semua data berhasil dihapus.');
  });
})();
