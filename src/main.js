import './style.css'
import { invoke } from '@tauri-apps/api/core'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="app-shell bg-base-200 pb-16 text-base-content">
    <main class="mx-auto flex max-w-[1320px] flex-col gap-3 p-3">
      <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="avatar placeholder">
              <div class="w-10 rounded-xl bg-neutral text-neutral-content">
                <span class="text-sm font-bold">AS</span>
              </div>
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.24em] text-base-content/55">AutoSign Lite</p>
              <h1 class="text-base font-semibold">账号与栏位</h1>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span id="accountCount" class="badge badge-neutral badge-sm">0</span>
            <button id="exportButton" class="btn btn-xs btn-outline">导出</button>
            <button id="filterUniqueButton" class="btn btn-xs btn-outline">筛选重复</button>
            <button id="refreshPitButton" class="btn btn-xs btn-outline">刷新栏位</button>
            <button id="rentChatgptButton" class="btn btn-xs btn-primary">借ChatGPT</button>
          </div>
        </div>

        <div class="mb-3 rounded-box border border-base-300 bg-base-200/60 p-2">
          <div class="flex items-center gap-2">
            <div class="tabs tabs-boxed shrink-0 bg-base-100 p-1">
              <button id="passwordTab" class="tab tab-sm tab-active">密码登录</button>
              <button id="phoneTab" class="tab tab-sm">手机号登录</button>
            </div>

            <section id="passwordPanel" class="grid min-w-0 flex-1 grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)] gap-2">
              <input id="accountInput" class="input input-sm input-bordered w-full" placeholder="账号 / 邮箱" autocomplete="username" />
              <input id="passwordInput" type="password" class="input input-sm input-bordered w-full" placeholder="密码" autocomplete="current-password" />
            </section>

            <section id="phonePanel" class="hidden min-w-0 flex-1 grid-cols-[minmax(140px,0.8fr)_112px_minmax(120px,0.7fr)_112px_minmax(120px,0.7fr)] gap-2">
              <input id="phoneInput" class="input input-sm input-bordered w-full" placeholder="手机号" autocomplete="tel" />
              <button id="refreshCaptchaButton" class="captcha-box btn btn-sm btn-outline overflow-hidden px-0">
                <img id="captchaImage" class="hidden h-full w-full object-cover" alt="captcha" />
                <span id="captchaPlaceholder" class="text-[11px] text-base-content/60">验证码图</span>
              </button>
              <input id="captchaInput" class="input input-sm input-bordered w-full" placeholder="图形验证码" />
              <button id="requestSmsButton" class="btn btn-sm btn-outline">获取短信码</button>
              <input id="smsCodeInput" class="input input-sm input-bordered w-full" placeholder="短信验证码" inputmode="numeric" />
            </section>

            <div class="grid shrink-0 grid-cols-4 gap-2">
              <button id="loginButton" class="btn btn-sm btn-primary">登录</button>
              <button id="saveButton" class="btn btn-sm btn-outline">保存</button>
              <button id="clearButton" class="btn btn-sm btn-ghost">清空</button>
              <button id="copyTokenButton" class="btn btn-sm btn-ghost">Token</button>
            </div>
          </div>
        </div>

        <div id="accountList" class="h-[620px] space-y-2 overflow-y-auto pr-1 text-sm">
          <div class="rounded-box bg-base-200 px-3 py-8 text-center text-base-content/50">暂无已保存账号</div>
        </div>
      </section>
    </main>

    <footer class="fixed inset-x-0 bottom-0 z-10 border-t border-base-300 bg-base-100/95 px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div class="mx-auto flex max-w-[1320px] items-center gap-3">
        <span class="badge badge-neutral badge-sm">Status</span>
        <p id="statusText" class="text-sm font-semibold">等待操作</p>
        <p id="statusHint" class="min-w-0 flex-1 truncate text-xs text-base-content/60">支持密码登录和手机号验证码登录。</p>
      </div>
    </footer>
  </div>
