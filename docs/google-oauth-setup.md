# Google OAuth 設定（取代 Replit Auth）

這個系統從 Replit 遷移出來後，登入改用你自己的 Google OAuth 用戶端，不再
依賴 Replit 平台代管的憑證。跟 pf-cwh/tasktracker 一樣共用 `cwh2023.asuscomm.com`
這個網域，但這次要**建立一個新的 OAuth 用戶端**，不要跟 pf-cwh 或 tasktracker
共用同一個（各自獨立，降低互相牽連的風險），可以沿用同一個 Google Cloud
專案（例如既有的 "Hermes" 專案）。

## 1. 使用既有的 Google Cloud 專案

不用另外建新專案，沿用既有的即可（例如你之前 pf-cwh 用的那個）。不需要
額外啟用任何 API（登入用的 OpenID Connect 是內建的）。

## 2. 設定 OAuth 同意畫面

如果這個專案已經設定過同意畫面（例如做 pf-cwh 時設定過），這步可以跳過，
直接檢查測試使用者清單有沒有包含你自己的帳號即可。如果是全新專案：

1. **API 和服務** → **OAuth 同意畫面**。
2. User Type 選 **外部**。
3. 填基本資訊（應用程式名稱、支援電子郵件等，隨意填，僅內部使用）。
4. **範圍（Scopes）** 加入：`openid`、`.../auth/userinfo.email`、
   `.../auth/userinfo.profile`。
5. **測試使用者（Test users）** 加入：
   - `chenweihanfool@gmail.com`

   這個 App 目前設計只有你自己使用（見 `ADMIN_GOOGLE_EMAIL`），之後如果要
   加其他人登入，記得同時把對方 email 加進這裡的測試使用者清單，以及系統
   自己的白名單（設定 → 管理員頁面 → 新增白名單）——兩邊都要加，缺一不可：
   應用程式停留在「測試中」狀態時，沒在這個清單裡的 Google 帳號會被 Google
   直接擋下，連你自己白名單機制都還沒機會生效。

## 3. 建立 OAuth 用戶端

1. **API 和服務** → **憑證** → **建立憑證** → **OAuth 用戶端 ID**。
2. 應用程式類型選 **網頁應用程式**。
3. **已授權的重新導向 URI** 加入：
   ```
   https://cwh2023.asuscomm.com/fitness/api/auth/callback
   ```
4. 建立後會拿到 **Client ID** 和 **Client Secret**，填進 `.env`：
   ```
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxx
   ADMIN_GOOGLE_EMAIL=chenweihanfool@gmail.com
   ```

## 4. 已知限制：「測試中」狀態的 refresh token 7 天過期

跟 pf-cwh 一樣，OAuth 用戶端只要還在「測試中」（Testing）發布狀態，
refresh token 一律 7 天後失效，大概每 7 天要重新登入一次，不影響資料。

## 5. 驗證設定是否正確

1. `.env` 填好 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`ADMIN_GOOGLE_EMAIL` 後部署。
2. 用 `ADMIN_GOOGLE_EMAIL` 那組帳號打開 `https://cwh2023.asuscomm.com/fitness`，
   點「以 Google 帳號登入」，應該會跳轉到 Google 同意畫面，同意後應該會導回
   系統並顯示為管理員，能看到原本 Replit 時代累積的健身紀錄。
