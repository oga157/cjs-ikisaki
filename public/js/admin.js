// API Base URL
const API_BASE = window.location.origin;

// グローバル変数
let employees = [];
let currentDeleteEmployeeId = null;
let currentEditEmployeeId = null;
let draggedElement = null;
let draggedEmployeeId = null;

// DOM要素
const addEmployeeForm = document.getElementById('addEmployeeForm');
const department = document.getElementById('department');
const name = document.getElementById('name');
const autoRefreshMinutes = document.getElementById('autoRefreshMinutes');
const employeeList = document.getElementById('employeeList');
const loading = document.getElementById('loading');
const message = document.getElementById('message');
const deleteModal = document.getElementById('deleteModal');
const deleteEmployeeName = document.getElementById('deleteEmployeeName');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const editEmployeeModal = document.getElementById('editEmployeeModal');
const editDepartment = document.getElementById('editDepartment');
const editName = document.getElementById('editName');
const editAutoRefreshMinutes = document.getElementById('editAutoRefreshMinutes');
const saveEditEmployeeBtn = document.getElementById('saveEditEmployeeBtn');
const cancelEditEmployeeBtn = document.getElementById('cancelEditEmployeeBtn');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadEmployees();
  setupEventListeners();
});

// イベントリスナー設定
function setupEventListeners() {
  // 社員追加フォーム
  addEmployeeForm.addEventListener('submit', handleAddEmployee);
  
  // 削除確認モーダル
  confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  
  // 編集モーダル
  saveEditEmployeeBtn.addEventListener('click', handleSaveEditEmployee);
  cancelEditEmployeeBtn.addEventListener('click', closeEditEmployeeModal);
  
  // モーダル外クリックで閉じる
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });
  
  editEmployeeModal.addEventListener('click', (e) => {
    if (e.target === editEmployeeModal) {
      closeEditEmployeeModal();
    }
  });
}

