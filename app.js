import { icon } from './icons.js'
import {
  COLORS, DAYS, uid, key, fromKey, shift, format, weekLabel, taskOf,
  loadState, nextOccurrence, parsePlan, planWithAI
} from './planner.js'

const STORAGE = 'daymark.v1'
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
const $ = id => document.getElementById(id)
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])
const checked = value => value ? ' checked' : ''
const selected = value => value ? ' selected' : ''
const disabled = value => value ? ' disabled' : ''
const attr = (name, value) => ` data-${name}="${escape(value)}"`
const dayFormat = { month: 'long', day: 'numeric' }
const monthFormat = { month: 'long', year: 'numeric' }
const navItems = [
  ['week', 'Week', 'week'], ['calendar', 'Calendar', 'calendar'],
  ['backlog', 'Backlog', 'inbox'], ['projects', 'Projects', 'layers']
]

let today = new Date()
let todayKey = key(today)
let state = loadState(STORAGE, today)
const view = { tab: 'week', week: todayKey, date: todayKey, project: '', expanded: new Map() }
let toastTimeout
let aiKey = ''
let dragId = ''
let sheetTrigger
let storageError = false

function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state))
  } catch (error) {
    console.warn('Could not save Daymark data.', error)
    if (!storageError) toast('Storage is unavailable. Changes will last for this visit.')
    storageError = true
  }
}

function toast(message) {
  $('toast').replaceChildren(Object.assign(document.createElement('span'), { textContent: message }))
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => $('toast').replaceChildren(), 4500)
}

function button(action, label, name, options = {}) {
  const { classes = 'icon-button', data = '', size = 19, onlyIcon = true } = options
  return `<button type="button" class="${classes}" data-action="${action}"${data} aria-label="${escape(label)}"${onlyIcon ? ` title="${escape(label)}"` : ''}>${name ? icon(name, size) : ''}${onlyIcon ? '' : `<span class="button-label">${escape(label)}</span>`}</button>`
}

const findTask = id => state.tasks.find(task => task.id === id)
const findProject = id => state.projects.find(project => project.id === id)
const clock = time => time ? format(new Date(`2000-01-01T${time}`), { hour: 'numeric', minute: '2-digit' }) : ''
const projectOptions = projectId => `<option value="">No project</option>${state.projects.map(project =>
  `<option value="${escape(project.id)}"${selected(project.id === projectId)}>${escape(project.name)}</option>`
).join('')}`
const projectDot = project => `<span class="project-dot" style="--project-color:${COLORS.includes(project.color) ? project.color : COLORS[0]}" aria-hidden="true"></span>`

function getNewTaskContext() {
  if (view.tab === 'backlog') return { date: '', project: '' }
  if (view.tab === 'projects') return { date: '', project: view.project }
  if (view.tab === 'calendar') return { date: view.date, project: '' }
  return { date: view.week, project: '' }
}

function renderHeading() {
  const activeProject = findProject(view.project)
  const date = fromKey(view.date)
  const headings = {
    week: ['Your week', weekLabel(fromKey(view.week))],
    calendar: ['Calendar', format(date, monthFormat)],
    backlog: ['Backlog', 'Tasks without a scheduled day'],
    projects: [activeProject?.name ?? 'Projects', activeProject ? 'Project tasks' : 'Organize tasks by project']
  }
  const [title, description] = headings[view.tab]
  const period = ['week', 'calendar'].includes(view.tab)
  const unit = view.tab === 'week' ? 'week' : 'month'
  $('page-heading').innerHTML = `
    <div class="heading-text">
      ${activeProject && view.tab === 'projects' ? button('projects-root', 'All projects', 'prev', { classes: 'button subtle backlink', onlyIcon: false }) : ''}
      <h1>${escape(title)}</h1><p>${escape(description)}</p>
    </div>
    <div class="heading-actions">
      ${period ? `<div class="period-controls" aria-label="Date controls">
        ${button('period-back', `Previous ${unit}`, 'prev', { size: 16 })}
        <button type="button" class="today-button" data-action="today">Today</button>
        ${button('period-next', `Next ${unit}`, 'next', { size: 16 })}
      </div>` : ''}
      ${view.tab === 'projects' && !activeProject
        ? button('new-project', 'New project', 'plus', { classes: 'button primary new-button', onlyIcon: false })
        : button('new-task', 'New task', 'plus', { classes: 'button primary new-button', onlyIcon: false })}
    </div>`
}

