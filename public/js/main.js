// API Base URL
const API_BASE = window.location.origin;

// グローバル変数
let employees = [];
let selectedEmployeeIds = new Set();
let currentEditingEmployeeId = null;

// DOM要素
const employeeTableBody = document.getElementById('employeeTableBody');
const selectAllCheckbox = document.getElementById('selectAll');
const bulkUpdateBtn = document.getElementById('bulkUpdateBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const bulkForm = document.getElementById('bulkForm');
const bulkDestination = document.getElementById('bulkDestination');
const historyDropdown = document.getElementById('historyDropdown');
const loading = document.getElementById('loading');
const message = document.getElementById('message');
const editModal = document.getElementById('editModal');
const editEmployeeName = document.getElementById('editEmployeeName');
const editDestination = document.getElementById('editDestination');
const editReturn = document.getElementById('editReturn');
const editRemarks = document.getElementById('editRemarks');
const editHistoryDropdown = document.getElementById('editHistoryDropdown');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadEmployees();
  setupEventListeners();
});

// イベントリスナー設定
function setupEventListeners() {
  // 全選択チェックボックス
  selectAllCheckbox.addEventListener('change', handleSelectAll);
  
  // 一括更新フォーム
  bulkForm.addEventListener('submit', handleBulkUpdate);
  
  // 選択解除ボタン
  clearSelectionBtn.addEventListener('click', clearAllSelections);
  
  // 行き先入力フォーカス時に履歴を表示
  bulkDestination.addEventListener('focus', () => showHistoryForBulk());
  bulkDestination.addEventListener('input', () => showHistoryForBulk());
  
  // 編集モーダル
  editDestination.addEventListener('focus', () => showHistoryForEdit());
  editDestination.addEventListener('input', () => showHistoryForEdit());
  saveEditBtn.addEventListener('click', handleSaveEdit);
  cancelEditBtn.addEventListener('click', closeEditModal);
  
  // モーダル外クリックで閉じる
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      closeEditModal();
    }
  });
  
  // 履歴ドロップダウン外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.history-group')) {
      historyDropdown.classList.remove('show');
      editHistoryDropdown.classList.remove('show');
    }
  });
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
      <td>${escapeHtml(emp.department)}</td>
      <td>${escapeHtml(emp.name)}</td>
      <td>
        ${isPresent 
          ? '<span class="status-badge status-present">在席</span>' 
          : escapeHtml(emp.destination)
        }
      </td>
      <td>${escapeHtml(emp.return_time)}</td>
      <td>${setAt}</td>
      <td class="actions-col">
        <button 
          class="btn btn-primary btn-sm" 
          onclick="openEditModal(${emp.id})"
        >
          編集
        </button>
      </td>
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
    
    // フォームクリア
    bulkForm.reset();
    clearAllSelections();
    
    // データ再読み込み
    await loadEmployees();
    showMessage('一括更新が完了しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 編集モーダルを開く
function openEditModal(employeeId) {
  currentEditingEmployeeId = employeeId;
  const employee = employees.find(e => e.id === employeeId);
  
  if (!employee) return;
  
  editEmployeeName.value = `${employee.department} - ${employee.name}`;
  editDestination.value = employee.destination || '';
  editReturn.value = employee.return_time || '';
  
  editModal.classList.add('show');
}

// 編集モーダルを閉じる
function closeEditModal() {
  editModal.classList.remove('show');
  currentEditingEmployeeId = null;
  editHistoryDropdown.classList.remove('show');
}

// 編集保存
async function handleSaveEdit() {
  if (!currentEditingEmployeeId) return;
  
  const destination = editDestination.value.trim();
  const return_time = editReturn.value.trim();
  const remarks = '';  // 備考は常に空文字
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/whereabouts/${currentEditingEmployeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, return_time, remarks })
    });
    
    if (!response.ok) throw new Error('更新に失敗しました');
    
    closeEditModal();
    await loadEmployees();
    showMessage('行き先を更新しました', 'success');
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

// 編集用の履歴表示
async function showHistoryForEdit() {
  if (!currentEditingEmployeeId) return;
  await showHistoryWithCommon(currentEditingEmployeeId, editHistoryDropdown, editDestination);
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

let autoRefreshTimers = new Map(); // 社員ごとのタイマーを管理

function setupAutoRefresh() {
  // 既存のタイマーをすべてクリア
  autoRefreshTimers.forEach(timer => clearTimeout(timer));
  autoRefreshTimers.clear();
  
  // 各社員の自動更新設定をチェック
  employees.forEach(emp => {
    if (emp.auto_refresh_minutes && emp.auto_refresh_minutes > 0) {
      const intervalMs = emp.auto_refresh_minutes * 60 * 1000;
      
      const timerId = setInterval(() => {
        console.log(`自動更新: ${emp.name} (${emp.auto_refresh_minutes}分ごと)`);
        loadEmployees();
      }, intervalMs);
      
      autoRefreshTimers.set(emp.id, timerId);
    }
  });
  
  console.log(`自動更新設定: ${autoRefreshTimers.size}名の社員`);
}

// ページを離れる時にタイマーをクリア
window.addEventListener('beforeunload', () => {
  autoRefreshTimers.forEach(timer => clearInterval(timer));
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