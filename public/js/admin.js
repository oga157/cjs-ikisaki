// ログイン関連
let loginAttempts = 0;
let lockUntil = null;

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
const saveEditEmployeeBtn = document.getElementById('saveEditEmployeeBtn');
const cancelEditEmployeeBtn = document.getElementById('cancelEditEmployeeBtn');
const autoRefreshForm = document.getElementById('autoRefreshForm');
const autoRefreshMinutesInput = document.getElementById('autoRefreshMinutes');
const addCommonHistoryForm = document.getElementById('addCommonHistoryForm');
const commonDestination = document.getElementById('commonDestination');
const commonHistoryList = document.getElementById('commonHistoryList');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginCode = document.getElementById('loginCode');
const loginError = document.getElementById('loginError');
const loginLockMessage = document.getElementById('loginLockMessage');
const mainContent = document.getElementById('mainContent');
const changeCodeForm = document.getElementById('changeCodeForm');
const currentCode = document.getElementById('currentCode');
const newCode = document.getElementById('newCode');
const confirmCode = document.getElementById('confirmCode');

let commonHistories = [];
let appSettings = { auto_refresh_minutes: 0 };

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadEmployees();
  loadCommonHistories();
  loadSettings();
  setupEventListeners();
});

// 認証後の初期化
function initializeApp() {
  loadEmployees();
  loadCommonHistories();
  loadSettings();
  setupEventListeners();
}

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
  
  // 自動更新設定フォーム
  autoRefreshForm.addEventListener('submit', handleSaveSettings);
  
  // 共通履歴フォーム
  addCommonHistoryForm.addEventListener('submit', handleAddCommonHistory);
  
  // ログインコード変更フォーム
  changeCodeForm.addEventListener('submit', handleChangeCode);
  
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

// ログインコード変更処理
async function handleChangeCode(e) {
  e.preventDefault();
  
  const current = currentCode.value.trim();
  const newCodeValue = newCode.value.trim();
  const confirm = confirmCode.value.trim();
  
  // バリデーション
  if (!current || !newCodeValue || !confirm) {
    showMessage('すべての項目を入力してください', 'error');
    return;
  }
  
  if (newCodeValue !== confirm) {
    showMessage('新しいコードと確認用コードが一致しません', 'error');
    return;
  }
  
  if (newCodeValue.length < 1 || newCodeValue.length > 12) {
    showMessage('新しいコードは1〜12文字で設定してください', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/auth/change-code`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentCode: current,
        newCode: newCodeValue
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      showMessage('✓ ログインコードを変更しました。次回から新しいコードでログインしてください', 'success');
      changeCodeForm.reset();
    } else {
      showMessage(data.error || 'コードの変更に失敗しました', 'error');
    }
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ログインフォームのイベントリスナー
loginForm.addEventListener('submit', handleLogin);

// 全体設定読み込み
async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/settings`);
    if (!response.ok) throw new Error('設定の取得に失敗しました');
    
    appSettings = await response.json();
    autoRefreshMinutesInput.value = appSettings.auto_refresh_minutes || 0;
  } catch (error) {
    console.error(error);
    showMessage('設定の読み込みに失敗しました', 'error');
  }
}

// 全体設定保存
async function handleSaveSettings(e) {
  e.preventDefault();
  
  const minutes = parseInt(autoRefreshMinutesInput.value) || 0;
  
  if (minutes < 0 || minutes > 60) {
    showMessage('自動更新時間は0〜60分の範囲で設定してください', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_refresh_minutes: minutes })
    });
    
    if (!response.ok) throw new Error('設定の保存に失敗しました');
    
    appSettings = await response.json();
    
    // 詳細メッセージ
    if (minutes === 0) {
      showMessage('✓ 自動更新を無効にしました', 'success');
    } else {
      showMessage(`✓ 自動更新を${minutes}分ごとに設定しました`, 'success');
    }
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
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
    
    item.innerHTML = `
      <div class="employee-info">
        <span class="drag-handle">☰</span>
        <span class="order">${index + 1}</span>
        <span class="department">${escapeHtml(emp.department)}</span>
        <span class="name">${escapeHtml(emp.name)}</span>
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
  
  if (!departmentValue || !nameValue) {
    showMessage('所属と名前を入力してください', 'error');
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

// ========================================
// 共通履歴管理機能
// ========================================

// 共通履歴読み込み
async function loadCommonHistories() {
  try {
    const response = await fetch(`${API_BASE}/api/common-history`);
    if (!response.ok) throw new Error('共通履歴の取得に失敗しました');
    
    commonHistories = await response.json();
    renderCommonHistoryList();
  } catch (error) {
    console.error(error);
    showMessage('共通履歴の読み込みに失敗しました', 'error');
  }
}

// 共通履歴リスト描画
function renderCommonHistoryList() {
  if (commonHistories.length === 0) {
    commonHistoryList.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">共通履歴はまだ登録されていません</div>';
    return;
  }
  
  commonHistoryList.innerHTML = '';
  
  commonHistories.forEach((item, index) => {
    
    const div = document.createElement('div');
    div.className = 'common-history-item';
    
    const lastUsed = new Date(item.last_used_at);
    const formattedDate = `${lastUsed.getFullYear()}/${String(lastUsed.getMonth() + 1).padStart(2, '0')}/${String(lastUsed.getDate()).padStart(2, '0')}`;
    
    div.innerHTML = `
      <div class="destination">${index + 1}. ${escapeHtml(item.destination)}</div>
      <div class="meta">最終使用: ${formattedDate}</div>
      <div class="actions">
        <button 
          class="btn btn-danger btn-sm" 
          onclick="deleteCommonHistory(${item.id})"
        >
          削除
        </button>
      </div>
    `;
    
    commonHistoryList.appendChild(div);
  });
}

// 共通履歴追加
async function handleAddCommonHistory(e) {
  e.preventDefault();
  
  const destination = commonDestination.value.trim();
  
  if (!destination) {
    showMessage('行き先を入力してください', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/common-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination })
    });
    
    if (!response.ok) throw new Error('追加に失敗しました');
    
    // フォームクリア
    addCommonHistoryForm.reset();
    
    // データ再読み込み
    await loadCommonHistories();
    showMessage('共通履歴を追加しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// 共通履歴削除
async function deleteCommonHistory(id) {
  if (!confirm('この共通履歴を削除してもよろしいですか？')) {
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`${API_BASE}/api/common-history/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('削除に失敗しました');
    
    await loadCommonHistories();
    showMessage('共通履歴を削除しました', 'success');
  } catch (error) {
    console.error(error);
    showMessage('エラー: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// グローバルスコープに関数を公開
window.deleteCommonHistory = deleteCommonHistory;

