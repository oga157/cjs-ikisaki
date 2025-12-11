// ログイン関連
let loginAttempts = 0;
let lockUntil = null;

// API Base URL
const API_BASE = window.location.origin;

// グローバル変数
let employees = [];
let selectedEmployeeIds = new Set();
let appSettings = { auto_refresh_minutes: 0 };
let currentEditingEmployeeId = null;
let historySelectedIndex = -1;

// DOM要素
const employeeTableBody = document.getElementById('employeeTableBody');
const selectAllCheckbox = document.getElementById('selectAll');
const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
const bulkForm = document.getElementById('bulkForm');
const bulkDestination = document.getElementById('bulkDestination');
const historyDropdown = document.getElementById('historyDropdown');
const loading = document.getElementById('loading');
const message = document.getElementById('message');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginCode = document.getElementById('loginCode');
const loginError = document.getElementById('loginError');
const loginLockMessage = document.getElementById('loginLockMessage');
const mainContent = document.getElementById('mainContent');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadSettings();
  loadEmployees();
  setupEventListeners();
});

// 認証後の初期化
function initializeApp() {
  loadSettings();
  loadEmployees();
  setupEventListeners();
}

// ========================================
// 認証関連
// ========================================

// 認証チェック
function checkAuth() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  
  if (isLoggedIn === 'true') {
    // ログイン済み
    showMainContent();
  } else {
    // 未ログイン
    showLoginModal();
  }
}

// ログインモーダル表示
function showLoginModal() {
  loginModal.style.display = 'flex';
  mainContent.style.display = 'none';
  loginCode.focus();
}

// メインコンテンツ表示
function showMainContent() {
  loginModal.style.display = 'none';
  mainContent.style.display = 'block';
  initializeApp();
}

// ログイン処理
async function handleLogin(e) {
  e.preventDefault();
  
  // ロック中チェック
  if (lockUntil && Date.now() < lockUntil) {
    const remainingSeconds = Math.ceil((lockUntil - Date.now()) / 1000);
    loginLockMessage.textContent = `${remainingSeconds}秒後に再試行できます`;
    loginLockMessage.classList.add('show');
    return;
  }
  
  const code = loginCode.value.trim();
  
  if (!code) {
    loginError.textContent = 'ログインコードを入力してください';
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // ログイン成功
      sessionStorage.setItem('isLoggedIn', 'true');
      loginAttempts = 0;
      loginError.textContent = '';
      loginLockMessage.classList.remove('show');
      loginCode.value = '';
      showMainContent();
    } else {
      // ログイン失敗
      loginAttempts++;
      loginError.textContent = data.error || 'ログインに失敗しました';
      loginCode.value = '';
      loginCode.focus();
      
      // 5回失敗でロック
      if (loginAttempts >= 5) {
        lockUntil = Date.now() + 30000; // 30秒ロック
        loginLockMessage.textContent = '5回失敗しました。30秒後に再試行できます';
        loginLockMessage.classList.add('show');
        loginError.textContent = '';
        
        // カウントダウン表示
        const countdown = setInterval(() => {
          if (Date.now() >= lockUntil) {
            clearInterval(countdown);
            loginLockMessage.classList.remove('show');
            loginAttempts = 0;
            lockUntil = null;
          } else {
            const remainingSeconds = Math.ceil((lockUntil - Date.now()) / 1000);
            loginLockMessage.textContent = `${remainingSeconds}秒後に再試行できます`;
          }
        }, 1000);
      }
    }
  } catch (error) {
    console.error(error);
    loginError.textContent = 'エラーが発生しました';
  }
}

// ログインフォームのイベントリスナー
loginForm.addEventListener('submit', handleLogin);

// イベントリスナー設定
function setupEventListeners() {
  // 全選択チェックボックス
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  
  // 一括更新フォーム
  bulkForm.addEventListener('submit', handleBulkUpdate);
  
  // 行き先入力フォーカス時に履歴を表示
  bulkDestination.addEventListener('focus', () => {
    historySelectedIndex = -1; // リセット
    showHistoryForBulk();
  });
  bulkDestination.addEventListener('input', () => {
    historySelectedIndex = -1; // リセット
    showHistoryForBulk();
  });
  
  // 行き先入力欄でキー操作
  bulkDestination.addEventListener('keydown', handleHistoryKeydown);
  
  // 戻り入力欄にフォーカス時に履歴を閉じる
  document.getElementById('bulkReturn').addEventListener('focus', () => {
    historyDropdown.classList.remove('show');
    historySelectedIndex = -1;
  });
  
  // 履歴ドロップダウン外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.history-group')) {
      historyDropdown.classList.remove('show');
      historySelectedIndex = -1;
    }
  });
}