function renderTask(task, index, count) {
  const project = findProject(task.project)
  const details = [
    project ? `<span>${projectDot(project)}${escape(project.name)}</span>` : '',
    task.time ? `<span>${escape(clock(task.time))}</span>` : '',
    task.repeat !== 'never' ? `<span title="${escape(task.repeat)}" aria-label="${escape(task.repeat)}">${icon('repeat', 12)}</span>` : '',
    task.reminder ? `<span title="Reminder" aria-label="Reminder">${icon('bell', 12)}</span>` : '',
    view.tab === 'projects' && task.date ? `<span>${escape(format(fromKey(task.date), dayFormat))}</span>` : ''
  ].filter(Boolean).join('')
  return `<li class="task-row${task.done ? ' done' : ''}" data-task="${escape(task.id)}" data-index="${index}" data-count="${count}" draggable="true">
    <button type="button" class="check-button" aria-label="${escape(task.done ? `Reopen ${task.title}` : `Complete ${task.title}`)}" aria-pressed="${Boolean(task.done)}" data-action="complete"${attr('id', task.id)}>
      <span class="checkbox-face">${icon('check', 13)}</span>
    </button>
    <button type="button" class="task-name" data-action="edit-task"${attr('id', task.id)}>
      <span class="task-label">${escape(task.title)}</span>
      ${details ? `<span class="task-detail">${details}</span>` : ''}
    </button>
    ${button('task-actions', `Actions for ${task.title}`, 'more', { data: attr('id', task.id), size: 17 })}
  </li>`
}

function taskList(tasks) {
  return `<ul class="task-list">${tasks.map((task, index) => renderTask(task, index, tasks.length)).join('')}</ul>`
}

function addButton(date, project = '') {
  return button('new-task', 'Add a new task', 'plus', {
    classes: 'add-task', onlyIcon: false, size: 18, data: attr('date', date) + attr('project', project)
  })
}

function renderDay(dateKey, alwaysOpen = false) {
  const date = fromKey(dateKey)
  const isToday = dateKey === todayKey
  const tasks = state.tasks.filter(task => task.date === dateKey)
  const done = tasks.filter(task => task.done).length
  const expanded = alwaysOpen || (view.expanded.get(dateKey) ?? (isToday || tasks.length > 0))
  const heading = `<span>
    <span class="day-title"><strong>${DAYS[date.getDay()]}</strong>${isToday ? '<span class="today-tag">Today</span>' : ''}</span>
    <span class="day-date">${format(date, dayFormat)}</span>
  </span>`
  const meta = `<span class="day-meta">
    ${tasks.length ? `<small>${done} of ${tasks.length} done</small>` : ''}
    ${alwaysOpen ? '' : icon(expanded ? 'up' : 'down', 16)}
  </span>`
  return `<article class="day${isToday ? ' current' : ''}" aria-label="${DAYS[date.getDay()]}, ${format(date, dayFormat)}">
    ${alwaysOpen ? `<div class="day-header">${heading}${meta}</div>` :
      `<button type="button" class="day-header" data-action="toggle-day"${attr('date', dateKey)} aria-expanded="${expanded}" aria-controls="day-${dateKey}">${heading}${meta}</button>`}
    <div class="day-body" id="day-${dateKey}"${expanded ? '' : ' hidden'}>
      ${taskList(tasks)}
      ${addButton(dateKey)}
    </div>
  </article>`
}

function renderCalendar() {
  const date = fromKey(view.date)
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
  const start = shift(first, -first.getDay())
  const dates = Array.from({ length: Math.ceil((first.getDay() + last.getDate()) / 7) * 7 }, (_, index) => shift(start, index))
  return `<div class="panel">
    <div class="calendar-grid" aria-label="${format(date, monthFormat)}">
      ${DAYS.map(day => `<span title="${day}">${day.slice(0, 2)}</span>`).join('')}
      ${dates.map(day => {
        const dayKey = key(day)
        return `<button type="button" aria-label="${format(day, { dateStyle: 'full' })}" aria-pressed="${dayKey === view.date}" class="${day.getMonth() === date.getMonth() ? '' : 'outside'} ${dayKey === todayKey ? 'is-today' : ''}" data-action="calendar-day"${attr('date', dayKey)}>
          ${day.getDate()}<i class="calendar-mark${state.tasks.some(task => task.date === dayKey && !task.done) ? '' : ' empty'}" aria-hidden="true"></i>
        </button>`
      }).join('')}
    </div>
    ${renderDay(view.date, true)}
  </div>`
}

function renderProjects() {
  const project = findProject(view.project)
  if (project) return `<div class="panel">
    ${taskList(state.tasks.filter(task => task.project === project.id))}
    ${addButton('', project.id)}
    ${button('edit-project', 'Edit project', 'settings', { classes: 'button subtle', data: attr('id', project.id), onlyIcon: false })}
  </div>`
  if (!state.projects.length) return '<div class="panel"><p>Create a project to group related tasks.</p></div>'
  return `<div class="project-list">${state.projects.map(item => {
    const count = state.tasks.filter(task => task.project === item.id && !task.done).length
    return `<div class="project-card">
      ${projectDot(item)}
      <button type="button" class="task-name" data-action="open-project"${attr('id', item.id)}>${escape(item.name)}
        <span class="project-count">${count} open ${count === 1 ? 'task' : 'tasks'}</span>
      </button>
      ${button('edit-project', `Edit ${item.name}`, 'more', { data: attr('id', item.id) })}
    </div>`
  }).join('')}</div>`
}

