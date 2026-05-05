# Implement Unlock Story via Ads

This document outlines the plan to build the "unlock story by watching ads" feature, including database schema updates, backend API modifications, and frontend changes for both the admin dashboard and user reading experience.

## User Review Required

> [!IMPORTANT]  
> **Location of the Setting**: The prompt mentions adding this to the "tạo, sửa truyện" (create/edit story) section, but also mentions "chương nào được quy định" (which chapter is configured). Currently, access permissions (`accessType`: free, vip, timed) are configured per **Chapter**, not per Story. 
> **My proposed approach**: I will add the `Mở khóa bằng quảng cáo` (Unlock via Ads) option to the **Chapter Form's access dropdown**. This ensures you can configure exactly which chapters require ads. Please confirm if this is acceptable.

> [!IMPORTANT]
> **Ad Reappearance Logic**: The prompt specifies that after a set time (e.g., 15 mins), the ad reappears.
> **My proposed approach**: We will track the last time an ad was shown in the user's browser `localStorage`. When they open an ad-locked chapter (or are currently reading one and the time expires, or upon navigation), the system will check the timestamp. If the reappearance time has elapsed, the ad modal will be displayed again.

## Proposed Changes

### Database Changes
#### [MODIFY] schema.prisma
- **Advertisement Model**: Add `routeType Int @default(1) @map("route_type")` (1 = inline, 2 = unlock).
- **ChapterAccessType Enum**: Add a new value `ads` to represent chapters locked by ads.
- **Chapter Model**: Add `unlockAdId String? @map("unlock_ad_id") @db.VarChar(36)` and a relation to the `Advertisement` model so each ad-locked chapter can reference a specific ad.
- **SiteSetting Model** (Existing): We will use this to store the two global settings:
  - `unlock_ad_reappearance_minutes` (Default: 15)
  - `unlock_ad_countdown_seconds` (Default: 5)

---

### Backend API
#### [MODIFY] Advertisement Module
- Update CRUD endpoints to handle the `routeType` field.
- Update `GET /advertisements` to accept an optional `routeType` filter query parameter.

#### [MODIFY] Site Settings Module
- Ensure there are endpoints to get and update the global settings `unlock_ad_reappearance_minutes` and `unlock_ad_countdown_seconds`.

#### [MODIFY] Chapter Module
- Update chapter creation and update endpoints to accept `accessType: 'ads'` and `unlockAdId`.
- Ensure public chapter retrieval endpoints (`GET /chapters/:id`, `GET /stories/:slug/chapters`) populate and return the associated `unlockAd` data and the global ad settings if the chapter is ad-locked.

---

### Frontend Admin
#### [MODIFY] Admin Sidebar
- Rename the existing "Quản lý quảng cáo" route to "Quảng cáo inline".
- Add a new route "Quảng cáo mở khóa" under the same section.

#### [NEW] Admin Unlock Ads Page & [MODIFY] Admin Inline Ads Page
- Modify the ads list component to filter by `routeType`.
- On the "Quảng cáo mở khóa" page, add a header section with two inputs to configure the global settings (Reappearance time and Countdown time) and save them via the settings API.
- Share the ad creation/edit form but ensure it automatically passes the correct `routeType` (1 or 2) when submitting.

#### [MODIFY] Chapter Form Component
- Add "Mở khóa bằng xem quảng cáo" to the `accessType` dropdown.
- When selected, display an additional dropdown to choose an ad from the "Unlock Ads" list (`routeType === 2`).
- Filter the available ads based on the language of the current chapter/story.

---

### Frontend User
#### [MODIFY] Story Detail Page
- In the chapter list, check if a chapter's `accessType === 'ads'`.
- Display a golden lock icon with the text "Quảng cáo/Ads" next to these chapters.

#### [MODIFY] Reading Page
- Implement the Ad Modal overlay with a blurred background (`backdrop-blur`).
- Upon loading the chapter, verify if it requires an ad. If yes, check `localStorage` to see if `Date.now() - lastAdShownTime > reappearanceTimeInMs`.
- If the ad needs to be shown, block the reading content with the modal.
- The modal will display the ad's `imageUrl`, `title`, and a large "Xem quảng cáo" button that opens the `targetUrl`.
- Implement a countdown timer at the top right of the modal using the configured `unlock_ad_countdown_seconds`.
- Once the countdown reaches 0, display an `[x]` close button.
- Clicking the close button hides the modal, updates the `localStorage` timestamp, and reveals the chapter content.

## Verification Plan

### Automated Tests
- Run database migrations successfully.
- Verify API endpoints return the correct filtered ads and chapter ad details.

### Manual Verification
1. **Admin**: Check sidebar naming, create/edit "Unlock Ads", verify settings inputs save correctly.
2. **Admin**: Edit a chapter, select "Unlock via Ads", verify the ad dropdown filters correctly by language, and save.
3. **User Story Page**: Verify the golden lock icon and "Quảng cáo/Ads" text appear on the configured chapter.
4. **User Reading Page**: Open the chapter, verify the modal pops up immediately, background is blurred. Verify the countdown works, the close button appears, and clicking it dismisses the modal and updates local storage. Verify refreshing before the reappearance time does not show the ad, and waiting past the reappearance time triggers it again.