// 社員データ読み込み
async function loadEmployees() {
  showLoading(true);
  try {
    const response = await fetch(`${API_BASE}/api/employees`);
    if (!response.ok) throw new Error('データの取得に失敗しました');
    
    employees = await response.json();
    renderEmployeeList();
    showMessage('データを読み込みました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 社員リスト描画
function renderEmployeeList() {
  employeeList.innerHTML = '';
  
  employees.forEach((emp, index) => {
    const item = document.createElement('div');
    item.className = 'employee-item';
    item.draggable = true;
    item.dataset.employeeId = emp.id;
    item.dataset.order = emp.display_order;
    
    // 自動更新時間の表示
    const autoRefreshText = emp.auto_refresh_minutes > 0 
      ? `${emp.auto_refresh_minutes}分ごと` 
      : '更新なし';
    
    item.innerHTML = `
      <div class="employee-info">
        <span class="drag-handle">☰</span>
        <span class="order">${index + 1}</span>
        <span class="department">${escapeHtml(emp.department)}</span>
        <span class="name">${escapeHtml(emp.name)}</span>
        <span class="auto-refresh" style="color: #6c757d; font-size: 12px; min-width: 80px;">
          🔄 ${autoRefreshText}
        </span>
      </div>
      <div class="employee-actions">
        <button 
          class="btn btn-primary btn-sm" 
          onclick="openEditEmployeeModal(${emp.id})"
        >
          編集
        </button>
        <button 
          class="btn btn-danger btn-sm" 
          onclick="openDeleteModal(${emp.id})"
        >
          削除
        </button>
      </div>
    `;
    
    // ドラッグイベント
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    
    employeeList.appendChild(item);
  });
}

// 社員追加
async function handleAddEmployee(e) {
  e.preventDefault();
  
  const departmentValue = department.value.trim();
  const nameValue = name.value.trim();
  const autoRefreshValue = parseInt(autoRefreshMinutes.value) || 0;
  
  if (!departmentValue || !nameValue) {
    showMessage('所属と名前を入力してください', 'error');
    return;
  }
  
  if (autoRefreshValue < 0 || autoRefreshValue > 60) {
    showMessage('自動更新時間は0〜60分の範囲で設定してください', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: departmentValue,
        name: nameValue,
        auto_refresh_minutes: autoRefreshValue
      })
    });
    
    if (!response.ok) throw new Error('追加に失敗しました');
    
    // フォームクリア
    addEmployeeForm.reset();
    
    // データ再読み込み
    await loadEmployees();
    showMessage('社員を追加しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 削除モーダルを開く
function openDeleteModal(employeeId) {
  currentDeleteEmployeeId = employeeId;
  const employee = employees.find(e => e.id === employeeId);
  
  if (!employee) return;
  
  deleteEmployeeName.textContent = `${employee.department} - ${employee.name}`;
  deleteModal.classList.add('show');
}

// 削除モーダルを閉じる
function closeDeleteModal() {
  deleteModal.classList.remove('show');
  currentDeleteEmployeeId = null;
}

// 削除実行
async function handleConfirmDelete() {
  if (!currentDeleteEmployeeId) return;
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/employees/${currentDeleteEmployeeId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('削除に失敗しました');
    
    closeDeleteModal();
    await loadEmployees();
    showMessage('社員を削除しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 編集モーダルを開く
function openEditEmployeeModal(employeeId) {
  currentEditEmployeeId = employeeId;
  const employee = employees.find(e => e.id === employeeId);
  
  if (!employee) return;
  
  editDepartment.value = employee.department;
  editName.value = employee.name;
  editAutoRefreshMinutes.value = employee.auto_refresh_minutes || 0;
  editEmployeeModal.classList.add('show');
}

// 編集モーダルを閉じる
function closeEditEmployeeModal() {
  editEmployeeModal.classList.remove('show');
  currentEditEmployeeId = null;
}

// 編集保存
async function handleSaveEditEmployee() {
  if (!currentEditEmployeeId) return;
  
  const departmentValue = editDepartment.value.trim();
  const nameValue = editName.value.trim();
  const autoRefreshValue = parseInt(editAutoRefreshMinutes.value) || 0;
  
  if (!departmentValue || !nameValue) {
    showMessage('所属と名前を入力してください', 'error');
    return;
  }
  
  if (autoRefreshValue < 0 || autoRefreshValue > 60) {
    showMessage('自動更新時間は0〜60分の範囲で設定してください', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/employees/${currentEditEmployeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: departmentValue,
        name: nameValue,
        auto_refresh_minutes: autoRefreshValue
      })
    });
    
    if (!response.ok) throw new Error('更新に失敗しました');
    
    closeEditEmployeeModal();
    await loadEmployees();
    showMessage('社員情報を更新しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ========================================
// ドラッグ&ドロップ処理
// ========================================

function handleDragStart(e) {
  draggedElement = e.currentTarget;
  draggedEmployeeId = parseInt(e.currentTarget.dataset.employeeId);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  
  // すべてのdrag-overクラスを削除
  document.querySelectorAll('.employee-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  
  draggedElement = null;
  draggedEmployeeId = null;
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  if (e.currentTarget !== draggedElement) {
    e.currentTarget.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  e.currentTarget.classList.remove('drag-over');
  
  if (draggedElement !== e.currentTarget) {
    // ドロップ先の要素
    const dropTargetId = parseInt(e.currentTarget.dataset.employeeId);
    
    // 配列内での位置を入れ替え
    const draggedIndex = employees.findIndex(emp => emp.id === draggedEmployeeId);
    const dropIndex = employees.findIndex(emp => emp.id === dropTargetId);
    
    // 配列の要素を入れ替え
    const temp = employees[draggedIndex];
    employees.splice(draggedIndex, 1);
    employees.splice(dropIndex, 0, temp);
    
    // display_orderを更新
    const orders = employees.map((emp, index) => ({
      id: emp.id,
      display_order: index + 1
    }));
    
    // サーバーに並び替えを送信
    saveReorder(orders);
  }
  
  return false;
}

// 並び替えをサーバーに保存
async function saveReorder(orders) {
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/employees/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    
    if (!response.ok) throw new Error('並び替えに失敗しました');
    
    // データ再読み込み
    await loadEmployees();
    showMessage('並び替えを保存しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
    // エラー時は元に戻す
    await loadEmployees();
  } finally {
    showLoading(false);
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