function renderContent() {
  let markup
  switch (view.tab) {
    case 'calendar':
      markup = renderCalendar()
      break
    case 'backlog': {
      const tasks = state.tasks.filter(task => !task.date)
      markup = `<div class="panel">${tasks.length ? taskList(tasks) : '<p>Your backlog is empty.</p>'}${addButton('')}</div>`
      break
    }
    case 'projects':
      markup = renderProjects()
      break
    default:
      markup = Array.from({ length: 7 }, (_, index) => renderDay(key(shift(fromKey(view.week), index)))).join('')
  }
  $('content').innerHTML = markup
}

function renderFocus() {
  const open = state.tasks.filter(task => !task.done)
  const session = state.session
  const target = open.find(task => task.id === (session?.taskId ?? state.selection))
  const timedTask = session && session.taskId ? findTask(session.taskId) : null
  $('focus-card').innerHTML = `
    <div class="focus-head">
      <h2 class="focus-title">${icon('timer', 18)}<span>Focus timer</span></h2>
      ${button('settings', 'Focus settings', 'settings', { size: 17 })}
    </div>
    <span class="timer-readout" role="timer" id="timer"></span>
    <div class="timer-track" aria-hidden="true"><span id="timer-progress"></span></div>
    <div class="focus-picker">
      <select id="focus-task" aria-label="Task to focus on"${disabled(session)}>
        <option value="">Focus without a task</option>
        ${open.map(task => `<option value="${escape(task.id)}"${selected(target?.id === task.id)}>${escape(task.title)}</option>`).join('')}
      </select>${icon('down', 15)}
    </div>
    <div class="focus-buttons">
      ${session
        ? button('stop-focus', 'Stop Focus', 'stop', { classes: 'button primary', onlyIcon: false, size: 15 })
        : button('start-focus', 'Start Focus', 'play', { classes: 'button primary', onlyIcon: false, size: 15 })}
      ${timedTask && !timedTask.done ? button('focus-complete', 'Complete Task', 'check', { classes: 'button secondary', onlyIcon: false, size: 16, data: attr('id', timedTask.id) }) : ''}
    </div>
    ${state.notice ? `<div class="focus-note" role="status">
      ${escape(state.notice)} ${state.settings.auto && isIOS ? '<button type="button" data-action="retry-stop">Run Stop Shortcut</button>' : ''}
      <button type="button" data-action="dismiss-notice">Dismiss</button>
    </div>` : ''}`
  updateClock()
}

function renderTools() {
  const tools = [
    ['plan', 'sparkle', 'Plan tasks with AI', 'Turn a note into a task list'],
    ['lock-settings', 'lock', 'Task Lock', state.locked ? 'Requested for today’s tasks' :
      state.settings.lock ? 'Waiting for tasks to be due' : 'Limit distractions with Shortcuts'],
    ['help', 'help', 'Shortcuts setup', 'Connect your iPhone Focus mode']
  ]
  $('tools').innerHTML = tools.map(([action, name, title, description]) => `<button type="button" class="tool-row" data-action="${action}">
    <span class="tool-icon ${name}">${icon(name, 19)}</span>
    <span><span class="tool-name">${title}</span><span class="tool-description">${description}</span></span>
    <span class="tool-arrow">${icon('next', 17)}</span>
  </button>`).join('')
}

function renderNav() {
  $('nav').innerHTML = navItems.map(([id, label, name]) => `<button type="button" class="nav-button" data-action="tab"${attr('tab', id)}${view.tab === id ? ' aria-current="page"' : ''}>
    <span class="nav-icon">${icon(name, 20)}</span><span>${label}</span>
  </button>`).join('')
}

function render() {
  const active = document.activeElement
  const focusKey = active?.matches('[data-action]') ? { ...active.dataset } : null
  renderHeading()
  renderContent()
  renderFocus()
  renderTools()
  renderNav()
  if (focusKey && !active.isConnected) {
    const restored = [...document.querySelectorAll('[data-action]')].find(element =>
      Object.entries(focusKey).every(([name, value]) => element.dataset[name] === value)
    )
    restored?.focus({ preventScroll: true })
  }
}

function updateClock() {
  const session = state.session
  const total = session?.duration ?? state.settings.duration * 60000
  const remaining = session ? Math.max(0, session.endsAt - Date.now()) : state.notice ? 0 : total
  const seconds = Math.ceil(remaining / 1000)
  const value = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  if ($('timer') && $('timer').textContent !== value) $('timer').textContent = value
  if ($('timer-progress')) $('timer-progress').style.width = `${remaining / total * 100}%`
}

function openSheet(title, content) {
  const sheet = $('sheet')
  if (!sheet.open) sheetTrigger = document.activeElement
  $('sheet-content').innerHTML = `
    <header class="sheet-head"><h2 id="sheet-title">${escape(title)}</h2>
      ${button('close', 'Close', 'close', { size: 20 })}
    </header>${content}`
  if (!sheet.open) sheet.showModal()
  sheet.scrollTop = 0
}

function closeSheet() {
  if ($('sheet').open) $('sheet').close()
}

