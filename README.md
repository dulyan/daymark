# Daymark

Daymark is a mobile-first weekly planner with a focus timer, calendar, backlog, projects, and Apple Shortcuts integration. It runs as a static site without a build step.

## Run and install

1. From this directory, run `python3 -m http.server 4173` and open `http://localhost:4173/` for local development.
2. Publish the directory to any HTTPS static host. On Vercel, use the Other preset and leave the build command blank. On Netlify, publish this directory without a build command. On GitHub Pages, publish from the branch and directory containing `index.html`. Relative URLs support GitHub Pages project paths.
3. On iPhone, open the HTTPS site in Safari, then choose **Share → Add to Home Screen**. If offered, keep **Open as Web App** enabled.

The service worker caches the core app and local fonts after the first online visit. Tasks, projects, preferences, and focus sessions are stored on the device in `localStorage`. Settings includes **Remove example tasks** for the starter list. Increment the service worker cache version in `sw.js` when publishing changes to the cached files.

## Apple Shortcuts and Task Lock

Open **Shortcuts setup** in Daymark for the copyable guide. Create an iOS Focus called **Daymark**, a **Start Focus** shortcut that turns it on, and a **Stop Focus** shortcut that turns it off. To redirect distracting apps, create a Shortcuts App automation that runs immediately when a chosen app opens. In the automation, check the current Focus and open the Daymark URL only when the Daymark Focus is active.

Start, Stop, and Complete Task launch the respective shortcut directly from the tap when **Auto-trigger Apple Shortcuts** is on. The names and default timer duration are editable in Settings. If a timer expires while the app is suspended, Daymark detects expiry on return. iOS can decline a launch initiated without a tap. **Run Stop Shortcut** appears after expiry so the user can retry.

Task Lock evaluates due tasks while Daymark is open. When it should remain active after a focus timer ends, Daymark sends `keep-lock` as input to the Stop shortcut. Configure Stop Focus to skip the Set Focus action when Shortcut Input equals `keep-lock` and continue when no input is present. The automation operates as a redirect controlled by iOS. The redirected URL may open Safari, which can have separate storage from the installed Home Screen app.

## Task planning

**Plan tasks with AI** creates tasks from a note and assigns parsed dates to the schedule. Unscheduled tasks go to Backlog. Offline planning supports English lists and common date and time phrases. For example, try “Send the proposal tomorrow at 10 am, book a haircut on Saturday, and buy groceries.” To assign an existing project offline, end the task with `#Project Name`.

For more flexible interpretation, open **Planning mode** in the drawer and provide an OpenAI API key for the session. This calls the OpenAI API directly with the note, the current date, and project names and IDs. The key is kept in memory until the tab closes or reloads and can be cleared in the drawer. OpenAI account access and any usage charges apply to that mode.

Use a task’s action menu to move it up or down, or drag rows on a desktop. Repeating tasks generate their next occurrence after completion. Reminders display while Daymark is open.
