# Koko Box UI Prototype

This workspace contains a uni-app Vue prototype that is now standardized for WeChat Mini Program development only.

## Run locally

1. Install dependencies: `npm install`
2. Start the WeChat Mini Program dev build: `npm run dev`
3. Create a production build for the WeChat Mini Program: `npm run build`

## WeChat cloud backend

Backend features use WeChat CloudBase cloud functions so sensitive logic and keys stay server-side.

### 1. Create the cloud environment

1. Open this project in WeChat DevTools.
2. Open Cloud Development.
3. Create an environment such as `koko-dev`.
4. Copy the real environment ID from the Cloud Development console.
5. Paste it into `src/config/cloud.ts`:

```ts
export const WECHAT_CLOUD_ENV_ID = 'your-real-env-id'
```

If the environment ID is empty, the app intentionally falls back to a mock session so local Mini Program debugging can continue.

### 2. Create database collections

Create these CloudBase database collections:

- `users`
- `pets`
- `user_settings`
- `pet_dialogue_histories`
- `course_schedules`
- `user_tasks`

Recommended permission for the first version: users can only read and write their own records. Keep identity-sensitive creation and updates in cloud functions so `_openid` cannot be forged by the client.

### 3. Deploy the login cloud function

1. In WeChat DevTools, find `cloudfunctions/login`.
2. Install dependencies for the cloud function.
3. Upload and deploy the cloud function.
4. Open the mini program profile tab and click `微信自动登录`, or simply enter the page after the cloud env is configured.

The `login` cloud function uses `cloud.getWXContext()` to get `OPENID`, creates the user/pet/settings records on first login, and updates `lastLoginAt` on later logins.

### 4. Deploy the AI cloud function

The chat and pet quick-reply flow now calls cloud function `pet-dialogue` instead of directly requesting DashScope from the client.

1. In WeChat DevTools, find `cloudfunctions/pet-dialogue`.
2. Install dependencies for this function.
3. In Cloud Development console, open function `pet-dialogue` settings and configure environment variables:

- `QWEN_API_KEY`: your real DashScope key
- `QWEN_MODEL` (optional): defaults to `qwen-plus`

1. Upload and deploy function `pet-dialogue`.
2. Test from mini program chat page and pet interaction entry.

If `pet_dialogue_histories` has not been created yet, the updated function can still reply in stateless mode, but chat history persistence will not work until that collection exists.

### 5. Deploy the course schedule sync cloud function

The imported timetable can now sync across devices for the same WeChat account.

1. In WeChat DevTools, find `cloudfunctions/schedule-sync`.
2. Install dependencies for this function.
3. Upload and deploy function `schedule-sync`.
4. Ensure the `course_schedules` collection already exists before testing timetable import on multiple devices.

### 6. Deploy the task and DDL sync cloud function

Tasks and DDL items sync through cloud function `task-sync`. Without deploying this function, each device will keep using its local cache and task lists will not match.

1. In WeChat DevTools, find `cloudfunctions/task-sync`.
2. Install dependencies for this function.
3. Upload and deploy function `task-sync`.
4. Ensure the `user_tasks` collection already exists before testing tasks on multiple devices.

Important security note: if a key was ever committed in client code before, rotate that key in DashScope immediately and only keep the new key in cloud function env variables.

## WeChat DevTools

1. Open the project root in WeChat DevTools.
2. Ensure `app.json`, `pages.json`, and `manifest.json` are present in the root.
3. The Mini Program output directory is fixed at `unpackage/dist/mp-weixin/`.
4. If the output directory does not exist yet, run `npm run dev` once before opening the project in WeChat DevTools.

## Current scope

- WeChat cloud login scaffold
- WeChat cloud AI dialogue function (`pet-dialogue`)
- Cloud database collections for users, pets, and settings
- Mock cross-device status sync
- Pet attribute dashboard
- Growth and care overview
- Gentle reminder cards
- Hardware display preview
- Lightweight AI chat placeholder

## Notes

- Most feature pages are still static UI while login is being connected.
- `unpackage/` is a local build artifact directory and should not be committed.
- CloudBase free quota and billing can change, so confirm the current rules in the WeChat Cloud Development console before release.
