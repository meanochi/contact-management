[⬅ חזרה למסמך האפיקים הראשי (סקירה, מלאי דרישות, מפת כיסוי, רשימת כל האפיקים)](epics.md)

# Epic 1: ניהול גופים נתמכים ואנשי קשר (ליבת המערכת)

**גישה פתוחה, ללא הרשאות (לפי החלטת המוצר):** כל מי שנכנס לאפליקציה — בלי login, בלי הבחנה בין רכז למנהל-על — יכול לראות ולערוך את כל הגופים הנתמכים ואנשי הקשר, ליצור, לערוך, להשבית, לחפש ולסנן, כולל שימור היסטוריה מלאה ותיעוד בקשות עדכון/הסרה חיצוניות. שיוך **לתחום** נעשה **ברמת הגוף הנתמך בלבד** (גוף נתמך יכול להשתייך ליותר מתחום אחד), מתוך רשימת תחומים **קיימת** ב-DB בלבד (ללא מסך ניהול תחומים/הקצאת רכזים — נדחה ל-Epic 3, ר' אזהרת NFR-E/NFR-B ב-`epics.md`). **לאיש קשר אין שדה תחום ישיר** — הוא משויך לגוף/י נתמך, ומגיע לתחום/ים שלו רק דרכם.

_[DRAFT — טרם אושר סופית]_

**מקרא לחלוקת הטסקים בכל סטורי:**
- **UI** — קומפוננטות/מסכים/Drawer/Modal, טפסים, RTK Query hooks (`apps/web` — שכבת הצריכה מהלקוח)
- **תשתיות** — הקמת מונורפו, כלי בנייה, Docker, GitLab CI, קונפיגורציה משותפת (לא ספציפי לפיצ'ר)
- **שרת: פקודות ו-API** — `apps/api` (NestJS): controllers, services, Joi schemas + Pipes, תרגום שגיאות
- **DB** — מודלים ב-Prisma, מיגרציות, seed data (`packages/db`, נצרך רק מ-`apps/api`)

---

## Story 1.1: תשתית הפרויקט, מעטפת אפליקציה, ו-Audit Trail אוטומטי (ללא הרשאות)

בתור מי שנכנס למערכת (ללא login),
אני רוצה לראות מעטפת אפליקציה ריקה בעברית ו-RTL, כשכל פעולה עתידית מתועדת אוטומטית (פעולה/זמן/מה השתנה),
כדי שיהיה בסיס טכני יציב לכל המסכים הבאים, גם בלי מנגנון הרשאות בשלב הזה.

**Acceptance Criteria:**

**בהינתן** המונורפו (`apps/web`, `apps/api`, `packages/db`, `packages/shared-schemas`, `packages/ui`, `packages/config`) מוקם לפי ה-Structural Seed הארכיטקטוני (AD-1 — קליינט ושרת כשתי אפליקציות נפרדות)
**כאשר** מריצים `npm install` ו-`turbo run build` מהשורש
**אז** כל ה-packages ושתי האפליקציות נבנים בהצלחה, ו-`tsc --noEmit` עובר בכל package/אפליקציה

**בהינתן** PostgreSQL רץ מקומית דרך Docker, ו-`schema.prisma` (ריק מבחינה עסקית בשלב זה) קיים ב-`packages/db`
**כאשר** מריצים `prisma migrate dev`
**אז** המיגרציה רצה בהצלחה מול מסד הנתונים המקומי

**בהינתן** שתי האפליקציות רצות מקומית (`apps/web` על פורט אחד, `apps/api` על פורט אחר, CORS מאושר ביניהן — AD-12)
**כאשר** כל אחד ניגש לכתובת `apps/web` — בלי login, בלי מסך הזדהות
**אז** הוא רואה ישירות מעטפת אפליקציה (Sidebar + אזור תוכן), בעברית מלאה ו-RTL (`dir="rtl"`, פונט Heebo, `DirectionProvider`), עם טוקני העיצוב הבסיסיים (UX-DR1, UX-DR4, UX-DR8, UX-DR9) מוטמעים ב-`packages/ui`

**בהינתן** מודל `AuditLog` קיים ב-`packages/db`, וה-Prisma Client Extension לתיעוד מיושם על ה-client היחיד שמיוצא מ-`packages/db` ונצרך רק מ-`apps/api` (`expertise-postgres-prisma`)
**כאשר** כל מוטציה עתידית (create/update/delete) תתבצע על מודל עסקי כלשהו (מ-Story 1.2 ואילך)
**אז** תיווצר אוטומטית רשומת Audit עם חותמת זמן ומה השתנה — בלי קוד ייעודי בכל endpoint

**⚠️ הבהרה (נגזר מהחלטת "בלי הרשאות"):** בלי login אין "משתמש מחובר" — שדה `changedById` ב-`AuditLog` יישאר ריק (null) בכל רשומות האפיק הזה. NFR-B (Audit Trail) נענה חלקית: **מה השתנה ומתי** כן מתועד; **מי ביצע** לא, עד שיהיה מנגנון זיהוי כלשהו (Epic 3, כולל החלטה מחדש על שיטת האימות — AD-9). זהו המשך ישיר לפער שכבר סימנו לגבי NFR-E — שני הפערים ייסגרו יחד כשההרשאות ייבנו.

**Tasks / Subtasks:**

**תשתיות:**
- [x] הקמת מונורפו Turborepo + npm workspaces — `package.json` שורש עם `workspaces`, `turbo.json`, `packages/config` (tsconfig/eslint משותפים)
- [x] `docker-compose.yml` להרצת PostgreSQL מקומי
- [x] `.gitlab-ci.yml` — פייפליין בסיסי: build+lint+test לכל אחת משתי האפליקציות בנפרד (**לא אומת בפועל מול GitLab אמיתי** — הריפו עובד על GitHub כרגע, ר' החלטה בשיחה)
- [x] הגדרת `tsc --noEmit` כסקריפט בכל package/אפליקציה
- [x] אימות קצה-לקצה: `npm install && turbo run build` עובר בהצלחה (אומת בפועל — גם `lint`/`typecheck`/`test`)

**DB:**
- [x] `packages/db`: `prisma.config.ts`, `schema.prisma` ריק (עסקית), `PrismaPg` adapter (pg), `prisma migrate dev` ראשון (אומת מול Postgres אמיתי ב-Docker)
- [x] מודל `AuditLog` + מיגרציה ב-`packages/db`

**שרת: פקודות ו-API:**
- [x] שלד `apps/api` (NestJS): `main.ts` (`NestFactory.create(AppModule)`, `app.enableCors(...)` מוגבל למקור של `apps/web` — AD-12), `app.module.ts` ריק בשלב זה (אומת גם ב-runtime — השרת עלה בפועל, CORS מוחזר נכון)
- [x] `common/interceptors/response.interceptor.ts` + `common/filters/all-exceptions.filter.ts` — מעטפת תגובה אחידה (`{data}`/`{error}`), נרשמים גלובלית ב-`main.ts` (`expertise-api-rest`)
- [x] Prisma Client Extension לתיעוד (`packages/db/src/client.ts`, `audit-context.ts`) לפי `expertise-postgres-prisma`; `changedById` תמיד `null` באפיק זה; נצרך רק מתוך `apps/api`

**UI:**
- [x] `packages/ui`: theme override של Mantine לפי טוקני `DESIGN.md` (צבעים, Heebo, radii) + `DirectionProvider`
- [x] `apps/web`: שלד Next.js App Router; `app/layout.tsx` עם `dir="rtl"`, `lang="he"`, `mantineHtmlProps`, `MantineProvider`+`DirectionProvider`
- [x] `apps/web/lib/api-client.ts` — שלד ראשוני של שכבת החיבור ל-`apps/api` (`expertise-react-nextjs`)
- [x] `AppShell` ריק (Sidebar + אזור תוכן) — בלי שער אימות, מוצג ישירות

---

## Story 1.2: יצירת רשומת גוף נתמך עם שיוך לתחום/ים קיימים

בתור מי שנכנס למערכת,
אני רוצה ליצור רשומת גוף נתמך חדשה עם שם, ח"פ, שיוך לתחום אחד או יותר מתוך רשימה קיימת, וסטטוס,
כדי שאוכל להתחיל לשייך אליה אנשי קשר תחת התחומים הנכונים, גם בלי מסך ניהול תחומים.

**Acceptance Criteria:**

**בהינתן** מודל `Domain` (id, name, isActive) קיים ב-`packages/db` (סכמה בלבד — ללא מסך ניהול, כפי שהוגדר)
**כאשר** מריצים seed חד-פעמי עם תחומים לדוגמה (למשל "חינוך", "בריאות")
**אז** הרשומות קיימות במסד הנתונים וזמינות לקריאה

**בהינתן** משתמש בטופס "גוף נתמך חדש"
**כאשר** הוא ממלא שם, מספר ח"פ, בוחר תחום אחד או יותר מתוך שדה `MultiSelect` הנשלף מ-`GET /domains?isActive=true` ב-`apps/api` (ממוין לפי שם), ולוחץ "שמירה"
**אז** נוצרת רשומת `SupportedBody` חדשה עם `status: ACTIVE`, משויכת לכל התחומים שנבחרו (יחס many-to-many), ומוצגת ברשימת הגופים הנתמכים

**בהינתן** אין תחומים פעילים במסד הנתונים (מקרה קצה)
**כאשר** המשתמש פותח את טופס יצירת גוף נתמך
**אז** שדה "תחום/ים" מציג רשימה ריקה ללא שגיאה — אך לא ניתן לשמור גוף נתמך בלי לבחור תחום אחד לפחות (FR-4), כך שהמשתמש מבין שיש להזין תחומים ב-DB תחילה, ולא נתקל בשגיאה גנרית

**בהינתן** משתמש מזין מספר ח"פ שכבר קיים במערכת עבור גוף אחר
**כאשר** הוא מנסה לשמור
**אז** מוצגת שגיאת ולידציה מיידית — "גוף נתמך עם ח\"פ זה כבר קיים במערכת" + קישור לרשומה הקיימת (UX-DR18) — והשמירה נחסמת גם ברמת ה-DB (`@unique`) אם הבדיקה בצד הלקוח פוספסה

**בהינתן** שדות חובה (שם, ח"פ, תחום אחד לפחות) ריקים
**כאשר** המשתמש מנסה לשמור
**אז** כפתור השמירה מושבת / מוצגת שגיאת ולידציה בזמן אמת, לפני קריאה לשרת

**וגם** הוולידציה רצה גם בצד השרת (Joi, עצמאית מהלקוח) לפני כתיבה למסד הנתונים

**Tasks / Subtasks:**

**DB:**
- [x] מודל `Domain` (id, name, isActive, timestamps) + מיגרציה ב-`packages/db`
- [x] סקריפט seed חד-פעמי לתחומים לדוגמה (`packages/db/prisma/seed.ts`), עם נתוני seed ("חינוך", "בריאות") — אומת מול Postgres אמיתי
- [x] מודל `SupportedBody` (id, companyId ייחודי, name, isActive, timestamps) + מודל join מפורש `SupportedBodyOnDomain` (many-to-many מול `Domain`) + מיגרציה

**שרת: פקודות ו-API:**
- [x] `apps/api/src/domains/` — `domains.module.ts` + `domains.controller.ts` (`GET /domains`, ממוין לפי שם) + `domains.service.ts`
- [x] `packages/shared-schemas/domains/types.ts` — DTO לקריאה בלבד
- [x] `packages/shared-schemas/supported-bodies/{types.ts,schema.ts}` — `createSupportedBodySchema` (`domainIds` כמערך, לפחות איבר אחד)
- [x] `apps/api/src/supported-bodies/` — `supported-bodies.module.ts` + `supported-bodies.controller.ts` (`POST /supported-bodies` עם `JoiValidationPipe(createSupportedBodySchema)`) + `supported-bodies.service.ts` — יוצר `SupportedBody` + שורות `SupportedBodyOnDomain` יחד (`$transaction`)
- [x] תרגום שגיאת `P2002` (הפרת ייחודיות ח"פ) ל-`ConflictException` (`409`) עם פרטי הרשומה הקיימת בתגובה — אומת בפועל (יצירה תקינה, ח"פ כפול, ולידציה חסרה — כל אחד נבדק מול שרת רץ)
- [x] `common/pipes/joi-validation.pipe.ts` — נוצר כאן (לא היה עדיין בסטורי 1.1, כי זה הסטורי הראשון עם גוף בקשה לאמת)

**⚠️ חריגה זמנית, לפי החלטת מוצר (לא שלי) — Audit Trail מכובה:** בזמן הרצת הסטורי התגלה באג אמיתי ומתועד ב-Prisma 7.10.0 (`Prisma.getExtensionContext(this)` לא עובד בתבנית `$allModels.$allOperations` — ראו github.com/prisma/prisma/discussions/24178) ששבר **כל** כתיבה לכל מודל. הוחלט לכבות את ה-Audit Extension זמנית (הקוד שלם ב-`packages/db/src/client.ts`, רק לא פעיל, עם הסבר מלא להפעלה מחדש) ולא לרדת בגרסת Prisma. המשמעות: אף כתיבה באפיק זה (כולל מכאן ואילך) לא מתועדת ב-`AuditLog` עד שיוחלט איך לתקן.

**UI:**
- [x] קומפוננטת `DomainMultiSelect` משותפת ב-`packages/ui` — **פרשנות:** נבנתה כקומפוננטה פרזנטיישנית בלבד (מקבלת `domains`/`value`/`onChange` כ-props), לא טוענת בעצמה — כי `packages/ui` אסור לה להיות תלויה ב-RTK Query hooks של `apps/web` (AD-11). הטעינה בפועל (`useListActiveDomainsQuery`) קורית ב-`apps/web` ומועברת פנימה. לשימוש חוזר ב-Story 1.3.
- [x] `apps/web/components/supported-bodies/SupportedBodyForm.tsx` — RHF + `joiResolver`, כולל `DomainMultiSelect` (מחובר דרך `Controller`)
- [x] `useCreateSupportedBodyMutation` (RTK Query, `baseQuery` מול `apps/api`) ב-`apps/web/lib/api/supportedBodiesApi.ts` — כולל גם תשתית `lib/store.ts`+`StoreProvider` שלא היו עדיין (נדרשו כדי שה-hook הזה יעבוד בכלל)
- [x] חיבור טופס "גוף נתמך חדש" ל-Drawer (`NewSupportedBodyDrawer.tsx`, נפתח משמאל — UX-DR7) בתוך `app/(internal)/supported-bodies/page.tsx`
- [x] כפתור "שמירה" מושבת עד ששדות החובה תקינים (`mode: "onChange"` ב-RHF) — UX-DR12
- [x] טיפול במקרה קצה: רשימת תחומים ריקה — `MultiSelect` מציג placeholder מתאים בלי שגיאה

**⚠️ מגבלת אימות:** בדקתי build/typecheck/lint/test (ירוק) ו-SSR של הדף בפועל (`curl` מול שרת רץ — הטקסט העברי מופיע נכון). **לא בדקתי ויזואלית בדפדפן אמיתי** (אין כלי browser automation בסביבה) — לא אומת שהלחיצה על הכפתור פותחת את ה-Drawer, שהטופס אכן נשלח מהדפדפן, או ש-CORS עובד end-to-end מול דפדפן אמיתי. כדאי שתבדקי את זה ידנית לפני שסוגרים את הסטורי.

---

## Story 1.3: עריכה והשבתה של רשומת גוף נתמך

**⚠️ סדר בנייה בפועל: סטורי זו נבנתה אחרי Story 1.4, לא לפניה.** ה-AC כאן מניח רשימה שאפשר ללחוץ על שורותיה — ברגע שנכתבה הסטורי הזו (לפי סדר ה-FR במסמך הדרישות, FR-4 לפני FR-5) עוד לא היה שום מסך רשימה. הוחלט להחליף את סדר הבנייה בפועל כדי שלכל סטורי שמסתיימת יהיה דבר אמיתי ושלם להדגים. המספור/ה-ID נשארו כפי שהם (תואמים את ה-FR Coverage Map), רק סדר הביצוע בפועל שונה.

בתור מי שנכנס למערכת,
אני רוצה לערוך פרטי גוף נתמך קיים (כולל שיוך התחומים שלו) או להשבית אותו,
כדי שהמידע יישאר מעודכן גם כשגוף מפסיק להיות פעיל.

**Acceptance Criteria:**

**בהינתן** רשימת גופים נתמכים
**כאשר** המשתמש לוחץ בכל מקום בשורת הגוף
**אז** נפתח Drawer עריכה מהצד — לא תפריט "..." נסתר (UX-DR11)

**בהינתן** רשומת גוף נתמך קיימת פתוחה לעריכה
**כאשר** משתמש עורך שם/ח"פ/שיוך תחומים (הוספה/הסרה דרך `DomainMultiSelect`) ולוחץ "שמירה"
**אז** הרשומה מתעדכנת (כולל סנכרון שורות `SupportedBodyOnDomain`), וה-Audit Trail מתעד את מה שהשתנה

**בהינתן** רשומת גוף נתמך פעילה עם אנשי קשר משויכים
**כאשר** משתמש לוחץ "השבת" ומאשר
**אז** הרשומה מסומנת `status: INACTIVE` — **לא נמחקת**, ואנשי הקשר המשויכים אליה נשארים ללא שינוי (FR-4 תוצאה נבדקת). **הערה:** `SupportedBody` אין לו `status` enum כמו ל-`Contact` — ההשבתה בפועל מסמנת `isActive: false` (אותו שדה בוליאני שכבר קיים מ-Story 1.2/1.4), לא `status`. גם אין עדיין קשר `Contact`↔`SupportedBody` במודל (Contact לא נבנה עדיין ב-Epic זה) — "אנשי הקשר נשארים ללא שינוי" יאומת בפועל כש-Story 1.5 ואילך נבנות.

**בהינתן** משתמש מנסה לשנות ח"פ לערך ששייך כבר לגוף אחר
**כאשר** הוא שומר
**אז** אותה שגיאת ייחודיות כמו ב-Story 1.2

**Tasks / Subtasks:**

**שרת: פקודות ו-API:**
- [x] `apps/api/src/supported-bodies/supported-bodies.controller.ts` — מתווסף `PATCH /supported-bodies/:id` עם `JoiValidationPipe(updateSupportedBodySchema)` (כולל `domainIds` מעודכן). שגיאת ייחודיות (409) ו-404 (`NOT_FOUND`) כש-id לא קיים — אומתו שתיהן
- [x] `supported-bodies.service.ts` — `update()` אחת (לא שתי פונקציות נפרדות) — עריכה והשבתה שתיהן עוברות דרך אותו `PATCH`, בדומה לכלל Contact DELETE-via-PATCH שב-`expertise-api-rest`. מסנכרנת את שורות `SupportedBodyOnDomain` ע"י **replace מלא** (מחיקה + יצירה מחדש בטרנזקציה אחת), לא דיף הוספה/הסרה — פישוט סביר כש-join table קטן. השבתה משתמשת ב-`isActive: false` (לא `status`, ר' הערה ב-AC למעלה), לא מחיקה

**UI:**
- [x] `apps/web/components/supported-bodies/SupportedBodyEditDrawer.tsx` — לחיצה על כל מקום בשורה (ב-`SupportedBodiesList.tsx`) פותחת Drawer (UX-DR11), כולל `DomainMultiSelect` מ-Story 1.2 טעון עם התחומים הנוכחיים (מאופס מחדש בכל פתיחת רשומה אחרת — אותו Drawer משמש לכל השורות)
- [x] כפתור "השבת" + Modal אישור, מחובר לאותו `PATCH` endpoint
- [x] **תוספת לאחר בדיקה:** ה-AC המקורי לא כיסה הפעלה מחדש — כשגוף לא פעיל, הכפתור מתחלף ל"הפעל מחדש" (ללא Modal אישור — פעולה הפיכה ולא הרסנית, לא כמו השבתה), קורא לאותו `PATCH` עם `{isActive:true}`
- [x] `useUpdateSupportedBodyMutation` + invalidation תגית `SupportedBody` כך שרשימת הגופים (Story 1.4) מתעדכנת אחרי שמירה/השבתה

**⚠️ אימות:** `build`/`typecheck`/`lint`/`test` — 18/18 ירוק. אומת end-to-end מול שרת API רץ בפועל (לא רק unit-level): עריכת שם (כולל טקסט בעברית דרך קובץ, לא CLI inline — ר' הערת Story 1.4 על קידוד Git Bash), סנכרון `domainIds` משני תחומים לתחום אחד, שגיאת 409 כש-ח"פ מתעדכן לערך שכבר קיים ברשומה אחרת, שגיאת 404 על id לא קיים, השבתה (`isActive:false`) ואז סינון `isActive=true/false` מאשר את השינוי, והרשומה ממשיכה להופיע ב-GET (לא נמחקת). רשומות הבדיקה שנוצרו נוקו/הוחזרו למצבן המקורי בסיום. **מגבלה זהה לסטוריז קודמות:** אין כלי browser automation — לחיצה בפועל על שורה ופתיחת ה-Drawer לא אומתו ויזואלית בדפדפן, רק ברמת קוד/API/SSR.

---

## Story 1.4: חיפוש וסינון גופים נתמכים

**⚠️ סדר בנייה בפועל: סטורי זו נבנית *לפני* Story 1.3.** ר' ההערה ב-Story 1.3 — Story 1.4 בונה את הרשימה עצמה קודם, כדי ש-Story 1.3 (עריכה) יהיה לה דבר אמיתי על המסך להתחבר אליו.

בתור מי שנכנס למערכת,
אני רוצה לחפש ולסנן גופים נתמכים לפי שם, תחום, סטטוס ומספר ח"פ,
כדי שאמצא במהירות את הגוף שאני מחפש מתוך רשימה גדלה.

**Acceptance Criteria:**

**בהינתן** רשימת גופים נתמכים עם יותר מרשומה אחת
**כאשר** המשתמש מקליד בשדה החיפוש
**אז** הרשימה מסתננת לפי שם/ח"פ תואם, בחיפוש-תוך-הקלדה (debounced ~300ms), בלי כפתור "חפש" נפרד (UX-DR22)

**בהינתן** המשתמש בוחר פילטר תחום ו/או סטטוס
**כאשר** הפילטר מופעל
**אז** הרשימה מציגה רק גופים נתמכים המשויכים לתחום שנבחר (דרך `SupportedBodyOnDomain`) ו/או בסטטוס שנבחר, עם Pagination — לא גלילה אינסופית (UX-DR24)

**בהינתן** הרשימה בטעינה ראשונית
**כאשר** העמוד נטען
**אז** מוצג `Skeleton` בצורת שורות טבלה, לא spinner גנרי (UX-DR15)

**בהינתן** אין תוצאות תואמות לסינון
**כאשר** הרשימה ריקה
**אז** מוצג Empty State — אייקון + משפט הקשרי + פעולה ראשית אחת (UX-DR6)

**Tasks / Subtasks:**

**שרת: פקודות ו-API:**
- [x] `apps/api/src/supported-bodies/supported-bodies.controller.ts` — מתווסף `GET /supported-bodies?search=&domainId=&isActive=&page=&pageSize=` + `JoiValidationPipe` על ה-query; `domainId` מסנן דרך `domains: { some: { domainId } }`. **הערה:** "status" ב-AC המקורי הפך בפועל ל-`isActive` (בוליאני) — זה השדה האמיתי ב-`SupportedBody`, אין לו status enum כמו ל-`Contact`. גם `companyId` כפילטר נפרד הוצא — `search` כבר מכסה חיפוש גם לפי ח"פ, לא כפלנו פרמטר
- [x] שאילתת רשימה ב-`supported-bodies.service.ts` — `select` ממוקד, פילטרים + pagination, אומת מול שרת רץ (ללא פילטר / עם `search` / עם `isActive=false`)

**UI:**
- [x] `SupportedBodiesList.tsx` — **פרשנות:** נבנה כ-Client Component טהור (לא Server Component + hydration כמו שה-pattern הקנוני ב-`expertise-react-nextjs` מציע) — פישוט מכוון: ה-AC דורש רק `Skeleton` בזמן טעינה, לא נתונים כבר ב-SSR הראשון, ו-fetch מהלקוח בלבד עונה על זה ישירות. שדה חיפוש debounced ~300ms (`useDebouncedValue` מ-`@mantine/hooks`) — UX-DR22
- [x] קומפוננטת Pagination (לא גלילה אינסופית — UX-DR24)
- [x] מצב `Skeleton` לטעינה ראשונית (UX-DR15) ו-`EmptyState` חדש ב-`packages/ui` (אייקון+משפט+פעולה, UX-DR6) — משותף לשימוש חוזר במסכי רשימה עתידיים
- [x] `useListSupportedBodiesQuery` (RTK Query, מול `apps/api`) לסינון בצד הלקוח
- [x] **תוספת שלא תוכננה מראש:** `SupportedBodiesScreen.tsx` — קומפוננטה שמחזיקה את מצב "פתיחת Drawer היצירה" ברמה אחת מעל גם לכפתור הראשי וגם לפעולת ה-Empty State ("צרי את הראשון") כדי ששתיהן יפתחו את אותו Drawer

**⚠️ מגבלת אימות:** בדקתי build/typecheck/lint/test (ירוק) ו-SSR בפועל מול שרת רץ (הכותרת, הכפתור ושדה החיפוש מופיעים נכון). **לא בדקתי ויזואלית בדפדפן** — אין כלי browser automation זמין; לא אומת החיפוש-תוך-הקלדה, הדפדוף (pagination), או מעברי המסך בפועל מול עין אנושית.

### 🐛 תיקון לאחר השלמה: חסר סינון תחום/סטטוס ב-UI

**הבעיה:** ה-AC דורש במפורש "הרשימה מציגה רק גופים נתמכים המשויכים לתחום שנבחר... ו/או בסטטוס שנבחר". השרת (`domainId`/`isActive` ב-`GET /supported-bodies`) נבנה ונבדק נכון מההתחלה — אבל **ב-UI מעולם לא נוספו בקרות סינון** עבור תחום/סטטוס, רק שדה חיפוש. זו סטייה אמיתית מה-AC שלא תפסתי בזמנו, לא רק פער קטן — פספוס שלי.

**התיקון:** נוספו שני `Select` ל-`SupportedBodiesList.tsx` — "תחום" (מתוך `useListActiveDomainsQuery`) ו-"סטטוס" (פעיל/לא פעיל), לצד שדה החיפוש הקיים. ה-EmptyState מבדיל עכשיו בין "אין תוצאות תואמות" (כשיש סינון פעיל) ל"אין עדיין גופים נתמכים" (רשימה ריקה לגמרי) — אותו pattern שכבר נבנה ב-`ContactsList` (Story 1.8). אומת: build/typecheck/lint ירוק, SSR מאשר שהבקרות מופיעות, וסינון `domainId`/`isActive` בשרת כבר אומת קודם (לא השתנה).

---

## Story 1.5: יצירת רשומת איש קשר

**⚠️ החלטות שהתקבלו לפני הבנייה (סתירות שנמצאו בין ה-AC, ה-PRD, וה-skill):**
1. **שם**: ה-AC סתר את עצמו (שורה 222 — "שם פרטי, שם משפחה" מול שורה 233 — "שם מלא"), וה-PRD (FR-6) כתב רק "שם" כללי. הוכרע: **שני שדות נפרדים** — `firstName`/`lastName` (לא `fullName`) — עודכן גם ב-skill (`expertise-postgres-prisma`).
2. **תעודת זהות**: לא הופיע בכלל ב-PRD/בסכמה המתועדת. הוכרע: **מתווסף** כשדה חדש (`idNumber`, אופציונלי, טקסט חופשי ללא בדיקת תקינות) — עודכן גם ב-skill.
3. **נקודת כניסה ליצירת איש קשר**: בזמן הבנייה לא היה עדיין לא "מסך גוף נתמך ספציפי" ולא "מסך אנשי קשר כללי" (שני התרחישים שה-AC מניח). הוכרע (לאחר דיון): לבנות **דף `/contacts` מלא בדומה לדף הגופים הנתמכים** (רשימה + יצירה), עם ניווט בין הדפים ב-`AppShell` — ראו הערת scope בתחתית הסטורי.

בתור מי שנכנס למערכת,
אני רוצה ליצור רשומת איש קשר חדשה ולשייך אותה לגוף נתמך קיים,
כדי שיהיה לי מקום מרכזי לפרטי איש הקשר הנכון, תחת התחומים שהגוף כבר משויך אליהם.

**Acceptance Criteria:**

**בהינתן** משתמש פותח טופס "איש קשר חדש" מתוך מסך גוף נתמך (משויך אוטומטית) או ממסך אנשי הקשר הכללי
**כאשר** הוא ממלא שם פרטי, שם משפחה, תעודת זהות, תפקיד, טלפון, לפחות כתובת דוא"ל אחת, בוחר **גוף נתמך** מרשימה קיימת (חובה), מסמן העדפות ערוץ (דוא"ל/SMS, בוליאניים עצמאיים), ומוסיף הערות (אופציונלי)
**אז** נוצרת רשומת `Contact` חדשה עם `status: ACTIVE`, משויכת לגוף הנתמך שנבחר (FR-6, FR-7); איש הקשר **אינו** בוחר תחום בעצמו — הוא מגיע לתחום/ים דרך התחום/ים של הגוף הנתמך

**בהינתן** המשתמש מזין כתובת דוא"ל בפורמט לא תקין
**כאשר** הוא עוזב את השדה / מנסה לשמור
**אז** מוצגת שגיאת ולידציה מיידית ("כתובת הדוא\"ל אינה בפורמט תקין") וכפתור השמירה מושבת עד לתיקון (UX-DR12); הבדיקה חוזרת גם בצד השרת

**בהינתן** המשתמש רוצה להוסיף יותר מכתובת דוא"ל אחת
**כאשר** הוא לוחץ "הוסף כתובת נוספת"
**אז** מתווסף שדה דוא"ל נוסף, וכל הכתובות נשמרות תחת אותה רשומת איש קשר (FR-10)

**בהינתן** שדות חובה (שם מלא, לפחות דוא"ל אחד, גוף נתמך) לא מולאו
**כאשר** המשתמש מנסה לשמור
**אז** כפתור השמירה מושבת עד שכל שדות החובה תקינים

**Tasks / Subtasks:**

**DB:**
- [x] מודל `Contact` (firstName, lastName, idNumber, role, emails\[\], phone, notes, emailOptIn, smsOptIn, status, deactivatedAt, externalRequestSource, externalRequestDate, timestamps — **ללא** שדה תחום ישיר) + מודל `ContactOnSupportedBody` + מיגרציה (`add_contact`). שדות `deactivatedAt`/`externalRequestSource`/`externalRequestDate` נוספו כבר עכשיו (לא בשימוש עד Story 1.7) לפי דרישת Story 1.7's task list המפורשת ("השדות שהוגדרו כבר במודל Contact ב-Story 1.5")

**שרת: פקודות ו-API:**
- [x] `packages/shared-schemas/contacts/{types.ts,schema.ts}` — `createContactSchema` (`emails` כמערך של כתובות תקינות, לפחות איבר אחד; `supportedBodyId` חובה). גם `listContactsQuerySchema` בסיסי (page/pageSize בלבד — ללא סינון, זה Story 1.8)
- [x] `apps/api/src/contacts/` — `contacts.module.ts` + `contacts.controller.ts` (`POST /contacts` + `GET /contacts` עם `JoiValidationPipe`) + `contacts.service.ts` — `create` (יוצרת `Contact` + `ContactOnSupportedBody` יחד בטרנזקציה) + `list` (ברירת מחדל `status: 'ACTIVE'` לפי `expertise-postgres-prisma`, גם שעדיין אין שום דרך ליצור INACTIVE)

**UI:**
- [x] קומפוננטת `SupportedBodySelect` משותפת ב-`packages/ui` (Select עם חיפוש, פרזנטיישנית כמו `DomainMultiSelect`), לשימוש חוזר ב-Story 1.6
- [x] `apps/web/components/contacts/ContactForm.tsx` — RHF, שדה `SupportedBodySelect` (חובה), שדה-מערך דינמי לכתובות דוא"ל ("הוסף כתובת נוספת" / "הסר") — מנוהל ישירות כ-`string[]` (לא `useFieldArray`) כדי להשתמש **באותה סכמת Joi בדיוק** גם בטופס וגם בשרת
- [x] טרום-מילוי גוף נתמך (`defaultSupportedBodyId`) — מחובר כפתור "הוסף איש קשר" בתוך `SupportedBodyEditDrawer` (ר' החלטה 3 למעלה)
- [x] `useCreateContactMutation` + `useListContactsQuery` (RTK Query, מול `apps/api`) + invalidation תגית `Contact`

**תוספת scope (לא בתכנון המקורי של הסטורי):**
- [x] `apps/web/components/contacts/{ContactsList.tsx,ContactsScreen.tsx}` + `app/(internal)/contacts/page.tsx` — דף `/contacts` מלא, במבנה זהה ל-`/supported-bodies` (רשימה + Skeleton + EmptyState + Pagination + Drawer יצירה), **ללא** חיפוש/סינון (זה Story 1.8 — אותו יחס בדיוק שהיה בין Story 1.2 ל-Story 1.4)
- [x] `AppShell.tsx` — נוספו קישורי ניווט (`NavLink`+Next `Link`) בין "גופים נתמכים" ל"אנשי קשר", עם מצב active לפי `usePathname`

**⚠️ אימות:** `build`/`typecheck`/`lint`/`test` — 18/18 ירוק. אומת end-to-end מול שרת API רץ בפועל: יצירת איש קשר עם שתי כתובות דוא"ל ותעודת זהות (עברית, דרך קובץ — לא CLI inline), הופעתו ב-GET, שגיאות ולידציה (שדות חובה חסרים, פורמט דוא"ל לא תקין כולל path `emails.0` הממופה נכון ל-`setError("emails", ...)` בטופס, מערך דוא"ל ריק). SSR אומת ששני הדפים עולים וקישורי הניווט מופיעים בשניהם. רשומת הבדיקה נוקתה בסוף. **מגבלה זהה לקודם:** אין כלי browser automation — מילוי הטופס בפועל, "הוסף כתובת נוספת", ולחיצה על "הוסף איש קשר" מתוך Drawer העריכה לא אומתו ויזואלית.

---

## Story 1.6: עריכת איש קשר ושיוך לגופים נתמכים נוספים

**⚠️ החלטות שהתקבלו לפני הבנייה:**
1. **שדות העריכה**: ה-AC מפרט "תפקיד/טלפון/דוא\"ל/הערות/העדפות ערוץ" בלבד. אושר: **רק** השדות האלה ניתנים לעריכה בסטורי זו — שם פרטי/שם משפחה/תעודת זהות **לא** ניתנים לעריכה כאן (מוצגים read-only), ושיוך הגוף הנתמך הראשון גם הוא לא משתנה כאן (רק הוספת גוף **נוסף** דרך endpoint נפרד).
2. **Toast (UX-DR16)**: גילינו תוך כדי בנייה ש-`EXPERIENCE.md` מגדיר "שמירה נכשלה → Notification (toast)" ככלל שחל על **כל טופס**, לא רק על עריכת איש קשר — אבל שלושת הטפסים הקודמים (Story 1.2/1.3/1.5) השתמשו בהודעה מוטבעת (`Alert`/`Text`) במקום. אושר: **לתקן גם אותם** ל-toast, לא רק את הטופס החדש — ראו הערת scope בתחתית הסטורי. הותקן `@mantine/notifications` (לא היה בפרויקט קודם), מורכב ב-`app/layout.tsx`.

בתור מי שנכנס למערכת,
אני רוצה לערוך פרטי איש קשר קיים ולשייך אותו ליותר מגוף נתמך אחד,
כדי שאיש קשר שמייצג כמה גופים יופיע נכון בכולם — ויהיה משויך גם לתחומים של כל הגופים הללו.

**Acceptance Criteria:**

**בהינתן** לחיצה על שורת איש קשר ברשימה
**כאשר** המשתמש לוחץ בכל מקום בשורה
**אז** נפתח Drawer עריכה מהצד (כיוון "תוכן" — נפתח משמאל, UX-DR7), לא תפריט נסתר (UX-DR11)

**בהינתן** רשומת איש קשר פתוחה לעריכה
**כאשר** המשתמש משנה שדות (תפקיד/טלפון/דוא"ל/הערות/העדפות ערוץ) ולוחץ "שמירה"
**אז** הרשומה מתעדכנת, וה-Audit Trail מתעד מה השתנה ברמת שדה (NFR-B)

**בהינתן** איש קשר משויך כרגע לגוף נתמך אחד
**כאשר** המשתמש בוחר "שייך לגוף נתמך נוסף" ובוחר גוף קיים (דרך `SupportedBodySelect` מ-Story 1.5)
**אז** איש הקשר מופיע כעת ברשימת אנשי הקשר של שני הגופים הנתמכים, ומגיע גם לתחומים של הגוף החדש (FR-7 תוצאה נבדקת)

**בהינתן** שמירה נכשלת (למשל שגיאת שרת)
**כאשר** המשתמש לוחץ "שמירה"
**אז** מוצג `Notification` (toast) עם שגיאה ספציפית; נתוני הטופס נשמרים במקום, ואפשר לנסות שוב מיד (UX-DR16)

**Tasks / Subtasks:**

**שרת: פקודות ו-API:**
- [x] `apps/api/src/contacts/contacts.controller.ts` — מתווסף `PATCH /contacts/:id` עם `JoiValidationPipe(updateContactSchema)` (role/phone/emails/notes/emailOptIn/smsOptIn בלבד — ר' החלטה 1)
- [x] Endpoint לשיוך גוף נתמך נוסף — `POST /contacts/:id/supported-bodies` עם `{ supportedBodyId }` (`POST` לא `PUT` — שיוך כפול הוא קונפליקט (409), לא no-op, לפי decision rule ב-`expertise-api-rest`)
- [x] `contacts.service.ts` — `update` + `addSupportedBody` (409 אם הגוף כבר משויך, 404 אם הרשומה לא קיימת)

**UI:**
- [x] `apps/web/components/contacts/ContactEditDrawer.tsx` — נפתח משמאל (כיוון "תוכן", UX-DR7), לחיצה על שורה פותחת אותו (UX-DR11, מחובר ב-`ContactsList`)
- [x] רכיב "שייך לגוף נתמך נוסף" בתוך ה-Drawer, משתמש ב-`SupportedBodySelect` (Story 1.5) — מסנן גופים כבר-משויכים מרשימת האפשרויות (UX; מונע את מקרה ה-409 מראש)
- [x] טיפול בכשל שמירה: `Notification` (toast) עם שמירת נתוני הטופס (UX-DR16) — `@mantine/notifications` הותקן ומורכב גלובלית
- [x] `useUpdateContactMutation` + `useAddSupportedBodyMutation` (RTK Query, מול `apps/api`)

**תוספת scope (ר' החלטה 2 למעלה):**
- [x] תוקנו `SupportedBodyForm.tsx`, `SupportedBodyEditDrawer.tsx`, `ContactForm.tsx` — הודעת הכשל הגנרית (לא CONFLICT, לא per-field) הוחלפה מ-Alert/Text מוטבע ל-`notifications.show(...)`. גם `handleDeactivate`/`handleActivate` ב-`SupportedBodyEditDrawer` קיבלו טיפול שגיאה (toast) — לא היה להם בכלל קודם (קריאה ללא try/catch)
- [x] **באג אמיתי שנמצא ותוקן תוך כדי**: כפתורים משניים בתוך `<form>` (למשל "השבת"/"הפעל מחדש"/"הוסף איש קשר"/"הוסף כתובת נוספת"/"הסר") לא הוגדרו עם `type="button"` — ברירת המחדל של HTML היא `type="submit"`, כך שלחיצה עליהם עלולה הייתה גם לשלוח את הטופס בטעות. תוקן בכל המקומות הקיימים (`SupportedBodyEditDrawer`, `ContactForm`) וביושם נכון מההתחלה ב-`ContactEditDrawer` החדש

**⚠️ אימות:** `build`/`typecheck`/`lint`/`test` — 18/18 ירוק. אומת end-to-end מול שרת API רץ: עדכון role/phone/emails/notes/prefs (עברית, דרך קובץ), שגיאת ולידציה על body ריק, 404 על id לא קיים, שיוך לגוף נתמך שני (מופיע ב-GET), שגיאת 409 בניסיון שיוך כפול (גם לגוף השני וגם לראשון). SSR אומת ששני הדפים עדיין עולים (200) אחרי התקנת `@mantine/notifications`. רשומת הבדיקה נוקתה. **מגבלה זהה לקודם:** אין כלי browser automation — התראות ה-toast בפועל, לחיצה על שורה, ומילוי הטופס לא אומתו ויזואלית בדפדפן.

---

## Story 1.7: סימון איש קשר כלא פעיל עם תיעוד מקור ותאריך

בתור מי שנכנס למערכת,
אני רוצה לסמן איש קשר שהתחלף/הוסר כ"לא פעיל" ולתעד מאיפה ומתי התקבלה הבקשה,
כדי שהמידע ההיסטורי נשמר ואני עומד בדרישת התיעוד של בקשות חיצוניות.

**Acceptance Criteria:**

**בהינתן** רשומת איש קשר פעילה פתוחה לעריכה
**כאשר** המשתמש לוחץ "סמן כלא פעיל"
**אז** נפתח Modal קטן שדורש בחירת מקור (טלפון/דוא"ל/אחר) ותאריך — לא toggle מיידי (UX-DR13)

**בהינתן** ה-Modal פתוח
**כאשר** המשתמש מנסה לאשר בלי לבחור מקור או למלא תאריך
**אז** כפתור "אישור וסימון" מושבת / מוצגת שגיאת ולידציה (FR-9 תוצאה נבדקת)

**בהינתן** המשתמש ממלא מקור ותאריך ולוחץ "אישור וסימון"
**כאשר** הפעולה נשמרת
**אז** רשומת האיש קשר מתעדכנת ל-`status: INACTIVE` עם `deactivatedAt`, `externalRequestSource`, ו-`externalRequestDate` — **הרשומה לא נמחקת** (FR-8)

**בהינתן** איש קשר סומן כלא פעיל
**כאשר** המשתמש חוזר לרשימת אנשי הקשר של הגוף הנתמך (סינון ברירת מחדל: פעילים בלבד)
**אז** הרשומה הלא-פעילה לא מופיעה כברירת מחדל, אך מופיעה כשמסננים "כולל לא פעילים" (FR-8 תוצאה נבדקת, תלוי ב-Story 1.8)

**Tasks / Subtasks:**

**DB:**
- [x] אומת ששדות `externalRequestSource`/`externalRequestDate` (שהוגדרו כבר במודל `Contact` ב-Story 1.5) זמינים ל-update — אין שינוי סכמה נוסף נדרש. אומת ישירות מול ה-DB: שני השדות וגם `deactivatedAt`/`status` נכתבים נכון

**שרת: פקודות ו-API:**
- [x] `apps/api/src/contacts/contacts.controller.ts` — מתווסף `POST /contacts/:id/deactivate` (action endpoint, לא PATCH — מעבר מצב עם תיעוד חובה, per decision rule ב-`expertise-api-rest`) עם `{ source, date }` חובה יחד
- [x] `contacts.service.ts` — `deactivate(id, source, date)` — מעדכנת `status: 'INACTIVE'`, `deactivatedAt: now()` (מתי בוצעה הפעולה באפליקציה), `externalRequestSource`, `externalRequestDate` (מתי התקבלה הבקשה בפועל — יכול להיות תאריך עבר, מוזן ע"י המשתמש)

**UI:**
- [x] `apps/web/components/contacts/MarkInactiveModal.tsx` — Mantine `Modal`, `Select` למקור (PHONE/EMAIL/OTHER) + `DateInput` מ-`@mantine/dates` (ספרייה חדשה, הותקנה + מורכבת ב-`layout.tsx` עם `DatesProvider` ולוקאל עברי), כפתור "אישור וסימון" מושבת עד ששניהם נבחרו (UX-DR13)
- [x] חיבור כפתור "סמן כלא פעיל" בתוך `ContactEditDrawer` (Story 1.6) — מוצג רק כש-`status === 'ACTIVE'`; בהצלחה סוגר גם את ה-Modal וגם את ה-Drawer כולו (הרשומה כבר לא תופיע ברשימת ברירת המחדל)
- [x] `useDeactivateContactMutation` (RTK Query, מול `apps/api`) + invalidation תגית `Contact`

**⚠️ אימות:** `build`/`typecheck`/`lint`/`test` — 18/18 ירוק. אומת end-to-end מול שרת API רץ: שגיאת ולידציה על body ריק, שגיאה על ערך `source` לא תקין (לא אחד מ-PHONE/EMAIL/OTHER), השבתה מוצלחת, איפוס הרשומה מרשימת ברירת המחדל (`GET /contacts` מחזיר ריק אחרי), 404 על id לא קיים, ואימות ישיר מול ה-DB ש-`deactivatedAt`/`externalRequestSource`/`externalRequestDate` נשמרו נכון. SSR אומת ששני הדפים עדיין עולים (200) אחרי התקנת `@mantine/dates`. רשומת הבדיקה נוקתה. **מגבלה זהה לקודם:** אין כלי browser automation — פתיחת ה-Modal, בחירת תאריך מה-calendar picker, ולחיצת הכפתורים לא אומתו ויזואלית.

---

## Story 1.8: חיפוש וסינון אנשי קשר

**⚠️ החלטות שהתקבלו לפני הבנייה:**
1. **ContactsList — Server Component או Client Component?** המשימה כאן כתובה במפורש "Server Component" (ה-pattern הקנוני), אבל `SupportedBodiesList.tsx` (Story 1.4, מאושרת וקיימת) נבנתה כ-Client Component — סטייה מתועדת מה-pattern הקנוני (`ARCHITECTURE-SPINE.md` AD-2), לא טעות. בדקתי את שני מסמכי הדרישות המקוריים (`מסמך דרישות - ניהול תקשורת עם הגופים`, סעיף CM-7, ואת `פיצ'ר ניהול אנשי קשר לגוף נתמך`) — אף אחד מהם לא דורש סינון הניתן לשיתוף-קישור/ששורד רענון דף, זו רק דרישה טכנית-ארכיטקטונית, לא דרישת מוצר. **הוחלט**: להמשיך באותה שיטה (Client Component), עקבי עם `SupportedBodiesList`, ולא לפתוח סטייה שנייה נפרדת רק במסך הזה.
2. **שם הפרמטר**: `status=` (כפי שמופיע במשימת ה-controller למטה) הוחלף ב-`includeInactive` (בוליאני) — תואם את ה-AC בפועל ("checkbox 'כלול לא פעילים'") ואת אותו pattern שכבר נקבע ל-`isActive` של SupportedBody (Story 1.4). `status=` בטקסט המשימה המקורי היה ניסוח רופף, לא דרישה נפרדת.

בתור מי שנכנס למערכת,
אני רוצה לחפש ולסנן אנשי קשר לפי גוף נתמך, תחום, סטטוס, ושנת עדכון אחרונה,
כדי שאדע מיד מי איש הקשר הנכון בלי לחפש במיילים ישנים.

**Acceptance Criteria:**

**בהינתן** רשימת אנשי קשר עם יותר מרשומה אחת
**כאשר** המשתמש מקליד בשדה החיפוש (debounced ~300ms)
**אז** הרשימה מסתננת לפי שם תואם, ומציגה כברירת מחדל רק `status: ACTIVE`

**בהינתן** המשתמש מסמן "כלול לא פעילים"
**כאשר** הפילטר מופעל
**אז** גם רשומות `INACTIVE` מוצגות ברשימה (תלוי ב-Story 1.7)

**בהינתן** המשתמש בוחר פילטר גוף נתמך / תחום / שנת עדכון אחרונה
**כאשר** הפילטר מופעל
**אז** הרשימה מציגה רק רשומות תואמות, עם Pagination; פילטר "תחום" מסנן אנשי קשר **דרך הגוף/ים הנתמכים** שהם משויכים אליהם (איש קשר עצמו אינו נושא שדה תחום)

**בהינתן** הרשימה ריקה (למשל גוף נתמך חדש בלי אנשי קשר)
**כאשר** הרשימה נטענת
**אז** מוצג Empty State עם פעולה ראשית "הוספת איש קשר ראשון" (UX-DR6)

**Tasks / Subtasks:**

**שרת: פקודות ו-API:**
- [x] `apps/api/src/contacts/contacts.controller.ts` — `GET /contacts?search=&supportedBodyId=&domainId=&includeInactive=&updatedYear=` + `JoiValidationPipe` על ה-query; `domainId` מסנן דרך `supportedBodies: { some: { supportedBody: { domains: { some: { domainId } } } } }`
- [x] ברירת מחדל ב-`contacts.service.ts`: `status: 'ACTIVE'` אלא אם `includeInactive=true` (עקרון "ברירת מחדל פעילים בלבד" מ-`expertise-postgres-prisma`)
- [x] **באג אמיתי שנמצא ותוקן תוך כדי**: `supportedBodyId` ו-`domainId` שניהם מגיעים דרך אותו relation (`supportedBodies`) — פיזור שני `{supportedBodies:{...}}` נפרדים לאותו object literal היה גורם לשני דורס ראשון בשקט (אותו מפתח פעמיים). מוזגו ל-`some` אחד, כך שכששני הפילטרים פעילים יחד הם נבדקים על אותו שיוך, לא שני שיוכים שונים בטעות. אומת מפורשות בבדיקה (קומבינציה לא-תואמת → ריק, קומבינציה תואמת → תוצאה נכונה)

**UI:**
- [x] `ContactsList.tsx` — Client Component (ר' החלטה 1 למעלה) + toolbar סינון (חיפוש debounced ~300ms, checkbox "כלול לא פעילים", Select לגוף/תחום/שנה — 6 שנים אחרונות)
- [x] Pagination + `Skeleton` לטעינה ראשונית + Empty State — הודעה/CTA שונים כשיש פילטרים פעילים ("אין תוצאות תואמות") לעומת רשימה ריקה לגמרי ("הוספת איש קשר ראשון")
- [x] `useListContactsQuery` (RTK Query, מול `apps/api`) לסינון בצד הלקוח

**⚠️ אימות:** `build`/`typecheck`/`lint`/`test` — 18/18 ירוק. אומת end-to-end מול שרת API רץ עם שני אנשי קשר על שני גופים/תחומים שונים (אחד הושבת): ברירת מחדל (רק פעיל), `includeInactive=true` (שניהם), חיפוש, סינון גוף נתמך, סינון תחום (כולל קומבינציה עם גוף נתמך — שני מקרים: תואם ולא-תואם), סינון שנה (שנה נוכחית מול 2020), ושגיאת ולידציה על ערך בוליאני לא תקין. SSR אומת שכל רכיבי ה-toolbar מופיעים בדף. רשומות הבדיקה נוקו. **מגבלה זהה לקודם:** אין כלי browser automation — ההקלדה עם debounce, בחירת הפילטרים מה-Select-ים, ומעברי המסך לא אומתו ויזואלית.

---

### 🐛 תיקון לאחר השלמה: "הערות" חסם שמירה כשריק

**הבעיה:** `Joi.string().optional()` לא מאפשר מחרוזת ריקה (`""`) — רק מאפשר **שהשדה לא יישלח בכלל**. אבל טופס RHF תמיד שולח את כל השדות, כולל שדות טקסט ריקים (ערך ברירת מחדל `""`, לא `undefined`). התוצאה: כל שדה אופציונלי בטופס שנשאר ריק (הערות, ת"ז, תפקיד, טלפון) חסם שמירה עם שגיאת "is not allowed to be empty" — למרות שהשדה מוגדר `optional()`.

**התיקון (גרסה סופית):** `packages/shared-schemas/src/contacts/schema.ts` — `idNumber`/`role`/`phone`/`notes` ב-create/update עברו ל-`.allow("")` (לא `.empty("")`): מחרוזת ריקה עוברת ולידציה בהצלחה ומגיעה ל-Service כ-`""` בפועל, לא נמחקת משם. ב-`apps/api/src/contacts/contacts.service.ts` נוספה פונקציית עזר `blankToNull()` שממירה `""` ל-`null` בזמן הכתיבה ל-DB — כך שגם יצירה וגם עריכה עם שדה ריק שומרות `null`, **וגם** ניקוי של שדה שכבר היה לו ערך קודם (למשל מחיקת הערה קיימת ב-Drawer העריכה) נשמר בפועל, לא מתעלם ממנו. אומת end-to-end: יצירה עם שדות ריקים, עריכה שמנקה הערה קיימת (אומת ב-GET שחוזר `null`, לא הטקסט הישן), ועריכה שמחליפה הערה בטקסט חדש — שלושתם עובדים נכון.

**בדיקה נוספת**: אין בעיה מקבילה ב-`SupportedBody` — השדות שם (`name`/`companyId`) הם שדות-חובה מהותיים (לא "אופציונליים ריקים"), אז דחיית מחרוזת ריקה שם היא התנהגות נכונה, לא אותו באג.

---

### ✨ תוספת לאחר השלמה : הפעלה מחדש לאיש קשר שהושבת

**הבקשה:** Story 1.7 בנתה רק את כיוון ההשבתה — לא הייתה שום דרך להחזיר איש קשר ל-`ACTIVE` אחרי שהושבת. זה מקביל לאותו פער שכבר תוקן עבור `SupportedBody` (ר' החלטה בסטורי 1.3).

**התיקון:**
- **שרת**: נוסף `POST /contacts/:id/activate` (symmetric ל-`/deactivate`, בלי גוף בקשה — אין תיעוד חובה כמו בהשבתה) ו-`contacts.service.ts` — `activate(id)`. `deactivatedAt`/`externalRequestSource`/`externalRequestDate` **נשארים כפי שהם** (לא מתאפסים) — זה השיא ההיסטורי של ההשבתה האחרונה, עקבי עם דרישת "שמירת מאגר היסטורי" (FR-8/CM-3), לא "ביטול" של מה שקרה.
- **UI**: `ContactEditDrawer.tsx` — כשהרשומה `INACTIVE`, הכפתור "סמן כלא פעיל" מתחלף ל"הפעל מחדש" (ירוק, ללא Modal אישור — לא הרסני), אותו pattern בדיוק כמו ב-`SupportedBodyEditDrawer`.
- `useActivateContactMutation` (RTK Query) + invalidation תגית `Contact`.

**⚠️ אימות:** build/typecheck/lint/test — 18/18 ירוק. אומת end-to-end: יצירה→השבתה→הפעלה מחדש→אימות שהרשומה חזרה ל-`ACTIVE` ומופיעה ברשימת ברירת המחדל, ושדות התיעוד ההיסטורי נשארו כפי שהיו (לא התאפסו). 404 על id לא קיים. רשומת הבדיקה נוקתה.

---

### ✨ שינוי משמעותי לאחר השלמה (): שיוך איש קשר לתחום — תת-קבוצה מתוך תחומי הגוף, לא כולם אוטומטית

**הבקשה (עם מוקאפ מצורף):** איש קשר של גוף נתמך רב-תחומי לא בהכרח איש הקשר של **כל** תחומי הגוף. לכן כשבוחרים גוף נתמך (ביצירה או בשיוך לגוף נוסף), צריך גם לבחור אילו מתחומי הגוף איש הקשר הזה מייצג בפועל — ברירת מחדל: כל התחומים מסומנים, עם אפשרות להוריד סימון. גם התבקש: הצגת העדפות דוא"ל/SMS ברשומת איש הקשר ברשימה.

**⚠️ הערה חשובה**: זה הופך בפועל החלטת מוצר שתועדה במפורש ב-Story 1.5 ("איש הקשר אינו בוחר תחום בעצמו — הוא מגיע לתחום/ים דרך התחום/ים של הגוף הנתמך") ובמפת הכיסוי (FR-7: "שיוך לתחום מתבצע ברמת הגוף הנתמך, לא ברמת איש הקשר עצמו"). שהכוונה המקורית של ההחלטה הייתה רק למנוע מאיש קשר לבחור תחום **שלא שייך לגוף שלו בכלל** — לא לשלול ממנו בחירה בתת-קבוצה מתוך תחומי הגוף שכן נבחר. הסייג הזה (subset-only) הוא בדיוק מה שנאכף עכשיו בשרת.

**שינוי סכמת DB:**
- מודל חדש `ContactOnSupportedBodyDomain` (contactId+supportedBodyId+domainId) — מתעד אילו מתחומי ה-`ContactOnSupportedBody` הספציפי הזה רלוונטיים. FK מורכב (`[contactId, supportedBodyId]`) חזרה ל-`ContactOnSupportedBody`.
- מיגרציה `contact_supported_body_domains` הורצה. **שתי הרשומות האמיתיות שכבר היו ב-DB (רחל הינמן, מיכל לופיאנסקי) מולאו (backfill) עם כל תחומי הגוף שלהן** — התנהגות זהה למה שהיה קודם (ברירת המחדל "כל התחומים"), כדי לא לאבד מידע.

**שרת:**
- `CreateContactInput`/`AddSupportedBodyInput` — נוסף `domainIds: string[]` (חובה, לפחות 1). **נאכף שרת-צד**: `domainIds` חייב להיות תת-קבוצה של תחומי ה-`supportedBodyId` שנבחר (לא רק ב-UI) — Joi לא יודע אילו תחומים שייכים לאיזה גוף, אז זו בדיקה נפרדת ב-Service לפני כל כתיבה, מחזירה `VALIDATION_ERROR` אם לא.
- `ContactDto.supportedBodyIds: string[]` **הוחלף** ב-`supportedBodyLinks: {supportedBodyId, domainIds}[]` — שינוי שובר (breaking), אבל אין עדיין קוד אמיתי שתלוי בצורה הישנה חוץ מהאפליקציה עצמה (עודכנה כולה באותו commit).
- `GET /contacts?domainId=` — הסינון עבר מ"כל תחומי הגוף המקושר" ל"תת-הקבוצה הספציפית של הקישור" (אחרת הפיצ'ר לא היה משפיע על תוצאות חיפוש בכלל). אומת: איש קשר שהתת-קבוצה שלו **לא** כוללת תחום מסוים, לא מופיע בסינון לפי אותו תחום — גם אם הגוף שלו בכללותו כן שייך אליו.

**UI:**
- קומפוננטה חדשה `SupportedBodyDomainsPicker` ב-`packages/ui` — pills לבחירה מרובה (Mantine `Chip.Group`), תואם לעיצוב במוקאפ. פרזנטיישנית (AD-11) — הצמצום ל"רק תחומי הגוף שנבחר" קורה ב-`apps/web`, לא בתוך הרכיב.
- `ContactForm.tsx` — כשנבחר גוף נתמך, ה-picker מופיע עם כל תחומי הגוף מסומנים מראש; משתנה הגוף מאפס ומחדש את הבחירה.
- `ContactEditDrawer.tsx` — כל שיוך מוצג כבלוק נפרד ("שיוך 1", "שיוך 2"...) עם badges של התחומים שלו (תצוגה בלבד — עריכת תחומים לשיוך **קיים** לא בתחום העבודה הזו, רק בזמן יצירה/הוספת שיוך). אותו picker גם בתוך "שייך לגוף נתמך נוסף".
- **באג שנמצא ותוקן תוך כדי**: ה-Drawer מחזיק snapshot חד-פעמי של הרשומה (`contact` prop, מגיע מלחיצת השורה) — אחרי "שייך" מוצלח ה-Drawer נשאר פתוח (בניגוד לפעולות אחרות שסוגרות אותו), והתצוגה לא הייתה מתעדכנת עם השיוך החדש בלי לסגור ולפתוח מחדש. תוקן ע"י שימוש בתוצאת ה-mutation עצמה לעדכון התצוגה המקומית.
- `ContactsList.tsx` — עמודת "גוף נתמך" עודכנה לצורת הנתונים החדשה; נוספה עמודת "ערוצי תקשורת" עם badge לדוא"ל/SMS כשהעדפה מסומנת.

**⚠️ אימות:** `build`/`typecheck`/`lint`/`test` — 18/18 ירוק. אומת end-to-end מול שרת: יצירה עם תת-קבוצה אמיתית, דחיית תחום שלא שייך לגוף (ביצירה וגם בשיוך נוסף), שיוך לגוף שני עם תת-קבוצה נפרדת, סינון `domainId` לפי תת-קבוצה (לא כל תחומי הגוף) — כולל מקרה שהגוף כן שייך לתחום אבל תת-הקבוצה הספציפית לא. backfill אומת ישירות מול שתי הרשומות האמיתיות. SSR אומת ששני הדפים עדיין עולים. רשומות/שינויי בדיקה נוקו/הוחזרו למצבם המקורי. **מגבלה זהה לקודם:** אין כלי browser automation — בחירת ה-pills, הופעת ה-picker לפי גוף נבחר, ובלוקי "שיוך 1/2" לא אומתו ויזואלית בדפדפן.

### 🐛 תיקון המשך לאחר השלמה : לא ניתן היה לערוך תחומים של שיוך קיים

**הבעיה:** השינוי הקודם אפשר לבחור תת-קבוצת תחומים רק **פעם אחת** — ביצירה או בהוספת שיוך. אחרי זה, אם היה צורך להוסיף/להסיר תחום משיוך שכבר קיים, לא הייתה שום דרך לעשות את זה — תועד כמגבלה ידועה ("עריכת תחומים לשיוך קיים לא בתחום העבודה הזו"), והתבקש שזה כן יהיה אפשרי.

**התיקון:**
- **שרת**: `PATCH /contacts/:id/supported-bodies/:supportedBodyId` חדש — `contacts.service.ts`'s `updateSupportedBodyDomains(contactId, supportedBodyId, domainIds)`. 404 אם השיוך לא קיים, אותה בדיקת subset (`assertDomainsBelongToBody`) כמו ביצירה/הוספה, `.min(1)` — אי אפשר לנקות שיוך לאפס תחומים (זה היה מצריך endpoint נפרד ל"ביטול שיוך" לגמרי, לא התבקש). Replace מלא (מחיקה+יצירה), אותו pattern כמו שאר הסנכרונים בפרויקט.
- **UI**: כל בלוק "שיוך X" ב-`ContactEditDrawer` הפך מתצוגת badges קבועה ל-picker אינטראקטיבי (אותו `SupportedBodyDomainsPicker`) — כפתור "שמירת שינויים בתחומים" מופיע רק כש-יש בפועל שינוי (dirty-check), לא auto-save על כל toggle.
- `useUpdateSupportedBodyDomainsMutation` (RTK Query) + invalidation.

**⚠️ אימות:** build/typecheck/lint/test — 18/18 ירוק. אומת end-to-end מול **הרשומות האמיתיות בפועל**: צמצום שיוך דו-תחומי לתחום אחד, הרחבה בחזרה לשניים, דחיית תחום לא-שייך, דחיית מערך ריק, 404 על שיוך לא קיים — ואז **הוחזר למצב המקורי המדויק**. SSR/שרת בפועל (לא מופע זמני שלי — שרת ה-dev הקיים התאושש בינתיים ושימש לבדיקה).

### 🐛 תיקון המשך נוסף : הסרת תחום מגוף נתמך לא ניקתה את תת-הקבוצה אצל אנשי הקשר

**הבעיה:** `SupportedBodyOnDomain` (תחומי הגוף עצמו) ו-`ContactOnSupportedBodyDomain` (תת-הקבוצה שאיש קשר מייצג מתוכם) הן שתי טבלאות **עצמאיות לגמרי**, בלי FK/cascade ביניהן. כשעורכים גוף נתמך ומסירים ממנו תחום (ב-`SupportedBodiesList`/`SupportedBodyEditDrawer`), `supported-bodies.service.ts`'s `update()` עדכן רק את `SupportedBodyOnDomain` — ה-`ContactOnSupportedBodyDomain` של כל אנשי הקשר המשויכים נשאר **כפי שהיה**, כעת מצביע על תחום שהגוף כבר לא כולל. זה התגלה בניסוי אמיתי: תחום "חינוך" הוסר מגוף, וסינון אנשי קשר לפי "חינוך" המשיך להחזיר איש קשר ששויך לגוף הזה — למרות שהתחום כבר לא קיים שם.

**התיקון:** `supported-bodies.service.ts`'s `update()` — כשמתעדכן `domainIds` של הגוף, מוחק (באותה טרנזקציה) גם כל שורת `ContactOnSupportedBodyDomain` של הגוף הזה שמצביעה על תחום שלא נשאר ברשימה החדשה. מתבצע עבור **כל** אנשי הקשר המשויכים לגוף, לא רק איש קשר ספציפי.

**ניקוי נתונים אמיתיים**: בנוסף לתיקון הקוד, הרצתי script חד-פעמי שסרק את כל השורות הקיימות ומחק שורות יתומות שכבר הצטברו **ברשומות האמיתיות שלך** — נמצאו ונוקו 2 שורות יתומות (רחל הינמן, שני השיוכים שלה).

**⚠️ אימות:** build/typecheck/lint — ירוק. שחזרתי את התרחיש המדויק שדיווחת עליו מול הנתונים האמיתיים: הוספתי בחזרה תחום לגוף, נתתי לשיוך של רחל את אותו תחום, הסרתי את התחום מהגוף שוב — ואימתתי שתת-הקבוצה של רחל התכווצה אוטומטית, וסינון לפי אותו תחום כבר לא מחזיר אותה. המצב הוחזר בדיוק למצב המקורי (רק "בריאות" בשני הגופים) בסיום.

### ✨ שינוי לאחר השלמה : ת"ז/תפקיד/טלפון הם שדות חובה, לא אופציונליים

**הבקשה:** ב-Story 1.5 הוגדרו `idNumber`/`role`/`phone` כשדות אופציונליים (רק `notes` תוכנן כאופציונלי אמיתי). התבקש להפוך את זה — ת"ז, תפקיד וטלפון הם למעשה שדות חובה; רק הערות נשארות אופציונליות.

**התיקון:**
- `CreateContactInput` (יצירה) — `idNumber`/`role`/`phone` הפכו משדות `?` (אופציונליים) לשדות חובה רגילים, עם `Joi...min(1).required()` (אותו pattern כמו `firstName`/`lastName`) — גם ריק וגם חסר נדחים.
- `UpdateContactInput` (עריכה) — השדות האלה נשארים **אופציונליים לשליחה** (PATCH חלקי כרגיל), אבל אם כן נשלחים — **אסור שיהיו ריקים** (`min(1)`, בלי `.allow("")`). כלומר: אי אפשר "לנקות" תפקיד/טלפון לריק דרך עריכה — ההבדל היחיד מ-`notes`, שנשארת השדה היחיד שבאמת ניתן לנקות.
- `ContactForm.tsx`/`ContactEditDrawer.tsx` — השדות סומנו `required` ב-UI בהתאם.
- הודעת השגיאה על תחום שלא שייך לגוף תורגמה לעברית (הייתה באנגלית בטעות).

**⚠️ אימות:** build/typecheck/lint/test — 18/18 ירוק. אומת מול שרת: חסרים ת"ז/תפקיד/טלפון → VALIDATION_ERROR לכל אחד; ערכים ריקים לאותם שדות → נדחים גם כן; יצירה תקינה עם כל השדות מלאים → הצליחה; ניסיון לנקות טלפון בעריכה → נדחה; ניקוי הערות בעריכה → עדיין עובד כרגיל. רשומת הבדיקה נוקתה.

### ✨ תוספת קטנה: הודעת "לפחות תחום אחד" תורגמה לעברית

גם שגיאת `domainIds` (מערך ריק או חסר לגמרי) הייתה עם הודעת ברירת המחדל של Joi באנגלית. נוסף `.messages()` משותף (`domainIdsSchema`, מוגדר פעם אחת ומשומש בשלושת המקומות — יצירה, שיוך לגוף נוסף, עריכת תחומים) עם "יש לבחור לפחות תחום אחד". אומת בשלושת ה-endpoints גם למקרה של מערך ריק וגם לשדה חסר.

**הערה לשקיפות**: אומת גם שהאכיפה קיימת **בשני הצדדים בלי כפילות קוד** — השרת וה-UI (`ContactForm`/`ContactEditDrawer` דרך `joiResolver`) משתמשים **באותו אובייקט Joi בדיוק** מ-`packages/shared-schemas`, לא בשני מימושים נפרדים.

### ✨ תוספת לאחר השלמה : אפשרות להסיר שיוך לגוף נתמך

**הבקשה:** "בעריכה אפשר לשנות הכל חוץ משם ות"ז" — כולל שיוכים לגופים נתמכים. הוספה כבר הייתה אפשרית (Story 1.6), עריכת תחומים כבר נוספה — אבל **הסרה מלאה** של שיוך לא הייתה אפשרית בכלל.

**התיקון:**
- **שרת**: `DELETE /contacts/:id/supported-bodies/:supportedBodyId` חדש — `contacts.service.ts`'s `removeSupportedBody()`. **כלל עסקי**: לאיש קשר חייב להישאר שיוך לפחות לגוף נתמך אחד (אותה דרישה כמו ביצירה) — ניסיון להסיר שיוך יחיד נדחה עם `409 CONFLICT` ברור, לא מאפשר להשאיר איש קשר "יתום" בלי שום גוף.
- **UI**: `ContactEditDrawer.tsx` — כפתור "הסר שיוך" בכל בלוק "שיוך X", עם Modal אישור (פעולה מסוג זה משמעותית יותר מסימון/הסרת תחום בודד — אותו pattern כמו השבתת גוף נתמך).
- `useRemoveSupportedBodyMutation` (RTK Query) + invalidation.

**⚠️ אימות:** build/typecheck/lint/test — 18/18 ירוק. אומת end-to-end מול **הנתונים האמיתיים**: ניסיון להסיר את השיוך היחיד של מיכל לופיאנסקי → 409 נדחה כצפוי; 404 על שיוך לא קיים; הסרה אמיתית של אחד משני השיוכים של רחל הינמן → הצליחה; **ואז שוחזר** (שיוך מחדש עם אותו תחום בדיוק) כדי לא להשאיר שינוי קבוע בנתונים האמיתיים.

### ✨ תוספת לאחר השלמה : בדיקת תקינות אמיתית לת"ז ולטלפון

**הבקשה:** על ת"ז — "תפעיל את כל הבדיקות שהצעת" (פורמט + ספרת ביקורת). על טלפון — "מספר תווים הגיוני, מינימום 9".

**התיקון** (`packages/shared-schemas/src/contacts/schema.ts`):
- **ת"ז**: `idNumberSchema` חדש — בודק (1) בדיוק 9 ספרות, **וגם** (2) ספרת הביקורת הסטנדרטית של ת"ז ישראלית (האלגוריתם הרשמי: כל ספרה מוכפלת ב-1 או ב-2 לסירוגין, תוצאה דו-ספרתית מתקפלת לספרה אחת, הסכום חייב להתחלק ב-10). כלומר מחרוזת של 9 ספרות אקראיות **לא** מספיקה — היא חייבת להיות ת"ז אמיתית מבחינה מתמטית. נבדק רק ביצירה (ת"ז לא ניתנת לעריכה, החלטת Story 1.6 הקיימת).
- **טלפון**: `phoneSchema` חדש — מינימום 9 תווים (לא בדיקת פורמט/קידומת, רק אורך סביר כמבוקש). משותף ליצירה (`required`) ולעריכה (`optional`, אבל אם נשלח — אותו מינימום).
- שתי הסכמות כתובות פעם אחת ומשותפות בין המקומות הרלוונטיים — אותו עיקרון כמו `domainIdsSchema`.

**⚠️ אימות:** build/typecheck/lint/test — 18/18 ירוק. אומת מול שרת עם 5 תרחישים: ת"ז לא בת 9 ספרות → נדחה; ת"ז בת 9 ספרות שלא עוברת ספרת ביקורת (למשל 123456789) → נדחה; ת"ז תקינה אמיתית (נוצרה בבדיקה עצמה, לא ניחוש) → התקבלה; טלפון קצר מ-9 תווים → נדחה; טלפון בן 9 תווים בדיוק → התקבל. רשומות הבדיקה נוקו.

### 🐛 תיקון לאחר השלמה: שיוך לגוף מושבת הציג ID גולמי במקום שם

**הבעיה:** `ContactEditDrawer.tsx` שלף גופים נתמכים עם `isActive: true` בלבד — שימושי עבור "שייך לגוף נוסף" (לא הגיוני לשייך לגוף מושבת), אבל זה אומר שאם איש קשר כבר משויך לגוף שהושבת **אחרי** שהשיוך נוצר, השם שלו כבר לא ניתן לאיתור ברשימה שנשלפה, וה-fallback הציג את ה-ID הגולמי (`cmuwgundp...`) — בדיוק מה שראית בתמונה.

**התיקון:**
- השליפה שונתה לכל הגופים (פעילים ולא פעילים), כמו שכבר נעשה ב-`ContactsList.tsx`. "שייך לגוף נוסף" ממשיך להציע רק גופים פעילים — הסינון הזה עבר לצד הלקוח על אותה רשימה, לא שאילתה נפרדת.
- כל בלוק "שיוך X" מציג עכשיו את **שם הגוף האמיתי**, ועם סיומת "**(גוף מושבת)**" כשהגוף לא פעיל — למשל "שיוך 2 — קרן אור (גוף מושבת)".

**⚠️ אימות:** build/typecheck/lint — ירוק. שחזרתי את התרחיש המדויק מול הנתונים האמיתיים: השבתתי את "קרן אור" (שרחל הינמן משויכת אליו), אימתתי שה-API שלא-מסונן עדיין מחזיר את השם + `isActive:false`, ושה-API המסונן (המשמש ל"שייך לגוף נוסף") לא כולל אותו — ואז החזרתי את "קרן אור" לפעיל. **מגבלה**: אין כלי browser automation — התצוגה הוויזואלית בפועל (הטקסט "(גוף מושבת)" על המסך) לא אומתה בעין, רק הנתונים שהיא מבוססת עליהם.

---

## כיסוי Epic 1

**FRs:** FR-4 (1.2, 1.3), FR-5 (1.4), FR-6 (1.5, 1.6), FR-7 (1.5 חלקי + 1.6 מלא — שיוך לגוף/גופים נתמכים; **עודכן לאחר השלמת ה-Epic** — שיוך לתחום הוא תת-קבוצה הנבחרת ברמת איש הקשר מתוך תחומי הגוף הנתמך שאליו שויך (לא כל התחומים אוטומטית, וגם לא בחירה חופשית מכל תחום — ר' הערת השינוי המשמעותי בתחתית Story 1.7/1.8), FR-8 (1.7), FR-9 (1.7), FR-10 (1.5), FR-11 (1.8).
**NFRs:** NFR-B חלקי (1.1 תשתית — מה/מתי כן, מי לא), NFR-D (1.1 + כל מסך).
**UX-DRs מכוסים:** UX-DR1, 2, 4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 22, 24.
**UX-DRs נדחים במפורש ל-Epic 2/3:** UX-DR3, 5, 10, 14, 17, 19, 20, 27 (תלויים בתור בקשות רישום או באכיפת הרשאות בפועל).
**⚠️ פערים ידועים (כפי שסוכם):** FR-1, FR-2, FR-3, NFR-E — לא באפיק זה, ואין login/הרשאות בכלל באפיק 1 (החלטת המוצר) — ולכן גם NFR-B (Audit Trail) מכוסה רק חלקית: פעולה+זמן מתועדים, "מי ביצע" לא.