`

const els = {
  passwordTab: document.querySelector('#passwordTab'),
  phoneTab: document.querySelector('#phoneTab'),
  passwordPanel: document.querySelector('#passwordPanel'),
  phonePanel: document.querySelector('#phonePanel'),
  accountInput: document.querySelector('#accountInput'),
  passwordInput: document.querySelector('#passwordInput'),
  phoneInput: document.querySelector('#phoneInput'),
  captchaInput: document.querySelector('#captchaInput'),
  smsCodeInput: document.querySelector('#smsCodeInput'),
  captchaImage: document.querySelector('#captchaImage'),
  captchaPlaceholder: document.querySelector('#captchaPlaceholder'),
  refreshCaptchaButton: document.querySelector('#refreshCaptchaButton'),
  requestSmsButton: document.querySelector('#requestSmsButton'),
  loginButton: document.querySelector('#loginButton'),
  saveButton: document.querySelector('#saveButton'),
  refreshPitButton: document.querySelector('#refreshPitButton'),
  clearButton: document.querySelector('#clearButton'),
  copyTokenButton: document.querySelector('#copyTokenButton'),
  exportButton: document.querySelector('#exportButton'),
  filterUniqueButton: document.querySelector('#filterUniqueButton'),
  rentChatgptButton: document.querySelector('#rentChatgptButton'),
  accountList: document.querySelector('#accountList'),
  accountCount: document.querySelector('#accountCount'),
  statusText: document.querySelector('#statusText'),
  statusHint: document.querySelector('#statusHint'),
}

const state = {
  accounts: [],
  token: '',
  selectedAccount: '',
  selectedLoginType: 'password',
  accountOrder: [],
  usedAccounts: new Set(),
  accountLeases: {},
  accountPits: {},
  accountMembers: {},
  expandedAccount: '',
  showUniquePits: false,
  pits: [],
  loadingCodes: {},
  pitCodes: {},
  captchaId: '',
  captchaLength: 0,
  openCaptcha: false,
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
const accountTypeLabel = (type) => (type === 'phone' ? '手机号' : '账号')
const maskPassword = (value) => (value ? value : '-')

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

function ensureToken() {
  if (!state.token) {
    const current = selectedAccountRecord()
    state.token = current?.token || ''
  }
  return state.token
}

function setLoginMode(mode) {
  state.selectedLoginType = mode
  const passwordMode = mode === 'password'
  els.passwordTab.classList.toggle('tab-active', passwordMode)
  els.phoneTab.classList.toggle('tab-active', !passwordMode)
  els.passwordPanel.classList.toggle('hidden', !passwordMode)
  els.phonePanel.classList.toggle('hidden', passwordMode)
  els.phonePanel.classList.toggle('grid', !passwordMode)
}

function applyCaptcha(data) {
  state.captchaId = data.captcha_id || ''
  state.captchaLength = Number(data.captcha_length || 0)
  state.openCaptcha = Boolean(data.open_captcha)

  if (data.pic_path) {
    els.captchaImage.src = data.pic_path
    els.captchaImage.classList.remove('hidden')
    els.captchaPlaceholder.classList.add('hidden')
  } else {
    els.captchaImage.removeAttribute('src')
    els.captchaImage.classList.add('hidden')
    els.captchaPlaceholder.classList.remove('hidden')
  }
}

function setCaptchaLoading(loading) {
  els.refreshCaptchaButton.disabled = loading
  if (loading) {
    els.captchaPlaceholder.textContent = '获取中'
    els.captchaPlaceholder.classList.remove('hidden')
    els.captchaImage.classList.add('hidden')
    return
  }

  if (els.captchaImage.getAttribute('src')) {
    els.captchaImage.classList.remove('hidden')
    els.captchaPlaceholder.classList.add('hidden')
  } else {
    els.captchaPlaceholder.textContent = '获取图片'
    els.captchaPlaceholder.classList.remove('hidden')
  }
}

async function copyText(value, successText) {
  if (!value) return
  await navigator.clipboard.writeText(value)
  setStatus(successText)
}

function selectedAccountRecord() {
  return state.accounts.find((item) => item.account === state.selectedAccount)
}

function stableAccountOrder(accounts) {
  const known = new Set(state.accountOrder)
  const incoming = accounts.map((item) => item.account)
  const nextOrder = [
    ...state.accountOrder.filter((account) => incoming.includes(account)),
    ...incoming.filter((account) => !known.has(account)),
  ]

  state.accountOrder = nextOrder
  const indexByAccount = new Map(nextOrder.map((account, index) => [account, index]))
  return [...accounts].sort((a, b) => {
    const aIndex = indexByAccount.get(a.account) ?? Number.MAX_SAFE_INTEGER
    const bIndex = indexByAccount.get(b.account) ?? Number.MAX_SAFE_INTEGER
    return aIndex - bIndex
  })
}

function parseExpireTime(value) {
  if (!value) return 0
  if (typeof value === 'number') {
    return value > 9999999999 ? value : value * 1000
  }

  const text = String(value).trim()
  if (!text) return 0
  if (/^\d+$/.test(text)) {
    const timestamp = Number(text)
    return timestamp > 9999999999 ? timestamp : timestamp * 1000
  }

  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatExpireTime(value) {
  const time = parseExpireTime(value)
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatExpireCountdown(value) {
  const time = parseExpireTime(value)
  if (!time) return ''

  const diffSeconds = Math.max(0, Math.floor((time - Date.now()) / 1000))
  if (diffSeconds <= 0) return '已过期'

  const days = Math.floor(diffSeconds / 86400)
  const hours = Math.floor((diffSeconds % 86400) / 3600)
  const minutes = Math.floor((diffSeconds % 3600) / 60)
  const seconds = diffSeconds % 60

  return `还剩 ${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`
}

function accountUsageState(account) {
  const lease = state.accountLeases[account]
  const expireTime = parseExpireTime(lease?.expire)
  if (expireTime) {
    if (expireTime > Date.now()) {
      return {
        className: 'border-success bg-success/5',
        badge: '已用',
        badgeClass: 'badge-success',
        expireText: `栏位${formatExpireCountdown(lease.expire)}`,
        expireClass: 'badge-success',
        hint: '',
      }
    }

    return {
      className: 'border-warning bg-warning/5',
      badge: '已过期',
      badgeClass: 'badge-warning',
      expireText: `栏位到期：${formatExpireTime(lease.expire)}`,
      expireClass: 'badge-warning',
      hint: '可重新借',
    }
  }

  if (state.usedAccounts.has(account)) {
    return {
      className: 'border-success bg-success/5',
      badge: '已用',
      badgeClass: 'badge-success',
      expireText: '',
      expireClass: '',
      hint: '本轮已载入',
    }
  }

  return {
    className: 'border-base-300',
    badge: '未用',
    badgeClass: 'badge-ghost',
    expireText: '',
    expireClass: '',
    hint: '',
  }
}

function renderInlinePitSummary(account, pits) {
  if (!pits.length) return ''

  const firstPit = pits[0]
  const key = `${account}:0`
  const firstCode = state.pitCodes[key] || ''
  const loading = Boolean(state.loadingCodes[key])
  const available = Boolean(firstPit.account && firstPit.seat_id)

  return `
    <span class="inline-flex min-w-0 items-center gap-1 rounded-full bg-base-200 px-2 py-1">
      <span class="shrink-0 cursor-pointer text-base-content/55" data-action="toggle-pits" data-account="${escapeHtml(account)}">栏位</span>
      <span class="badge badge-outline badge-xs shrink-0">${escapeHtml(firstPit.name || firstPit.title || pitTitle(firstPit.pit))}</span>
      <code class="max-w-[180px] cursor-pointer truncate rounded bg-warning/20 px-1.5 py-0.5 font-semibold text-warning-content" data-action="copy-account-pit" data-account="${escapeHtml(account)}" data-index="0">${escapeHtml(firstPit.account || '-')}</code>
      <code class="max-w-[180px] cursor-pointer truncate rounded bg-info/15 px-1.5 py-0.5 font-semibold text-info-content" data-action="copy-password-pit" data-account="${escapeHtml(account)}" data-index="0">${escapeHtml(firstPit.password || '-')}</code>
      <button class="btn btn-ghost btn-xs h-5 min-h-5 shrink-0 px-1.5" data-action="fetch-account-code" data-account="${escapeHtml(account)}" data-index="0" ${available ? '' : 'disabled'}>
        ${loading ? '<span class="loading loading-spinner loading-xs"></span>获取中' : (firstCode ? `验证码：${escapeHtml(firstCode)}` : '验证码')}
      </button>
    </span>
  `
}

function renderAccountPitDetails(account, pits, expanded) {
  if (!pits.length || !expanded) return ''

  const details = pits
    .map((pit, index) => {
      const key = `${account}:${index}`
      const code = state.pitCodes[key] || ''
      const loading = Boolean(state.loadingCodes[key])
      const available = Boolean(pit.account && pit.seat_id)
      return `
        <div class="grid grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_74px] items-center gap-2 rounded-box bg-base-100 px-2 py-2 text-xs">
          <span class="badge badge-outline badge-sm">${escapeHtml(pit.name || pit.title || pitTitle(pit.pit))}</span>
          <code class="cursor-pointer truncate rounded bg-base-200 px-2 py-1" data-action="copy-account-pit" data-account="${escapeHtml(account)}" data-index="${index}">${escapeHtml(pit.account || '-')}</code>
          <code class="cursor-pointer truncate rounded bg-base-200 px-2 py-1" data-action="copy-password-pit" data-account="${escapeHtml(account)}" data-index="${index}">${escapeHtml(pit.password || '-')}</code>
          <button class="btn btn-xs btn-outline" data-action="fetch-account-code" data-account="${escapeHtml(account)}" data-index="${index}" data-no-expand="true" ${available ? '' : 'disabled'}>
            ${loading ? '<span class="loading loading-spinner loading-xs"></span>获取中' : (code ? escapeHtml(code) : '验证码')}
          </button>
        </div>
      `
    })
    .join('')

  return `<div class="mt-2 space-y-2">${details}</div>`
}

function uniquePitAccounts() {
  const unique = new Map()

  Object.entries(state.accountPits).forEach(([ownerAccount, pits]) => {
    pits.forEach((pit) => {
      const pitAccount = String(pit.account || '').trim()
      if (!pitAccount) return

      const existing = unique.get(pitAccount)
      if (existing) {
        existing.count += 1
        existing.owners.add(ownerAccount)
        return
      }

      unique.set(pitAccount, {
        account: pitAccount,
        name: pit.name || pit.title || pitTitle(pit.pit),
        owners: new Set([ownerAccount]),
        count: 1,
      })
    })
  })

  return [...unique.values()].map((item) => ({
    ...item,
    owners: [...item.owners],
  }))
}

function renderUniquePitAccounts() {
  if (!state.showUniquePits) return ''

  const items = uniquePitAccounts()
  const total = Object.values(state.accountPits)
    .flat()
    .filter((pit) => String(pit.account || '').trim())
    .length
  const duplicateCount = Math.max(total - items.length, 0)

  if (!items.length) {
    return `
      <section class="sticky bottom-0 rounded-box border border-warning/30 bg-warning/10 p-3 text-xs text-warning-content shadow-sm">
        暂无可筛选的栏位账号。先载入账号并刷新栏位后再筛选。
      </section>
    `
  }

  return `
    <section class="sticky bottom-0 rounded-box border border-warning/40 bg-warning/10 p-3 shadow-sm backdrop-blur">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="badge badge-warning badge-sm">去重栏位账号</span>
          <span class="text-xs text-warning-content/75">不同 ${items.length} 个，已筛掉重复 ${duplicateCount} 个</span>
        </div>
        <button class="btn btn-ghost btn-xs text-warning-content" data-action="hide-unique-pits">收起</button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${items.map((item) => `
          <button class="btn btn-xs h-auto min-h-0 max-w-[260px] border-warning/50 bg-warning/20 px-2 py-1 text-warning-content hover:bg-warning/30" data-action="copy-unique-pit" data-value="${escapeHtml(item.account)}" title="${escapeHtml(item.account)}">
            <span class="truncate font-semibold">${escapeHtml(item.account)}</span>
            <span class="badge badge-outline badge-xs shrink-0">${escapeHtml(item.name)}</span>
            ${item.count > 1 ? `<span class="badge badge-warning badge-xs shrink-0">x${item.count}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function renderMemberTags(account) {
  const member = state.accountMembers[account]
  if (!member) return ''

  const days = Number(member.days || 0)
  const points = Number(member.points_avail || 0)
  const daysClass = days > 0 ? 'badge-success' : 'badge-warning'

  return `
    <span class="badge ${daysClass} badge-xs shrink-0">剩余 ${escapeHtml(days)} 天</span>
    <span class="badge badge-info badge-xs shrink-0">积分 ${escapeHtml(points)}</span>
  `
}

function renderAccounts() {
  const usedCount = state.accounts.filter((item) => accountUsageState(item.account).badge === '已用').length
  els.accountCount.textContent = usedCount ? `${usedCount}/${state.accounts.length}` : String(state.accounts.length)
  if (!state.accounts.length) {
    els.accountList.innerHTML =
      '<div class="rounded-box bg-base-200 px-3 py-8 text-center text-base-content/50">暂无已保存账号</div>'
    return
  }

  const accountCards = state.accounts
    .map((item) => {
      const isActive = item.account === state.selectedAccount
      const expanded = state.expandedAccount === item.account
      const pits = state.accountPits[item.account] || []
      const usage = accountUsageState(item.account)
      const activeClass = isActive
        ? 'border-primary bg-primary/5'
        : usage.className
      const typeLabel = accountTypeLabel(item.login_type)
      return `
        <article class="rounded-box border ${activeClass} px-3 py-2 transition-colors" data-account="${escapeHtml(item.account)}">
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1 rounded-box bg-base-200 px-2 py-2 text-xs">
              <span class="text-base-content/55">${typeLabel}：</span>
              <code class="mr-2 inline bg-transparent px-0 py-0">${escapeHtml(item.account)}</code>
              <span class="text-base-content/55">密码：</span>
              <code class="inline bg-transparent px-0 py-0">${escapeHtml(maskPassword(item.password))}</code>
              <span class="ml-2 inline-flex items-center gap-1 align-middle">${renderMemberTags(item.account)}</span>
            </div>
            <button class="btn btn-xs btn-ghost" data-action="copy-account" data-account="${escapeHtml(item.account)}">复制账号</button>
            <button class="btn btn-xs btn-ghost" data-action="copy-password" data-account="${escapeHtml(item.account)}" ${item.password ? '' : 'disabled'}>复制密码</button>
            <button class="btn btn-xs btn-primary" data-action="load" data-account="${escapeHtml(item.account)}">载入</button>
            <button class="btn btn-xs btn-ghost text-error" data-action="delete" data-account="${escapeHtml(item.account)}">删除</button>
          </div>
          <div class="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] text-base-content/55">
            <div class="min-w-0 flex-1">${renderInlinePitSummary(item.account, pits)}</div>
            <div class="flex shrink-0 items-center gap-2">
              ${usage.expireText ? `<span class="badge ${usage.expireClass} badge-xs px-2 font-semibold">${escapeHtml(usage.expireText)}</span>` : ''}
              ${usage.hint ? `<span>${escapeHtml(usage.hint)}</span>` : ''}
              <span class="badge ${usage.badgeClass} badge-xs">${escapeHtml(usage.badge)}</span>
            </div>
          </div>
          ${renderAccountPitDetails(item.account, pits, expanded)}
        </article>
      `
    })
    .join('')
  els.accountList.innerHTML = accountCards + renderUniquePitAccounts()
}

function renderPits() {
  renderAccounts()
}

async function refreshAccounts() {
  state.accounts = stableAccountOrder(await invoke('load_accounts'))
  if (!state.selectedAccount && state.accounts.length) {
    state.selectedAccount = state.accounts[0].account
  }
  renderAccounts()
}

async function saveCurrentAccount() {
  if (state.selectedLoginType === 'phone') {
    const phone = els.phoneInput.value.trim()
    if (!phone) {
      setStatus('请先输入手机号')
      return
    }
    await invoke('save_account', { account: phone, password: '', loginType: 'phone' })
    state.selectedAccount = phone
    await refreshAccounts()
    setStatus('手机号已保存')
    return
  }

  const account = els.accountInput.value.trim()
  const password = els.passwordInput.value
  if (!account || !password) {
    setStatus('请先输入账号和密码')
    return
  }

  await invoke('save_account', { account, password, loginType: 'password' })
  state.selectedAccount = account
  await refreshAccounts()
  setStatus('账号已保存')
}

async function fetchMemberInfoForAccount(account, token = state.token, silent = false) {
  if (!account || !token) return null

  try {
    const member = await invoke('fetch_member_info', { token })
    state.accountMembers[account] = member
    renderAccounts()
    return member
  } catch (error) {
    if (!silent) {
      setStatus('会员信息获取失败', String(error))
    }
    return null
  }
}

async function deleteAccount(account) {
  const confirmed = window.confirm(`确定删除账号“${account}”的本地记录吗？`)
  if (!confirmed) return

  const deletingSelected = state.selectedAccount === account
  await invoke('delete_account', { account })
  state.usedAccounts.delete(account)
  delete state.accountLeases[account]
  delete state.accountPits[account]
  delete state.accountMembers[account]
  state.accountOrder = state.accountOrder.filter((item) => item !== account)
  if (state.expandedAccount === account) {
    state.expandedAccount = ''
  }

  if (deletingSelected) {
    state.selectedAccount = ''
    state.token = ''
    state.pits = []
    state.pitCodes = {}
    state.loadingCodes = {}
    state.accountLeases = {}
    state.accountPits = {}
    state.accountMembers = {}
    renderPits()
  }

  await refreshAccounts()
  setStatus('账号已删除', account)
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
  state.usedAccounts.add(account)
  state.selectedLoginType = result.login_type || 'password'
  state.pitCodes = {}
  state.loadingCodes = {}
  await refreshAccounts()
  await fetchMemberInfoForAccount(account, state.token)
  renderAccounts()
  setStatus('登录成功', `当前账号: ${result.account || account}`)
  await fetchPits()
}

async function loginByPhone(phone, code) {
  if (!phone || !code) {
    setStatus('手机号或短信验证码为空')
    return
  }

  setStatus('手机号登录中...', '登录成功后会自动刷新 pit 栏位。')
  const result = await invoke('login_by_phone', { phone, code })
  state.token = result.token
  state.selectedAccount = result.account || phone
  state.usedAccounts.add(state.selectedAccount)
  state.selectedLoginType = 'phone'
  state.pitCodes = {}
  state.loadingCodes = {}
  await refreshAccounts()
  await fetchMemberInfoForAccount(state.selectedAccount, state.token)
  renderAccounts()
  setStatus('手机号登录成功', `当前账号: ${result.account || phone}`)
  await fetchPits()
}

async function fetchPhoneCaptcha() {
  setCaptchaLoading(true)
  try {
    const result = await invoke('fetch_phone_captcha')
    applyCaptcha(result)
    els.captchaInput.value = ''
    setStatus('图形验证码已更新', state.openCaptcha ? `需输入 ${state.captchaLength || 0} 位图形验证码` : '当前接口未开启图形验证码')
  } catch (error) {
    setStatus('图形验证码获取失败', String(error))
  } finally {
    setCaptchaLoading(false)
  }
}

async function requestSmsCode() {
  const phone = els.phoneInput.value.trim()
  const captcha = els.captchaInput.value.trim()
  if (!phone) {
    setStatus('请先输入手机号')
    return
  }
  if (!state.captchaId) {
    setStatus('请先获取图形验证码')
    return
  }
  if (state.openCaptcha && !captcha) {
    setStatus('请先输入图形验证码')
    return
  }

  setButtonLoading(els.requestSmsButton, true, '发送中')
  try {
    await invoke('request_phone_code', {
      phone,
      captcha,
      captchaId: state.captchaId,
    })
    setStatus('短信验证码已发送', `手机号: ${phone}`)
  } catch (error) {
    setStatus('短信验证码发送失败', String(error))
  } finally {
    setButtonLoading(els.requestSmsButton, false, '获取短信码')
  }
}

function storeAccountPits(ownerAccount, pits) {
  if (!ownerAccount) return

  const activePits = pits.filter((pit) => pit.account && pit.expire)
  const latestLease = activePits.reduce((latest, pit) => {
    if (!latest) return pit
    return parseExpireTime(pit.expire) > parseExpireTime(latest.expire) ? pit : latest
  }, null)

  state.usedAccounts.add(ownerAccount)
  if (latestLease) {
    state.accountLeases[ownerAccount] = {
      expire: latestLease.expire,
      seatId: latestLease.seat_id,
    }
  } else {
    delete state.accountLeases[ownerAccount]
  }
  state.accountPits[ownerAccount] = pits
}

async function fetchPitsForAccount(ownerAccount, token, updateCurrentPits = false) {
  const result = await invoke('fetch_pits', { token })
  const pits = result.map((item) => ({ ...item, title: pitTitle(item.pit) }))
  storeAccountPits(ownerAccount, pits)
  if (updateCurrentPits) {
    state.pits = pits
  }
  renderAccounts()
  return pits
}

async function fetchPits() {
  if (!ensureToken()) {
    setStatus('缺少 token', '请先登录一个账号。')
    return
  }

  const ownerAccount = state.selectedAccount || selectedAccountRecord()?.account || ''
  setStatus('加载 pit...', '正在获取三个栏位信息。')
  await fetchPitsForAccount(ownerAccount, state.token, true)
  setStatus('pit 已刷新', '已按接口顺序展示三个栏位。')
}

async function refreshAllAccountPits() {
  if (!state.accounts.length) {
    setStatus('暂无账号', '请先保存账号。')
    return
  }

  const accountsWithToken = state.accounts.filter((item) => item.token)
  const skipped = state.accounts.length - accountsWithToken.length
  if (!accountsWithToken.length) {
    setStatus('缺少 token', '所有账号都需要先登录一次后才能批量刷新。')
    return
  }

  let success = 0
  const failed = []
  setButtonLoading(els.refreshPitButton, true, '刷新中')
  try {
    for (const [index, item] of accountsWithToken.entries()) {
      setStatus('批量刷新栏位...', `${index + 1}/${accountsWithToken.length}：${item.account}`)
      try {
        await fetchPitsForAccount(item.account, item.token, item.account === state.selectedAccount)
        await fetchMemberInfoForAccount(item.account, item.token, true)
        success += 1
      } catch (error) {
        failed.push(`${item.account}: ${String(error)}`)
      }
    }

    const parts = [`成功 ${success} 个`]
    if (skipped) parts.push(`跳过 ${skipped} 个无 token`)
    if (failed.length) parts.push(`失败 ${failed.length} 个`)
    setStatus('批量刷新完成', parts.join('，'))
  } finally {
    setButtonLoading(els.refreshPitButton, false, '刷新栏位')
    renderAccounts()
  }
}

async function rentChatgpt() {
  if (!ensureToken()) {
    setStatus('请先登录', '登录后才可以借 ChatGPT。')
    return
  }

  setButtonLoading(els.rentChatgptButton, true, '租借中')
  try {
    await invoke('rent_chatgpt', { token: state.token })
    setStatus('租借成功', '正在刷新栏位。')
    await fetchPits()
  } catch (error) {
    const message = String(error)
    setStatus('租借失败', message.includes('已租借或无空栏位') ? '已租借或无空栏位' : message)
  } finally {
    setButtonLoading(els.rentChatgptButton, false, '借ChatGPT')
  }
}

async function fetchAccountPitCode(account, index) {
  const pit = state.accountPits[account]?.[index]
  if (!pit?.account || !pit?.seat_id) {
    setStatus('该栏位不可获取验证码')
    return
  }

  const key = `${account}:${index}`
  state.loadingCodes[key] = true
  renderAccounts()
  try {
    const record = state.accounts.find((item) => item.account === account)
    const code = await invoke('fetch_verification_code', {
      token: record?.token || state.token,
      userName: pit.account,
      busSeatId: pit.seat_id,
    })
    state.pitCodes[key] = code
    setStatus('验证码已获取', `栏位 ${index + 1}: ${code}`)
  } catch (error) {
    setStatus('验证码获取失败', String(error))
  } finally {
    delete state.loadingCodes[key]
    renderAccounts()
  }
}

async function exportAccounts() {
  const path = await invoke('export_accounts')
  setStatus('导出完成', path)
}

function clearInputs() {
  els.accountInput.value = ''
  els.passwordInput.value = ''
  els.phoneInput.value = ''
  els.captchaInput.value = ''
  els.smsCodeInput.value = ''
  state.token = ''
  state.pits = []
  state.pitCodes = {}
  state.accountLeases = {}
  state.accountPits = {}
  state.accountMembers = {}
  state.expandedAccount = ''
  state.captchaId = ''
  state.captchaLength = 0
  state.openCaptcha = false
  els.captchaImage.removeAttribute('src')
  els.captchaImage.classList.add('hidden')
  els.captchaPlaceholder.textContent = '获取图片'
  els.captchaPlaceholder.classList.remove('hidden')
  renderPits()
  setStatus('已清空输入')
}

els.passwordTab.addEventListener('click', () => setLoginMode('password'))
els.phoneTab.addEventListener('click', async () => {
  setLoginMode('phone')
  if (!state.captchaId) {
    await fetchPhoneCaptcha()
  }
})

els.refreshCaptchaButton.addEventListener('click', async () => {
  await fetchPhoneCaptcha()
})

els.requestSmsButton.addEventListener('click', async () => {
  await requestSmsCode()
})

els.loginButton.addEventListener('click', async () => {
  setButtonLoading(els.loginButton, true, '登录中')
  try {
    if (state.selectedLoginType === 'phone') {
      await loginByPhone(els.phoneInput.value.trim(), els.smsCodeInput.value.trim())
    } else {
      await login(els.accountInput.value.trim(), els.passwordInput.value)
    }
  } catch (error) {
    setStatus('登录失败', String(error))
  } finally {
    setButtonLoading(els.loginButton, false, '登录')
  }
})

els.saveButton.addEventListener('click', async () => {
  try {
    await saveCurrentAccount()
  } catch (error) {
    setStatus('保存失败', String(error))
  }
})

els.refreshPitButton.addEventListener('click', async () => {
  try {
    await refreshAllAccountPits()
  } catch (error) {
    setStatus('批量刷新失败', String(error))
  }
})

els.clearButton.addEventListener('click', () => {
  clearInputs()
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

els.filterUniqueButton.addEventListener('click', () => {
  state.showUniquePits = true
  renderAccounts()
  const uniqueCount = uniquePitAccounts().length
  setStatus('已筛选重复栏位账号', uniqueCount ? `去重后 ${uniqueCount} 个栏位账号。` : '暂无可筛选的栏位账号。')
})

els.rentChatgptButton.addEventListener('click', async () => {
  await rentChatgpt()
})

els.accountList.addEventListener('click', async (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return

  const actionTarget = target.closest('[data-action]')
  const card = target.closest('[data-account]')
  const action = actionTarget?.dataset.action
  const account = actionTarget?.dataset.account || card?.dataset.account

  if (!action) return

  if (action === 'copy-unique-pit') {
    await copyText(actionTarget?.dataset.value, '栏位账号已复制')
    return
  }

  if (action === 'hide-unique-pits') {
    state.showUniquePits = false
    renderAccounts()
    setStatus('已收起筛选结果')
    return
  }

  if (!account) return

  const record = state.accounts.find((item) => item.account === account)
  const pitIndex = Number(actionTarget?.dataset.index)

  if (action === 'toggle-pits') {
    state.expandedAccount = state.expandedAccount === account ? '' : account
    renderAccounts()
    return
  }

  if (action === 'copy-account-pit') {
    const pit = state.accountPits[account]?.[pitIndex]
    await copyText(pit?.account, '栏位账号已复制')
    return
  }

  if (action === 'copy-password-pit') {
    const pit = state.accountPits[account]?.[pitIndex]
    await copyText(pit?.password, '栏位密码已复制')
    return
  }

  if (action === 'fetch-account-code') {
    await fetchAccountPitCode(account, pitIndex)
    return
  }

  if (!record) return

  if (action === 'load') {
    state.selectedAccount = record.account
    state.token = record.token || state.token
    state.usedAccounts.add(record.account)
    setLoginMode(record.login_type || 'password')
    renderAccounts()

    if ((record.login_type || 'password') === 'phone') {
      els.phoneInput.value = record.account
      els.smsCodeInput.value = ''
      if (record.token) {
        await fetchMemberInfoForAccount(record.account, record.token)
      }
      if (!state.captchaId) {
        await fetchPhoneCaptcha()
      }
      setStatus('手机号已载入', '输入图形验证码并获取短信码后可登录。')
      return
    }

    els.accountInput.value = record.account
    els.passwordInput.value = record.password
    try {
      await login(record.account, record.password)
    } catch (error) {
      setStatus('登录失败', String(error))
    }
    return
  }

  if (action === 'delete') {
    try {
      await deleteAccount(record.account)
    } catch (error) {
      setStatus('删除失败', String(error))
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

setInterval(() => {
  if (state.accounts.length) {
    renderAccounts()
  }
}, 1000)

async function boot() {
  renderPits()
  setLoginMode('password')
  try {
    await refreshAccounts()
    const current = selectedAccountRecord()
    if (current) {
      state.selectedLoginType = current.login_type || 'password'
      setLoginMode(state.selectedLoginType)
      if (state.selectedLoginType === 'phone') {
        els.phoneInput.value = current.account
      } else {
        els.accountInput.value = current.account
        els.passwordInput.value = current.password
      }
      state.token = current.token || ''
      if (state.token) {
        await fetchMemberInfoForAccount(current.account, state.token)
      }
    }
    setStatus('准备完成', '支持密码登录、手机号登录、pit 和验证码获取。')
  } catch (error) {
    setStatus('初始化失败', String(error))
  }
}

boot()