function field(label, name, value, options = {}) {
  const { type = 'text', extra = '' } = options
  return `<label class="field">${escape(label)}<input type="${type}" name="${name}" value="${escape(value)}" ${extra}></label>`
}

function toggle(label, name, value) {
  return `<label class="toggle-row">${escape(label)}<input class="toggle" type="checkbox" name="${name}" role="switch"${checked(value)}></label>`
}

function submit(label, name, id = '') {
  return `<form class="sheet-body" data-form="${name}"${attr('id', id)}>${label}</form>`
}

function formFooter(label, extra = '') {
  return `<div class="sheet-actions">${extra}${button('close', 'Cancel', '', { classes: 'button secondary', onlyIcon: false })}
    <button type="submit" class="button primary">${label}</button></div>`
}

function taskEditor(task, context = getNewTaskContext()) {
  const item = task ?? taskOf(context)
  openSheet(task ? 'Edit task' : 'New task', submit(`
    ${field('Task', 'title', item.title, { extra: 'placeholder="What needs doing?" required maxlength="180" autofocus' })}
    <div class="form-group">
      <div class="field-row">
        ${field('Day', 'date', item.date, { type: 'date' })}
        ${field('Time', 'time', item.time, { type: 'time' })}
      </div>
      <small>Leave the day blank to send this task to your backlog.</small>
    </div>
    <div class="form-group">
      <label class="field">Repeat
        <select name="repeat" aria-label="Repeat">${['Never', 'Daily', 'Weekly'].map(option =>
          `<option value="${option.toLowerCase()}"${selected(item.repeat === option.toLowerCase())}>${option}</option>`
        ).join('')}</select>
      </label>
      ${toggle('Remind me at the scheduled time', 'reminder', item.reminder)}
      <small>Reminders appear while Daymark is open.</small>
    </div>
    <label class="field">Project <select name="project" aria-label="Project">${projectOptions(item.project)}</select></label>
    <p class="form-error" data-error role="alert" hidden></p>
    ${formFooter(task ? 'Save task' : 'Add task')}
  `, 'task', task?.id))
}

function taskActions(task, index, count) {
  const actionData = attr('id', task.id)
  const actionButton = (action, label, name, properties = '') => button(action, label, name, {
    classes: `button secondary ${properties}`, onlyIcon: false, data: actionData
  })
  openSheet(task.title, `<div class="sheet-body action-stack">
    ${task.done ? '' : actionButton('select-focus', 'Use for focus timer', 'timer')}
    ${actionButton('edit-task', 'Edit task', 'settings')}
    ${index > 0 ? actionButton('move-up', 'Move up', 'up') : ''}
    ${index < count - 1 ? actionButton('move-down', 'Move down', 'down') : ''}
    ${actionButton('delete-task', 'Delete task', 'close', 'danger')}
  </div>`)
}

function projectEditor(project) {
  openSheet(project ? 'Edit project' : 'New project', submit(`
    ${field('Project name', 'name', project?.name, { extra: 'placeholder="Name your project" required maxlength="60" autofocus' })}
    <label class="field">Color <select name="color" aria-label="Color">${['Terracotta', 'Sage', 'Lavender', 'Ochre', 'Slate', 'Rose'].map((name, index) =>
      `<option value="${COLORS[index]}"${selected(project?.color === COLORS[index])}>${name}</option>`
    ).join('')}</select></label>
    <p class="form-error" data-error role="alert" hidden></p>
    ${formFooter(project ? 'Save project' : 'Create project', project
      ? button('delete-project', 'Delete project', '', { classes: 'button subtle danger', onlyIcon: false, data: attr('id', project.id) })
      : '')}
  `, 'project', project?.id))
}

function settingsSheet() {
  const settings = state.settings
  openSheet('Settings', submit(`
    <div class="form-group">
      <h3>Focus timer</h3>
      ${field('Default duration in minutes', 'duration', settings.duration, { type: 'number', extra: 'min="1" max="180" step="1" required inputmode="numeric"' })}
    </div>
    <div class="form-group">
      <h3>Apple Shortcuts</h3>
      ${toggle('Auto-trigger Apple Shortcuts', 'auto', settings.auto)}
      ${field('Start shortcut name', 'start', settings.start, { extra: 'maxlength="100" required' })}
      ${field('Stop shortcut name', 'stop', settings.stop, { extra: 'maxlength="100" required' })}
      ${button('help', 'Shortcuts setup', 'help', { classes: 'button secondary', onlyIcon: false })}
    </div>
    ${state.tasks.some(task => task.example) ? button('clear-examples', 'Remove example tasks', '', { classes: 'button secondary', onlyIcon: false }) : ''}
    ${formFooter('Save settings')}
  `, 'settings'))
}