// 履歴のキーボード操作ハンドラ
function handleHistoryKeydown(e) {
  const isHistoryOpen = historyDropdown.classList.contains('show');
  const historyItems = historyDropdown.querySelectorAll('.history-item[data-destination]');
  
  if (!isHistoryOpen || historyItems.length === 0) {
    // 履歴が開いていない、または項目がない場合
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('bulkReturn').focus();
      historyDropdown.classList.remove('show');
    }
    return;
  }
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      // 下へ移動
      historySelectedIndex = Math.min(historySelectedIndex + 1, historyItems.length - 1);
      updateHistorySelection(historyItems);
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      // 上へ移動
      historySelectedIndex = Math.max(historySelectedIndex - 1, 0);
      updateHistorySelection(historyItems);
      break;
      
    case 'Tab':
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: 上へ移動
        historySelectedIndex = Math.max(historySelectedIndex - 1, 0);
      } else {
        // Tab: 下へ移動
        historySelectedIndex = Math.min(historySelectedIndex + 1, historyItems.length - 1);
      }
      updateHistorySelection(historyItems);
      break;
      
    case 'Enter':
      e.preventDefault();
      // 選択を確定
      if (historySelectedIndex >= 0 && historySelectedIndex < historyItems.length) {
        const selectedItem = historyItems[historySelectedIndex];
        bulkDestination.value = selectedItem.dataset.destination;
        historyDropdown.classList.remove('show');
        document.getElementById('bulkReturn').focus();
        historySelectedIndex = -1;
      } else {
        // 何も選択されていない場合は戻り入力欄へ移動
        document.getElementById('bulkReturn').focus();
        historyDropdown.classList.remove('show');
      }
      break;
      
    case 'Escape':
      e.preventDefault();
      // 履歴を閉じる
      historyDropdown.classList.remove('show');
      historySelectedIndex = -1;
      break;
  }
}

// 履歴の選択状態を更新
function updateHistorySelection(historyItems) {
  // すべての選択を解除
  historyItems.forEach(item => item.classList.remove('selected'));
  
  // 現在の選択を適用
  if (historySelectedIndex >= 0 && historySelectedIndex < historyItems.length) {
    const selectedItem = historyItems[historySelectedIndex];
    selectedItem.classList.add('selected');
    
    // スクロールして選択項目を表示
    selectedItem.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }
}

