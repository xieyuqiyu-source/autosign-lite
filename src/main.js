import './style.css'
import { invoke } from '@tauri-apps/api/core'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="min-h-screen bg-base-200 text-base-content">
    <div class="mx-auto flex min-h-screen max-w-[1320px] gap-3 p-3">
      <aside class="w-[340px] shrink-0 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
        <div class="mb-3 flex items-center gap-3">
          <div class="avatar placeholder">
            <div class="w-12 rounded-xl bg-neutral text-neutral-content">
              <span class="text-sm font-bold">AS</span>
            </div>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-[0.24em] text-base-content/55">AutoSign Lite</p>
            <h1 class="text-lg font-semibold">账号工具</h1>
          </div>
        </div>

        <div class="space-y-2">
          <label class="form-control">
            <div class="label py-1">
              <span class="label-text text-xs">账号</span>
            </div>
            <input id="accountInput" class="input input-sm input-bordered w-full" placeholder="邮箱或账号" autocomplete="username" />
          </label>

          <label class="form-control">
            <div class="label py-1">
              <span class="label-text text-xs">密码</span>
            </div>
            <input id="passwordInput" type="password" class="input input-sm input-bordered w-full" placeholder="密码" autocomplete="current-password" />
          </label>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <button id="loginButton" class="btn btn-sm btn-primary">登录</button>
          <button id="saveButton" class="btn btn-sm btn-outline">保存</button>
          <button id="refreshPitButton" class="btn btn-sm btn-outline">刷新栏位</button>
          <button id="clearButton" class="btn btn-sm btn-ghost">清空</button>
        </div>

        <div class="mt-3 rounded-box bg-base-200 p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] uppercase tracking-[0.2em] text-base-content/50">Status</span>
            <button id="copyTokenButton" class="btn btn-ghost btn-xs">复制 Token</button>
          </div>
          <p id="statusText" class="mt-2 text-sm font-semibold">等待操作</p>
          <p id="statusHint" class="mt-1 text-xs text-base-content/60">载入账号后可直接登录，成功后自动刷新 pit。</p>
        </div>
      </aside>

      <main class="flex min-w-0 flex-1 flex-col gap-3 self-start">
        <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="text-sm font-semibold">账号列表</p>
            <div class="flex items-center gap-2">
              <span id="accountCount" class="badge badge-neutral badge-sm">0</span>
              <button id="exportButton" class="btn btn-xs btn-outline">导出</button>
            </div>
          </div>
          <div id="accountList" class="space-y-2 text-sm">
            <div class="rounded-box bg-base-200 px-3 py-8 text-center text-base-content/50">暂无已保存账号</div>
          </div>
        </section>

        <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
          <div class="mb-3">
            <h2 class="text-sm font-semibold">三栏位</h2>
          </div>
          <div id="pitGrid" class="grid grid-cols-3 gap-3"></div>
        </section>
      </main>
    </div>
  </div>