function lockSheet() {
  const settings = state.settings
  openSheet('Task Lock', submit(`
    <p>Ask Shortcuts to turn on your iPhone Focus mode until today’s open tasks are done.</p>
    <div class="form-group">
      ${toggle('Lock apps until today’s tasks are done', 'lock', settings.lock)}
      ${toggle('Only count tasks due by now', 'dueOnly', settings.dueOnly)}
      ${field('Start locking at a set time', 'lockFrom', settings.lockFrom, { type: 'time' })}
      <small>Leave this blank to start at any time. Daymark checks task changes and due times while it’s open.</small>
    </div>
    ${settings.auto ? '' : '<p>Turn on Auto-trigger Apple Shortcuts in Settings to enable Task Lock.</p>'}
    ${state.locked ? button('retry-lock', 'Run lock shortcut', 'lock', { classes: 'button secondary', onlyIcon: false }) : ''}
    ${button('help', 'Set up app redirection', 'help', { classes: 'button secondary', onlyIcon: false })}
    ${formFooter('Save Task Lock')}
  `, 'lock'))
}

function guide() {
  const url = new URL('./', location.href).href
  return [
    `In iPhone Settings → Focus, create a custom Focus called Daymark.`,
    `In Shortcuts, create “${state.settings.start}” with the Set Focus action. Choose Daymark on, until turned off.`,
    `Create “${state.settings.stop}” with Set Focus to turn Daymark off. If you use Task Lock, add an If action so Set Focus runs only when Shortcut Input is not equal to keep-lock. In the Shortcut Input settings, choose Continue when there’s no input.`,
    `In Shortcuts → Automation, add an App automation for the apps you want to limit. Choose Is Opened and Run Immediately.`,
    `Add Get Current Focus and an If action. When the Focus name is Daymark, use Open URLs with your published Daymark address.`,
    url,
    `In Safari, use Share → Add to Home Screen. If iOS prevents the Stop shortcut from opening at timer expiry, return to Daymark and tap Run Stop Shortcut.`
  ]
}

function helpSheet() {
  openSheet('Shortcuts setup', `<div class="sheet-body">
    <p>Set this up once. Daymark will ask iOS to start or stop your Focus mode from the timer.</p>
    <ol>${guide().filter((_, index) => index !== 5).map(step => `<li>${escape(step)}</li>`).join('')}</ol>
    <small>iOS may open the published URL in Safari. Home Screen and Safari storage can be separate.</small>
    ${button('copy-guide', 'Copy setup guide', 'copy', { classes: 'button primary', onlyIcon: false })}
    <p id="copy-status" role="status"></p>
    <textarea id="manual-guide" hidden readonly aria-label="Setup guide"></textarea>
  </div>`)
}

function plannerSheet() {
  openSheet('Plan tasks with AI', submit(`
    <label class="field">What do you want to get done?
      <textarea name="note" rows="5" required maxlength="4000" autofocus placeholder="Send the proposal tomorrow at 10 am, book a haircut on Saturday, and buy groceries"></textarea>
    </label>
    <p>Daymark adds dated tasks to your schedule and undated tasks to the backlog.</p>
    <details>
      <summary>Planning mode</summary>
      <div class="form-group">
        <p>Offline planning reads task lists, dates, and times in English. Connect OpenAI to interpret more detailed instructions.</p>
        ${field('OpenAI API key (optional)', 'aiKey', aiKey, { type: 'password', extra: 'autocomplete="off" spellcheck="false" maxlength="300"' })}
        <small>With a key, Daymark sends this note and your project names to OpenAI. The key stays in this tab’s memory.</small>
      </div>
    </details>
    <p class="form-error" data-error role="alert" hidden></p>
    ${formFooter('Create tasks')}
  `, 'plan'))
}