async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/settings`);
    if (response.ok) {
      appSettings = await response.json();
      console.log('設定読み込み:', appSettings);
    }
  } catch (error) {
    console.error('設定の読み込みエラー:', error);
  }
}

// 社員データ読み込み
async function loadEmployees() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE}/api/whereabouts`);
    if (!response.ok) throw new Error('データの取得に失敗しました');
    
    employees = await response.json();
    renderEmployeeTable();
    showMessage('データを読み込みました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// テーブル描画
function renderEmployeeTable() {
  employeeTableBody.innerHTML = '';
  
  employees.forEach(emp => {
    const row = document.createElement('tr');
    const isSelected = selectedEmployeeIds.has(emp.id);
    const isPresent = !emp.destination || emp.destination.trim() === '';
    
    // 設定日時のフォーマット
    const setAt = emp.set_at ? formatDateTime(emp.set_at) : '-';
    
    row.innerHTML = `
      <td class="checkbox-col">
        <input 
          type="checkbox" 
          class="employee-checkbox" 
          data-employee-id="${emp.id}"
          ${isSelected ? 'checked' : ''}
        >
      </td>
      <td class="department-col">${escapeHtml(emp.department)}</td>
      <td class="name-col">${escapeHtml(emp.name)}</td>
      <td class="destination-col">
        ${isPresent 
          ? '<span class="status-badge status-present">在席</span>' 
          : escapeHtml(emp.destination)
        }
      </td>
      <td class="return-col">${escapeHtml(emp.return_time)}</td>
      <td class="set-at-col">${setAt}</td>
    `;
    
    // チェックボックスイベント
    const checkbox = row.querySelector('.employee-checkbox');
    checkbox.addEventListener('change', handleCheckboxChange);
    
    employeeTableBody.appendChild(row);
  });
  
  updateSelectAllState();
  updateBulkUpdateButton();
  
  // 自動更新の設定
  setupAutoRefresh();
}

// 日時フォーマット関数を追加
function formatDateTime(dateString) {
  //console.log('=== formatDateTime デバッグ ===');
  //console.log('元のデータ:', dateString);
  
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  //console.log('Dateオブジェクト:', date);
  //console.log('表示する時刻:', date.getHours() + ':' + date.getMinutes());
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  const result = `${year}/${month}/${day} ${hours}:${minutes}`;
  //console.log('最終結果:', result);
  
  return result;
}


// チェックボックス変更ハンドラ
function handleCheckboxChange(e) {
  const employeeId = parseInt(e.target.dataset.employeeId);
  
  if (e.target.checked) {
    selectedEmployeeIds.add(employeeId);
  } else {
    selectedEmployeeIds.delete(employeeId);
  }
  
  updateSelectAllState();
  updateBulkUpdateButton();
  updateFormWithSelectedEmployee();
}

// 全選択ハンドラ
function handleSelectAll(e) {
  const checkboxes = document.querySelectorAll('.employee-checkbox');
  
  if (e.target.checked) {
    checkboxes.forEach(cb => {
      cb.checked = true;
      selectedEmployeeIds.add(parseInt(cb.dataset.employeeId));
    });
  } else {
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    selectedEmployeeIds.clear();
  }
  
  updateBulkUpdateButton();
  updateFormWithSelectedEmployee();
}

// 全選択チェックボックスの状態更新
function updateSelectAllState() {
  const checkboxes = document.querySelectorAll('.employee-checkbox');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  
  selectAllCheckbox.checked = checkedCount > 0 && checkedCount === checkboxes.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

// 一括更新ボタンの有効/無効制御
function updateBulkUpdateButton() {
  bulkUpdateBtn.disabled = selectedEmployeeIds.size === 0;
}

// 選択解除
function clearAllSelections() {
  selectedEmployeeIds.clear();
  document.querySelectorAll('.employee-checkbox').forEach(cb => {
    cb.checked = false;
  });
  selectAllCheckbox.checked = false;
  selectAllCheckbox.indeterminate = false;
  updateBulkUpdateButton();
}

// 選択された社員の情報をフォームにコピー
function updateFormWithSelectedEmployee() {
  if (selectedEmployeeIds.size === 0) {
    // 未選択の場合はクリア
    bulkDestination.value = '';
    document.getElementById('bulkReturn').value = '';
    return;
  }
  
  // 最初に選択された社員の情報を取得
  const firstSelectedId = Array.from(selectedEmployeeIds)[0];
  const employee = employees.find(e => e.id === firstSelectedId);
  
  if (employee) {
    bulkDestination.value = employee.destination || '';
    document.getElementById('bulkReturn').value = employee.return_time || '';
  }
}

// 一括更新処理
async function handleBulkUpdate(e) {
  e.preventDefault();
  
  if (selectedEmployeeIds.size === 0) {
    showMessage('社員を選択してください', 'error');
    return;
  }
  
  const destination = bulkDestination.value.trim();
  const return_time = document.getElementById('bulkReturn').value.trim();
  const remarks = '';
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/whereabouts/bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeIds: Array.from(selectedEmployeeIds),
        destination,
        return_time,
        remarks
      })
    });
    
    if (!response.ok) throw new Error('更新に失敗しました');
    
    // フォームクリアせず、選択も維持
    // データ再読み込み
    await loadEmployees();
    showMessage('更新が完了しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 一括更新用の履歴表示
async function showHistoryForBulk() {
  // 選択されている社員の履歴を取得（最初の1人のみ）
  if (selectedEmployeeIds.size === 0) {
    historyDropdown.innerHTML = '<div class="history-item">社員を選択してください</div>';
    historyDropdown.classList.add('show');
    return;
  }
  
  const firstEmployeeId = Array.from(selectedEmployeeIds)[0];
  
  try {
    // 個人履歴を取得
    const personalResponse = await fetch(`${API_BASE}/api/history/${firstEmployeeId}`);
    const personalHistory = personalResponse.ok ? await personalResponse.json() : [];
    
    // 共通履歴を取得
    const commonResponse = await fetch(`${API_BASE}/api/common-history`);
    const commonHistory = commonResponse.ok ? await commonResponse.json() : [];
    
    // HTML生成
    let html = '';
    
    // 個人履歴
    html += `
      <div class="history-section-title">
        <span>あなたの履歴</span>
        <span class="history-section-info">最大5件 / 古いものから自動削除</span>
      </div>
    `;
    
    if (personalHistory.length > 0) {
      personalHistory.forEach(item => {
        html += `
          <div class="history-item" data-destination="${escapeHtml(item.destination)}" data-history-id="${item.id}">
            <span>${escapeHtml(item.destination)}</span>
            <button class="history-delete-btn" data-history-id="${item.id}" data-employee-id="${firstEmployeeId}">削除</button>
          </div>
        `;
      });
    } else {
      html += '<div class="history-item" style="color: #6c757d;">履歴がありません</div>';
    }
    
    // 共通履歴
    html += `
      <div class="history-section-title" style="margin-top: 4px;">
        <span>共通履歴</span>
        <span class="history-section-info">最大20件 / 管理画面で管理</span>
      </div>
    `;
    
    if (commonHistory.length > 0) {
      commonHistory.forEach(item => {
        html += `
          <div class="history-item" data-destination="${escapeHtml(item.destination)}">
            <span>${escapeHtml(item.destination)}</span>
          </div>
        `;
      });
    } else {
      html += '<div class="history-item" style="color: #6c757d;">履歴がありません</div>';
    }
    
    historyDropdown.innerHTML = html;
    
    // 履歴アイテムクリック時の処理（修正: 戻り入力欄へフォーカス）
    historyDropdown.querySelectorAll('.history-item').forEach((item, index) => {
      if (item.dataset.destination) {
        // クリック時
        item.addEventListener('click', () => {
          bulkDestination.value = item.dataset.destination;
          historyDropdown.classList.remove('show');
          document.getElementById('bulkReturn').focus();
          historySelectedIndex = -1;
        });
        
        // マウスホバー時に選択状態を更新
        item.addEventListener('mouseenter', () => {
          const allItems = historyDropdown.querySelectorAll('.history-item[data-destination]');
          allItems.forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          historySelectedIndex = index;
        });
      }
    });
    
    // 削除ボタンのイベントリスナー（追加）
    historyDropdown.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // 親要素のクリックイベントを防ぐ
        
        const historyId = btn.dataset.historyId;
        const employeeId = btn.dataset.employeeId;
        
        if (confirm('この履歴を削除しますか？')) {
          await deletePersonalHistory(historyId, employeeId);
        }
      });
    });
    
    historyDropdown.classList.add('show');
  } catch (error) {
    console.error(error);
    historyDropdown.innerHTML = '<div class="history-item">履歴の読み込みに失敗しました</div>';
    historyDropdown.classList.add('show');
  }
}