`

const els = {
  accountInput: document.querySelector('#accountInput'),
  passwordInput: document.querySelector('#passwordInput'),
  loginButton: document.querySelector('#loginButton'),
  saveButton: document.querySelector('#saveButton'),
  refreshPitButton: document.querySelector('#refreshPitButton'),
  clearButton: document.querySelector('#clearButton'),
  copyTokenButton: document.querySelector('#copyTokenButton'),
  exportButton: document.querySelector('#exportButton'),
  accountList: document.querySelector('#accountList'),
  accountCount: document.querySelector('#accountCount'),
  pitGrid: document.querySelector('#pitGrid'),
  statusText: document.querySelector('#statusText'),
  statusHint: document.querySelector('#statusHint'),
}

const state = {
  accounts: [],
  token: '',
  selectedAccount: '',
  pits: [],
  loadingCodes: {},
  pitCodes: {},
}

const defaultPits = Array.from({ length: 3 }, (_, index) => ({
  seat_id: 0,
  account: '',
  password: '',
  status: 0,
  pit: 'unlocked',
  title: `栏位 ${index + 1}`,
}))

const pitTitle = (pit) => (pit === 'occupying' ? '已解锁' : '未解锁')
const pitStatus = (status) => (Number(status) === 1 ? '租赁中' : '未租赁')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function setStatus(text, hint = '') {
  els.statusText.textContent = text
  els.statusHint.textContent = hint
}

function setButtonLoading(button, loading, label) {
  if (!button) return
  button.disabled = loading
  button.innerHTML = loading
    ? `<span class="loading loading-spinner loading-xs"></span>${label}`
    : label
}

async function copyText(value, successText) {
  if (!value) return
  await navigator.clipboard.writeText(value)
  setStatus(successText)
}

function selectedAccountRecord() {
  return state.accounts.find((item) => item.account === state.selectedAccount)
}

function renderAccounts() {
  els.accountCount.textContent = String(state.accounts.length)
  if (!state.accounts.length) {
    els.accountList.innerHTML =
      '<div class="rounded-box bg-base-200 px-3 py-8 text-center text-base-content/50">暂无已保存账号</div>'
    return
  }

  els.accountList.innerHTML = state.accounts
    .map((item) => {
      const activeClass = item.account === state.selectedAccount ? 'border-primary bg-primary/5' : 'border-base-300'
      const lastLogin = item.last_login || '未登录'
      return `
        <article class="rounded-box border ${activeClass} px-3 py-2" data-account="${escapeHtml(item.account)}">
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1 rounded-box bg-base-200 px-2 py-2 text-xs">
              <span class="text-base-content/55">账号：</span>
              <code class="mr-2 inline bg-transparent px-0 py-0">${escapeHtml(item.account)}</code>
              <span class="text-base-content/55">密码：</span>
              <code class="inline bg-transparent px-0 py-0">${escapeHtml(item.password)}</code>
            </div>
            <button class="btn btn-xs btn-ghost" data-action="copy-account" data-account="${escapeHtml(item.account)}">复制账号</button>
            <button class="btn btn-xs btn-ghost" data-action="copy-password" data-account="${escapeHtml(item.account)}">复制密码</button>
            <button class="btn btn-xs btn-primary" data-action="load" data-account="${escapeHtml(item.account)}">载入登录</button>
          </div>
          <p class="mt-1 text-[11px] text-base-content/45">最近登录：${escapeHtml(lastLogin)}</p>
        </article>
      `
    })
    .join('')
}

function renderPits() {
  const cards = state.pits.length ? state.pits : defaultPits

  els.pitGrid.innerHTML = cards
    .map((item, index) => {
      const code = state.pitCodes[index] || ''
      const loading = Boolean(state.loadingCodes[index])
      const available = Boolean(item.account && item.seat_id)
      return `
        <article class="pit-shell rounded-box border border-base-300 bg-base-200/70 p-3 ${item.pit === 'occupying' ? 'ring-1 ring-primary/25' : ''}">
          <div class="flex h-full flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="badge badge-outline badge-sm">0${index + 1}</span>
              <h3 class="text-sm font-semibold">${escapeHtml(item.title || pitTitle(item.pit))}</h3>
              <span class="text-[11px] text-base-content/55">${escapeHtml(pitStatus(item.status))}</span>
            </div>

            <div class="rounded-box bg-base-100 px-2 py-2">
              <div class="mb-1 flex items-center justify-between gap-2">
                <span class="text-[11px] text-base-content/55">账号</span>
                <button class="btn btn-ghost btn-xs" data-pit-copy="account" data-index="${index}" ${available ? '' : 'disabled'}>复制</button>
              </div>
              <code class="block truncate text-xs">${escapeHtml(item.account || '-')}</code>
            </div>

            <div class="rounded-box bg-base-100 px-2 py-2">
              <div class="mb-1 flex items-center justify-between gap-2">
                <span class="text-[11px] text-base-content/55">密码</span>
                <button class="btn btn-ghost btn-xs" data-pit-copy="password" data-index="${index}" ${available ? '' : 'disabled'}>复制</button>
              </div>
              <code class="block truncate text-xs">${escapeHtml(item.password || '-')}</code>
            </div>

            <div class="rounded-box bg-base-100 px-2 py-2">
              <div class="mb-1 flex items-center justify-between gap-2">
                <span class="text-[11px] text-base-content/55">验证码</span>
                <button class="btn btn-xs btn-outline" data-action="fetch-code" data-index="${index}" ${available ? '' : 'disabled'}>
                  ${loading ? '<span class="loading loading-spinner loading-xs"></span>获取中' : '获取验证码'}
                </button>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 truncate text-xs">${escapeHtml(code || '-')}</code>
                <button class="btn btn-ghost btn-xs" data-pit-copy="code" data-index="${index}" ${code ? '' : 'disabled'}>复制</button>
              </div>
            </div>
          </div>
        </article>
      `
    })
    .join('')
}

async function refreshAccounts() {
  state.accounts = await invoke('load_accounts')
  if (!state.selectedAccount && state.accounts.length) {
    state.selectedAccount = state.accounts[0].account
  }
  renderAccounts()
}

async function saveAccountOnly() {
  const account = els.accountInput.value.trim()
  const password = els.passwordInput.value
  if (!account || !password) {
    setStatus('请先输入账号和密码')
    return
  }

  await invoke('save_account', { account, password })
  state.selectedAccount = account
  await refreshAccounts()
  setStatus('账号已保存')
}

async function login(account, password) {
  if (!account || !password) {
    setStatus('账号或密码为空')
    return
  }

  setStatus('登录中...', '接口返回成功后会自动刷新 pit 栏位。')
  const result = await invoke('login', { account, password })
  state.token = result.token
  state.selectedAccount = account
  state.pitCodes = {}
  state.loadingCodes = {}
  await refreshAccounts()
  setStatus('登录成功', `当前账号: ${result.email || account}`)
  await fetchPits()
}

async function fetchPits() {
  if (!state.token) {
    const current = selectedAccountRecord()
    state.token = current?.token || ''
  }
  if (!state.token) {
    setStatus('缺少 token', '请先登录一个账号。')
    return
  }

  setStatus('加载 pit...', '正在获取三个栏位信息。')
  const result = await invoke('fetch_pits', { token: state.token })
  state.pits = result.map((item) => ({ ...item, title: pitTitle(item.pit) }))
  renderPits()
  setStatus('pit 已刷新', '已按接口顺序展示三个栏位。')
}

async function fetchCode(index) {
  const pit = state.pits[index]
  if (!pit?.account || !pit?.seat_id) {
    setStatus('该栏位不可获取验证码')
    return
  }

  state.loadingCodes[index] = true
  renderPits()
  try {
    const code = await invoke('fetch_verification_code', {
      token: state.token,
      userName: pit.account,
      busSeatId: pit.seat_id,
    })
    state.pitCodes[index] = code
    setStatus('验证码已获取', `栏位 ${index + 1}: ${code}`)
  } catch (error) {
    setStatus('验证码获取失败', String(error))
  } finally {
    delete state.loadingCodes[index]
    renderPits()
  }
}

async function exportAccounts() {
  const path = await invoke('export_accounts')
  setStatus('导出完成', path)
}

els.loginButton.addEventListener('click', async () => {
  setButtonLoading(els.loginButton, true, '登录中')
  try {
    await login(els.accountInput.value.trim(), els.passwordInput.value)
  } catch (error) {
    setStatus('登录失败', String(error))
  } finally {
    setButtonLoading(els.loginButton, false, '登录')
  }
})

els.saveButton.addEventListener('click', async () => {
  try {
    await saveAccountOnly()
  } catch (error) {
    setStatus('保存失败', String(error))
  }
})

els.refreshPitButton.addEventListener('click', async () => {
  try {
    await fetchPits()
  } catch (error) {
    setStatus('pit 获取失败', String(error))
  }
})

els.clearButton.addEventListener('click', () => {
  els.accountInput.value = ''
  els.passwordInput.value = ''
  state.token = ''
  state.pits = []
  state.pitCodes = {}
  renderPits()
  setStatus('已清空输入')
})

els.copyTokenButton.addEventListener('click', async () => {
  try {
    await copyText(state.token, 'Token 已复制')
  } catch (error) {
    setStatus('复制失败', String(error))
  }
})

els.exportButton.addEventListener('click', async () => {
  try {
    await exportAccounts()
  } catch (error) {
    setStatus('导出失败', String(error))
  }
})

els.accountList.addEventListener('click', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return

  const action = target.dataset.action
  const account = target.dataset.account
  if (!action || !account) return

  const record = state.accounts.find((item) => item.account === account)
  if (!record) return

  if (action === 'load') {
    els.accountInput.value = record.account
    els.passwordInput.value = record.password
    state.selectedAccount = record.account
    renderAccounts()
    try {
      await login(record.account, record.password)
    } catch (error) {
      setStatus('登录失败', String(error))
    }
    return
  }

  if (action === 'copy-account') {
    await copyText(record.account, '账号已复制')
  }

  if (action === 'copy-password') {
    await copyText(record.password, '密码已复制')
  }
})

els.pitGrid.addEventListener('click', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return

  const action = target.dataset.action
  const type = target.dataset.pitCopy
  const index = Number(target.dataset.index)
  if (Number.isNaN(index)) return

  if (action === 'fetch-code') {
    await fetchCode(index)
    return
  }

  const pit = state.pits[index]
  if (!pit) return

  if (type === 'account') {
    await copyText(pit.account, 'pit 账号已复制')
  }

  if (type === 'password') {
    await copyText(pit.password, 'pit 密码已复制')
  }

  if (type === 'code') {
    await copyText(state.pitCodes[index], '验证码已复制')
  }
})

async function boot() {
  renderPits()
  try {
    await refreshAccounts()
    const current = selectedAccountRecord()
    if (current) {
      els.accountInput.value = current.account
      els.passwordInput.value = current.password
      state.token = current.token || ''
    }
    setStatus('准备完成', '界面已收紧为插件风格，只保留必要操作。')
  } catch (error) {
    setStatus('初始化失败', String(error))
  }
}

boot()