function shortcut(action) {
  if (!state.settings.auto || !isIOS) return
  const name = state.settings[action]
  const keepLock = action === 'stop' && state.locked
  const input = keepLock ? '&input=text&text=keep-lock' : ''
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}${input}`
}

function updateLock() {
  const { auto, lock, lockFrom, dueOnly } = state.settings
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const active = Boolean(auto && lock && (!lockFrom || time >= lockFrom) && state.tasks.some(task =>
    !task.done && task.date === todayKey && (!dueOnly || !task.time || task.time <= time)
  ))
  if (active === state.locked) return null
  state.locked = active
  return !state.session && auto ? (active ? 'start' : 'stop') : null
}

function commit({ action, message } = {}) {
  const lockAction = updateLock()
  persist()
  render()
  if (message) toast(message)
  if (action || lockAction) shortcut(action || lockAction)
}

function setTab(tab) {
  view.tab = tab
  view.project = ''
  render()
  window.scrollTo(0, 0)
}

function startFocus() {
  if (state.session) return
  const task = findTask(state.selection)
  const duration = state.settings.duration * 60000
  state.session = { taskId: task && !task.done ? task.id : '', duration, endsAt: Date.now() + duration }
  state.notice = ''
  commit({ action: 'start' })
}

function stopFocus(expired = false) {
  if (!state.session) return
  state.session = null
  state.notice = expired ? 'Focus session finished.' : ''
  commit({ action: 'stop' })
}

function complete(task) {
  if (!task) return
  task.done = !task.done
  const stop = task.done && state.session?.taskId === task.id
  if (stop) state.session = null
  if (task.done && state.selection === task.id) state.selection = ''
  if (task.done && task.repeat !== 'never' && task.date && !state.tasks.some(item => item.source === task.id)) {
    state.tasks.push(nextOccurrence(task, today))
  } else if (!task.done) {
    state.tasks = state.tasks.filter(item => item.source !== task.id || item.done || item.edited)
  }
  commit({ action: stop ? 'stop' : undefined, message: task.done ? 'Task completed' : 'Task reopened' })
}

function peers(task) {
  if (view.tab === 'projects' && view.project) return state.tasks.filter(item => item.project === task.project)
  return state.tasks.filter(item => item.date === task.date)
}

function reorder(sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return
  const source = findTask(sourceId)
  const target = findTask(targetId)
  if (!source || !target || !peers(source).includes(target)) return
  const from = state.tasks.indexOf(source)
  const destination = state.tasks.indexOf(target)
  state.tasks.splice(from, 1)
  state.tasks.splice(destination, 0, source)
  persist()
  renderContent()
}

function move(task, offset) {
  const group = peers(task)
  const target = group[group.indexOf(task) + offset]
  if (!target) return
  closeSheet()
  reorder(task.id, target.id)
  document.querySelector(`[data-action="task-actions"][data-id="${CSS.escape(task.id)}"]`)?.focus()
  toast('Task moved')
}

function confirmDelete(task, type) {
  openSheet(`Delete ${type}?`, `<div class="sheet-body">
    <p>${type === 'project'
      ? `Tasks in <strong>${escape(task.name)}</strong> will stay in Daymark without a project.`
      : `<strong>${escape(task.title)}</strong> will be removed from your list.`}</p>
    <div class="sheet-actions">
      ${button('close', 'Cancel', '', { classes: 'button secondary', onlyIcon: false })}
      ${button(`confirm-delete-${type}`, `Delete ${type}`, '', { classes: 'button primary', onlyIcon: false, data: attr('id', task.id) })}
    </div>
  </div>`)
}

function removeTask(task) {
  const stop = state.session?.taskId === task.id
  if (stop) state.session = null
  if (state.selection === task.id) state.selection = ''
  state.tasks = state.tasks.filter(item => item.id !== task.id)
  closeSheet()
  commit({ action: stop ? 'stop' : undefined, message: 'Task deleted' })
}

function removeProject(project) {
  state.projects = state.projects.filter(item => item.id !== project.id)
  state.tasks.forEach(task => {
    if (task.project === project.id) task.project = ''
  })
  view.project = ''
  closeSheet()
  commit({ message: 'Project deleted' })
}

function formError(form, error) {
  const element = form.querySelector('[data-error]')
  element.textContent = error
  element.hidden = false
}

function saveTask(form, values) {
  const title = values.get('title').trim()
  const date = values.get('date') || ''
  const time = values.get('time') || ''
  const repeat = values.get('repeat')
  const reminder = values.has('reminder')
  const project = values.get('project')
  if (!title) return formError(form, 'Enter a task name.')
  if (!date && (time || repeat !== 'never' || reminder)) return formError(form, 'Choose a day for a time, repeat, or reminder.')
  if (reminder && !time) return formError(form, 'Choose a time for the reminder.')
  const existing = findTask(form.dataset.id)
  const changes = { title, date, time, repeat, reminder, project, edited: Boolean(existing), example: false }
  if (existing) {
    if (date !== existing.date || time !== existing.time || reminder !== existing.reminder) existing.reminded = false
    Object.assign(existing, changes)
  } else {
    state.tasks.push(taskOf(changes))
  }
  if (date) {
    view.expanded.set(date, true)
    if (view.tab === 'calendar') view.date = date
    if (view.tab === 'backlog') view.tab = 'week'
    if (view.tab === 'week' && (date < view.week || date > key(shift(fromKey(view.week), 6)))) view.week = date
  }
  closeSheet()
  const message = !date && ['week', 'calendar'].includes(view.tab) ? 'Task saved in Backlog' : existing ? 'Task saved' : 'Task added'
  commit({ message })
}

function saveProject(form, values) {
  const name = values.get('name').trim()
  const color = values.get('color')
  const existing = findProject(form.dataset.id)
  if (!name) return formError(form, 'Enter a project name.')
  const duplicate = state.projects.some(project => project !== existing && project.name.toLowerCase() === name.toLowerCase())
  if (duplicate) return formError(form, 'A project with this name already exists.')
  const project = existing ?? { id: uid() }
  Object.assign(project, { name, color })
  if (!existing) state.projects.push(project)
  view.tab = 'projects'
  view.project = project.id
  closeSheet()
  commit({ message: existing ? 'Project saved' : 'Project created' })
}

async function savePlan(form, values) {
  const note = values.get('note').trim()
  if (!note) return formError(form, 'Describe at least one task.')
  const create = form.querySelector('[type=submit]')
  if (create.disabled) return
  aiKey = values.get('aiKey').trim()
  create.disabled = true
  create.textContent = 'Creating tasks…'
  form.querySelector('[data-error]').hidden = true
  try {
    const tasks = aiKey ? await planWithAI(note, today, state.projects, aiKey) : parsePlan(note, today, state.projects)
    if (!form.isConnected || !$('sheet').open) return
    if (!tasks.length) return formError(form, 'No tasks found. Try describing a specific action.')
    state.tasks.push(...tasks)
    const dated = tasks.filter(task => task.date).map(task => task.date).sort()
    for (const date of dated) view.expanded.set(date, true)
    if (dated.length) {
      view.tab = 'week'
      view.week = dated[0] < todayKey || dated[0] > key(shift(today, 6)) ? dated[0] : todayKey
    } else {
      view.tab = 'backlog'
    }
    view.project = ''
    closeSheet()
    const backlog = tasks.length - dated.length
    const detail = backlog && dated.length ? ` · ${backlog} in Backlog` : ''
    commit({ message: `Added ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}${detail}` })
    window.scrollTo(0, 0)
  } catch (error) {
    if (form.isConnected) {
      const message = error.name === 'TimeoutError' || error instanceof TypeError
        ? 'Could not reach OpenAI. Check your connection or clear the key to plan offline.'
        : error.message
      formError(form, message)
    }
  } finally {
    create.disabled = false
    create.textContent = 'Create tasks'
  }
}

async function copyGuide() {
  const steps = guide().filter((_, index) => index !== 5)
  const value = steps.map((step, index) => `${index + 1}. ${step}`).join('\n\n')
    + `\n\nDaymark URL\n${guide()[5]}`
  const status = $('copy-status')
  try {
    await navigator.clipboard.writeText(value)
    status.textContent = 'Setup guide copied.'
  } catch {
    const manual = $('manual-guide')
    if (!manual) return
    manual.value = value
    manual.hidden = false
    manual.focus()
    manual.select()
    try {
      if (document.execCommand('copy')) {
        manual.hidden = true
        $('sheet').querySelector('[data-action="copy-guide"]').focus()
        status.textContent = 'Setup guide copied.'
        return
      }
    } catch {
      // Leave the text selected for a manual copy.
    }
    status.textContent = 'The guide is selected. Use your device’s Copy command.'
  }
}

function goPeriod(direction) {
  if (view.tab === 'week') {
    view.week = key(shift(fromKey(view.week), 7 * direction))
  } else {
    const current = fromKey(view.date)
    view.date = key(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12))
  }
  render()
}

function revealFocus() {
  const card = $('focus-card')
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  card.focus({ preventScroll: true })
  card.scrollIntoView({ behavior, block: 'nearest' })
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]')
  if (!target) return
  const { action, id, date, project, tab } = target.dataset
  const task = findTask(id)
  switch (action) {
    case 'home':
      view.week = todayKey
      setTab('week')
      break
    case 'tab':
      setTab(tab)
      break
    case 'period-back':
    case 'period-next':
      goPeriod(action === 'period-next' ? 1 : -1)
      break
    case 'today':
      view.week = view.date = todayKey
      view.expanded.delete(todayKey)
      render()
      break
    case 'calendar-day':
      view.date = date
      render()
      break
    case 'toggle-day':
      view.expanded.set(date, target.getAttribute('aria-expanded') !== 'true')
      render()
      break
    case 'new-task':
      taskEditor(null, date !== undefined ? { date, project } : getNewTaskContext())
      break
    case 'edit-task':
      if (task) taskEditor(task)
      break
    case 'task-actions': {
      const row = target.closest('[data-task]')
      if (task) taskActions(task, Number(row.dataset.index), Number(row.dataset.count))
      break
    }
    case 'complete':
    case 'focus-complete':
      complete(task)
      break
    case 'select-focus':
      if (!state.session && task && !task.done) {
        state.selection = id
        persist()
        renderFocus()
      }
      closeSheet()
      revealFocus()
      break
    case 'move-up':
    case 'move-down':
      if (task) move(task, action === 'move-up' ? -1 : 1)
      break
    case 'delete-task':
      if (task) confirmDelete(task, 'task')
      break
    case 'confirm-delete-task':
      if (task) removeTask(task)
      break
    case 'new-project':
      projectEditor()
      break
    case 'edit-project':
      if (findProject(id)) projectEditor(findProject(id))
      break
    case 'open-project':
      view.project = id
      render()
      break
    case 'projects-root':
      setTab('projects')
      break
    case 'delete-project':
      if (findProject(id)) confirmDelete(findProject(id), 'project')
      break
    case 'confirm-delete-project':
      if (findProject(id)) removeProject(findProject(id))
      break
    case 'focus-card':
      revealFocus()
      break
    case 'start-focus':
      startFocus()
      break
    case 'stop-focus':
      stopFocus()
      break
    case 'retry-stop':
      if (!state.session) shortcut('stop')
      break
    case 'retry-lock':
      if (state.locked) shortcut('start')
      break
    case 'dismiss-notice':
      state.notice = ''
      persist()
      renderFocus()
      break
    case 'settings':
      settingsSheet()
      break
    case 'clear-examples':
      openSheet('Remove example tasks?', `<div class="sheet-body">
        <p>Daymark will remove the starter tasks that you haven’t edited.</p>
        <div class="sheet-actions">
          ${button('settings', 'Cancel', '', { classes: 'button secondary', onlyIcon: false })}
          ${button('confirm-clear-examples', 'Remove examples', '', { classes: 'button primary', onlyIcon: false })}
        </div>
      </div>`)
      break
    case 'confirm-clear-examples': {
      const stop = findTask(state.session?.taskId)?.example
      if (stop) state.session = null
      if (findTask(state.selection)?.example) state.selection = ''
      state.tasks = state.tasks.filter(item => !item.example)
      closeSheet()
      commit({ action: stop ? 'stop' : undefined, message: 'Example tasks removed' })
      break
    }
    case 'lock-settings':
      lockSheet()
      break
    case 'help':
      helpSheet()
      break
    case 'copy-guide':
      copyGuide()
      break
    case 'plan':
      plannerSheet()
      break
    case 'close':
      closeSheet()
      break
  }
})

document.addEventListener('submit', event => {
  const form = event.target
  if (!form.dataset.form) return
  event.preventDefault()
  const values = new FormData(form)
  switch (form.dataset.form) {
    case 'task':
      saveTask(form, values)
      break
    case 'project':
      saveProject(form, values)
      break
    case 'settings':
      Object.assign(state.settings, {
        duration: Number(values.get('duration')),
        auto: values.has('auto'),
        start: values.get('start').trim() || 'Start Focus',
        stop: values.get('stop').trim() || 'Stop Focus'
      })
      closeSheet()
      commit({ message: 'Settings saved' })
      break
    case 'lock':
      Object.assign(state.settings, {
        lock: values.has('lock'), dueOnly: values.has('dueOnly'), lockFrom: values.get('lockFrom')
      })
      closeSheet()
      commit({ message: 'Task Lock saved' })
      break
    case 'plan':
      savePlan(form, values)
      break
  }
})

$('focus-card').addEventListener('change', event => {
  if (event.target.id !== 'focus-task' || state.session) return
  state.selection = event.target.value
  persist()
})

$('sheet').addEventListener('click', event => {
  if (event.target !== $('sheet')) return
  const rect = $('sheet').getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) closeSheet()
})

$('sheet').addEventListener('close', () => {
  if (sheetTrigger?.isConnected && document.activeElement === document.body) sheetTrigger.focus()
  sheetTrigger = null
})

const content = $('content')
content.addEventListener('dragstart', event => {
  const row = event.target.closest('[data-task]')
  if (!row) return
  dragId = row.dataset.task
  row.classList.add('dragging')
  event.dataTransfer.setData('text/plain', dragId)
  event.dataTransfer.effectAllowed = 'move'
})
content.addEventListener('dragover', event => {
  const row = event.target.closest('[data-task]')
  const source = findTask(dragId)
  if (!row || !source || row.dataset.task === dragId || !peers(source).some(task => task.id === row.dataset.task)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  content.querySelector('.drop-target')?.classList.remove('drop-target')
  row.classList.add('drop-target')
})
content.addEventListener('dragleave', event => {
  const row = event.target.closest('.drop-target')
  if (row && !row.contains(event.relatedTarget)) row.classList.remove('drop-target')
})
content.addEventListener('drop', event => {
  const row = event.target.closest('[data-task]')
  if (!row || !dragId) return
  event.preventDefault()
  reorder(dragId, row.dataset.task)
})
content.addEventListener('dragend', () => {
  dragId = ''
  content.querySelectorAll('.dragging, .drop-target').forEach(row => row.classList.remove('dragging', 'drop-target'))
})

function tick() {
  if (document.visibilityState === 'hidden') return
  const now = new Date()
  const newKey = key(now)
  if (newKey !== todayKey) {
    if (view.week === todayKey) view.week = newKey
    if (view.date === todayKey) view.date = newKey
    today = now
    todayKey = newKey
    render()
  }
  if (state.session && state.session.endsAt <= now.getTime()) {
    stopFocus(true)
  } else {
    const wasLocked = state.locked
    const action = updateLock()
    if (wasLocked !== state.locked) {
      persist()
      renderTools()
      if (action) shortcut(action)
    }
    updateClock()
  }
  const due = state.tasks.filter(task => !task.done && !task.reminded && task.reminder && task.date === todayKey &&
    task.time && now >= new Date(`${todayKey}T${task.time}`))
  if (due.length) {
    due.forEach(task => { task.reminded = true })
    persist()
    toast(due.length === 1 ? `Task reminder · ${due[0].title}` : `${due.length} tasks are due`)
  }
}

window.addEventListener('storage', event => {
  if (event.key === STORAGE && event.newValue) {
    state = loadState(STORAGE, today)
    render()
  }
})
document.addEventListener('visibilitychange', tick)
window.addEventListener('pageshow', tick)

document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon) })
persist()
render()
tick()
setInterval(tick, 500)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline cache unavailable.', error))
}