// 履歴表示共通処理
async function showHistory(employeeId, dropdownElement, inputElement) {
  try {
    const response = await fetch(`${API_BASE}/api/history/${employeeId}`);
    if (!response.ok) throw new Error('履歴の取得に失敗しました');
    
    const history = await response.json();
    
    if (history.length === 0) {
      dropdownElement.innerHTML = '<div class="history-item">履歴がありません</div>';
    } else {
      dropdownElement.innerHTML = history
        .map(item => `
          <div class="history-item" data-destination="${escapeHtml(item.destination)}">
            ${escapeHtml(item.destination)}
          </div>
        `)
        .join('');
      
      // 履歴アイテムクリック時の処理
      dropdownElement.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          inputElement.value = item.dataset.destination;
          dropdownElement.classList.remove('show');
        });
      });
    }
    
    dropdownElement.classList.add('show');
  } catch (error) {
    console.error(error);
    dropdownElement.innerHTML = '<div class="history-item">履歴の読み込みに失敗しました</div>';
    dropdownElement.classList.add('show');
  }
}

// ローディング表示
function showLoading(show) {
  if (show) {
    loading.classList.add('show');
  } else {
    loading.classList.remove('show');
  }
}

// メッセージ表示
function showMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `message ${type} show`;
  
  setTimeout(() => {
    message.classList.remove('show');
  }, 3000);
}

// HTMLエスケープ
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// 自動更新機能
// ========================================

let autoRefreshTimer = null;

function setupAutoRefresh() {
  // 既存のタイマーをクリア
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  
  // 全体設定から自動更新時間を取得
  const minutes = appSettings.auto_refresh_minutes;
  
  if (!minutes || minutes <= 0) {
    console.log('自動更新: 無効');
    return;
  }
  
  const intervalMs = minutes * 60 * 1000;
  
  autoRefreshTimer = setInterval(() => {
    console.log(`自動更新実行: ${minutes}分ごと`);
    loadEmployees();
  }, intervalMs);
  
  console.log(`自動更新設定: ${minutes}分ごと`);
}

// ページを離れる時にタイマーをクリア
window.addEventListener('beforeunload', () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
});

// 個人履歴削除
async function deletePersonalHistory(historyId, employeeId) {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/history/${historyId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('削除に失敗しました');
    
    showMessage('履歴を削除しました', 'success');
    
    // 履歴を再読み込み
    await showHistoryForBulk();
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}