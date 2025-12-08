// API Base URL
const API_BASE = window.location.origin;

// グローバル変数
let employees = [];
let selectedEmployeeIds = new Set();
let appSettings = { auto_refresh_minutes: 0 };
let currentEditingEmployeeId = null;

// DOM要素
const employeeTableBody = document.getElementById('employeeTableBody');
const selectAllCheckbox = document.getElementById('selectAll');
const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
const bulkForm = document.getElementById('bulkForm');
const bulkDestination = document.getElementById('bulkDestination');
const historyDropdown = document.getElementById('historyDropdown');
const loading = document.getElementById('loading');
const message = document.getElementById('message');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadEmployees();
  setupEventListeners();
});

// イベントリスナー設定
function setupEventListeners() {
  // 全選択チェックボックス
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  
  // 一括更新フォーム
  bulkForm.addEventListener('submit', handleBulkUpdate);
  
  // 行き先入力フォーカス時に履歴を表示
  bulkDestination.addEventListener('focus', () => showHistoryForBulk());
  bulkDestination.addEventListener('input', () => showHistoryForBulk());
  
  // 履歴ドロップダウン外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.history-group')) {
      historyDropdown.classList.remove('show');
    }
  });
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
  await showHistoryWithCommon(firstEmployeeId, historyDropdown, bulkDestination);
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

// ========================================
// 共通履歴機能
// ========================================

// 共通履歴を含む履歴表示
async function showHistoryWithCommon(employeeId, dropdownElement, inputElement) {
  try {
    // 個人履歴を取得
    const personalResponse = await fetch(`${API_BASE}/api/history/${employeeId}`);
    const personalHistory = personalResponse.ok ? await personalResponse.json() : [];
    
    // 共通履歴を取得
    const commonResponse = await fetch(`${API_BASE}/api/common-history`);
    const commonHistory = commonResponse.ok ? await commonResponse.json() : [];
    
    // HTML生成
    let html = '';
    
    // 個人履歴
    if (personalHistory.length > 0) {
      html += '<div style="padding: 8px; background: #f8f9fa; font-weight: 600; font-size: 12px; color: #495057;">あなたの履歴</div>';
      personalHistory.forEach(item => {
        html += `
          <div class="history-item" data-destination="${escapeHtml(item.destination)}">
            ${escapeHtml(item.destination)}
          </div>
        `;
      });
    } else {
      html += '<div style="padding: 8px; background: #f8f9fa; font-weight: 600; font-size: 12px; color: #495057;">あなたの履歴</div>';
      html += '<div class="history-item" style="color: #6c757d;">履歴がありません</div>';
    }
    
    // 共通履歴
    if (commonHistory.length > 0) {
      html += '<div style="padding: 8px; background: #e9ecef; font-weight: 600; font-size: 12px; color: #495057; margin-top: 4px;">共通履歴</div>';
      commonHistory.forEach(item => {
        html += `
          <div class="history-item" data-destination="${escapeHtml(item.destination)}">
            ${escapeHtml(item.destination)}
          </div>
        `;
      });
    }
    
    dropdownElement.innerHTML = html;
    
    // 履歴アイテムクリック時の処理
    dropdownElement.querySelectorAll('.history-item').forEach(item => {
      if (item.dataset.destination) {
        item.addEventListener('click', () => {
          inputElement.value = item.dataset.destination;
          dropdownElement.classList.remove('show');
        });
      }
    });
    
    dropdownElement.classList.add('show');
  } catch (error) {
    console.error(error);
    dropdownElement.innerHTML = '<div class="history-item">履歴の読み込みに失敗しました</div>';
    dropdownElement.classList.add('show');
  }
}