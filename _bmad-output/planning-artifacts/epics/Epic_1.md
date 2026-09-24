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
- [ ] הקמת מונורפו Turborepo + npm workspaces — `package.json` שורש עם `workspaces`, `turbo.json`, `packages/config` (tsconfig/eslint משותפים)
- [ ] `docker-compose.yml` להרצת PostgreSQL מקומי
- [ ] `.gitlab-ci.yml` — פייפליין בסיסי: build+lint+test לכל אחת משתי האפליקציות בנפרד
- [ ] הגדרת `tsc --noEmit` כסקריפט בכל package/אפליקציה
- [ ] אימות קצה-לקצה: `npm install && turbo run build` עובר בהצלחה

**DB:**
- [ ] `packages/db`: `prisma.config.ts`, `schema.prisma` ריק (עסקית), `PrismaPg` adapter (pg), `prisma migrate dev` ראשון
- [ ] מודל `AuditLog` + מיגרציה ב-`packages/db`

**שרת: פקודות ו-API:**
- [ ] שלד `apps/api` (NestJS): `main.ts` (`NestFactory.create(AppModule)`, `app.enableCors(...)` מוגבל למקור של `apps/web` — AD-12), `app.module.ts` ריק בשלב זה
- [ ] `common/interceptors/response.interceptor.ts` + `common/filters/all-exceptions.filter.ts` — מעטפת תגובה אחידה (`{data}`/`{error}`), נרשמים גלובלית ב-`main.ts` (`expertise-api-rest`)
- [ ] Prisma Client Extension לתיעוד (`packages/db/src/client.ts`, `audit-context.ts`) לפי `expertise-postgres-prisma`; `changedById` תמיד `null` באפיק זה; נצרך רק מתוך `apps/api`

**UI:**
- [ ] `packages/ui`: theme override של Mantine לפי טוקני `DESIGN.md` (צבעים, Heebo, radii) + `DirectionProvider`
- [ ] `apps/web`: שלד Next.js App Router; `app/layout.tsx` עם `dir="rtl"`, `lang="he"`, `mantineHtmlProps`, `MantineProvider`+`DirectionProvider`
- [ ] `apps/web/lib/api-client.ts` — שלד ראשוני של שכבת החיבור ל-`apps/api` (`expertise-react-nextjs`)
- [ ] `AppShell` ריק (Sidebar + אזור תוכן) — בלי שער אימות, מוצג ישירות

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
- [ ] מודל `Domain` (id, name, isActive, timestamps) + מיגרציה ב-`packages/db`
- [ ] סקריפט seed חד-פעמי לתחומים לדוגמה (`packages/db/prisma/seed.ts` או `scripts/seed-domains.ts`), עם נתוני seed (למשל "חינוך", "בריאות")
- [ ] מודל `SupportedBody` (id, companyId ייחודי, name, isActive, timestamps) + מודל join מפורש `SupportedBodyOnDomain` (many-to-many מול `Domain`) + מיגרציה

**שרת: פקודות ו-API:**
- [ ] `apps/api/src/domains/` — `domains.module.ts` + `domains.controller.ts` (`GET /domains?isActive=true`, ממוין לפי שם) + `domains.service.ts`
- [ ] `packages/shared-schemas/domains/types.ts` — DTO לקריאה בלבד (אין `schema.ts` ליצירה/עריכה בסטורי זה)
- [ ] `packages/shared-schemas/supported-bodies/{types.ts,schema.ts}` — `createSupportedBodySchema` (`domainIds` כמערך, לפחות איבר אחד)
- [ ] `apps/api/src/supported-bodies/` — `supported-bodies.module.ts` + `supported-bodies.controller.ts` (`POST /supported-bodies` עם `JoiValidationPipe(createSupportedBodySchema)`) + `supported-bodies.service.ts` — יוצר `SupportedBody` + שורות `SupportedBodyOnDomain` יחד (`$transaction` כשיש יותר מתחום אחד)
- [ ] תרגום שגיאת `P2002` (הפרת ייחודיות ח"פ) ל-`ConflictException` (`409`) עם פרטי הרשומה הקיימת בתגובה, ב-`supported-bodies.service.ts` (ל-UX-DR18)

**UI:**
- [ ] קומפוננטת `DomainMultiSelect` משותפת ב-`packages/ui` (Mantine `MultiSelect`, נצרכת ע"י יותר מ-feature אחד — לפי מפת המבנה ב-`expertise-code-quality`), טוענת דרך `apps/web/lib/api-client.ts`, לשימוש חוזר ב-Story 1.3 (עריכת גוף נתמך)
- [ ] `apps/web/components/supported-bodies/SupportedBodyForm.tsx` — RHF + `joiResolver`, כולל `DomainMultiSelect` (מחובר דרך `Controller`)
- [ ] `useCreateSupportedBodyMutation` (RTK Query, `baseQuery` מול `apps/api`) ב-`apps/web/lib/api/supportedBodiesApi.ts`
- [ ] חיבור טופס "גוף נתמך חדש" למסך/Drawer — שמירה עובדת ויוצרת את הרשומה בפועל
- [ ] כפתור "שמירה" פעיל ולחיץ ברגע ששדות החובה (שם, ח"פ, תחום אחד לפחות) תקינים; מושבת **זמנית** רק כל עוד יש שדה חובה ריק/לא תקין (ולידציה בזמן אמת, לא רק בלחיצה) — UX-DR12
- [ ] טיפול במקרה קצה: רשימת תחומים ריקה — שדה ה-`MultiSelect` מציג רשימה ריקה בלי שגיאה

---

## Story 1.3: עריכה והשבתה של רשומת גוף נתמך

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
**אז** הרשומה מסומנת `status: INACTIVE` — **לא נמחקת**, ואנשי הקשר המשויכים אליה נשארים ללא שינוי (FR-4 תוצאה נבדקת)

**בהינתן** משתמש מנסה לשנות ח"פ לערך ששייך כבר לגוף אחר
**כאשר** הוא שומר
**אז** אותה שגיאת ייחודיות כמו ב-Story 1.2

**Tasks / Subtasks:**

**שרת: פקודות ו-API:**
- [ ] `apps/api/src/supported-bodies/supported-bodies.controller.ts` — מתווסף `PATCH /supported-bodies/:id` עם `JoiValidationPipe(updateSupportedBodySchema)` (כולל `domainIds` מעודכן)
- [ ] `supported-bodies.service.ts` — `updateSupportedBody` — מסנכרנת את שורות `SupportedBodyOnDomain` (הוספה/הסרה) מול `domainIds` החדש / `deactivateSupportedBody` (משתמשת ב-`status: 'INACTIVE'`, לא מחיקה — per `expertise-postgres-prisma`)

**UI:**
- [ ] `apps/web/components/supported-bodies/SupportedBodyEditDrawer.tsx` — לחיצה על שורה פותחת Drawer (UX-DR11), כולל `DomainMultiSelect` מ-Story 1.2 טעון עם התחומים הנוכחיים
- [ ] כפתור "השבת" + Modal אישור, מחובר לאותו `PATCH` endpoint
- [ ] `useUpdateSupportedBodyMutation` + invalidation תגיות RTK Query כך שרשימת הגופים (Story 1.4) מתעדכנת

---

## Story 1.4: חיפוש וסינון גופים נתמכים

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
- [ ] `apps/api/src/supported-bodies/supported-bodies.controller.ts` — מתווסף `GET /supported-bodies?search=&domainId=&status=&companyId=` + `JoiValidationPipe` על ה-query; `domainId` מסנן דרך `domains: { some: { domainId } }`
- [ ] שאילתת רשימה ב-`supported-bodies.service.ts` — `select` ממוקד (לא שליפת רשומה מלאה), פילטרים דרך שדות מאונדקסים

**UI:**
- [ ] `SupportedBodiesList.tsx` (Server Component, שליפה ראשונית דרך `apps/web/lib/api-client.ts`) + client filter toolbar (שדה חיפוש debounced ~300ms — UX-DR22)
- [ ] קומפוננטת Pagination (לא גלילה אינסופית — UX-DR24)
- [ ] מצב `Skeleton` לטעינה ראשונית (UX-DR15) ו-Empty State לתוצאה ריקה (UX-DR6)
- [ ] `useListSupportedBodiesQuery` (RTK Query, מול `apps/api`) לסינון בצד הלקוח

---

## Story 1.5: יצירת רשומת איש קשר

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
- [ ] מודל `Contact` (fullName, role, emails\[\], phone, notes, emailOptIn, smsOptIn, status, timestamps — **ללא** שדה תחום ישיר) + מודל `ContactOnSupportedBody` + מיגרציה

**שרת: פקודות ו-API:**
- [ ] `packages/shared-schemas/contacts/{types.ts,schema.ts}` — `createContactSchema` (`emails` כמערך, לפחות איבר אחד; `supportedBodyId` חובה)
- [ ] `apps/api/src/contacts/` — `contacts.module.ts` + `contacts.controller.ts` (`POST /contacts` עם `JoiValidationPipe(createContactSchema)`) + `contacts.service.ts` — `createContact` (יוצרת `Contact` + `ContactOnSupportedBody` יחד)

**UI:**
- [ ] קומפוננטת `SupportedBodySelect` משותפת ב-`packages/ui` (Select/Combobox עם חיפוש, טוענת דרך `apps/web/lib/api-client.ts` מ-`GET /supported-bodies`), לשימוש חוזר ב-Story 1.6 (שיוך לגוף נוסף)
- [ ] `apps/web/components/contacts/ContactForm.tsx` — RHF, שדה `SupportedBodySelect` (חובה), שדה-מערך דינמי לכתובות דוא"ל ("הוסף כתובת נוספת")
- [ ] טרום-מילוי גוף נתמך כשהטופס נפתח ממסך גוף נתמך ספציפי (השדה נשאר ניתן לשינוי)
- [ ] `useCreateContactMutation` (RTK Query, מול `apps/api`) + invalidation

---

## Story 1.6: עריכת איש קשר ושיוך לגופים נתמכים נוספים

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
- [ ] `apps/api/src/contacts/contacts.controller.ts` — מתווסף `PATCH /contacts/:id` עם `JoiValidationPipe(updateContactSchema)`
- [ ] Endpoint לשיוך גוף נתמך נוסף — `POST /contacts/:id/supported-bodies` עם `{ supportedBodyId }` (יחס Contact↔SupportedBody הוא many-to-many — ר' decision rule ב-`expertise-api-rest`)
- [ ] `contacts.service.ts` — `updateContact` + `addSupportedBodyToContact`

**UI:**
- [ ] `apps/web/components/contacts/ContactEditDrawer.tsx` — נפתח משמאל (כיוון "תוכן", UX-DR7), לחיצה על שורה פותחת אותו (UX-DR11)
- [ ] רכיב "שייך לגוף נתמך נוסף" בתוך ה-Drawer, משתמש ב-`SupportedBodySelect` (Story 1.5)
- [ ] טיפול בכשל שמירה: `Notification` (toast) עם שמירת נתוני הטופס (UX-DR16)
- [ ] `useUpdateContactMutation` + `useAddSupportedBodyMutation` (RTK Query, מול `apps/api`)

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
- [ ] אימות ששדות `externalRequestSource`/`externalRequestDate` (שהוגדרו כבר במודל `Contact` ב-Story 1.5) זמינים ל-update — אין שינוי סכמה נוסף נדרש

**שרת: פקודות ו-API:**
- [ ] `apps/api/src/contacts/contacts.controller.ts` — מתווסף `POST /contacts/:id/deactivate` (action endpoint) עם `{ source, date }` חובה יחד (Joi: שניהם נדרשים ביחד, לא שדות אופציונליים נפרדים)
- [ ] `contacts.service.ts` — `deactivateContact(contactId, source, date)` — מעדכנת `status: 'INACTIVE'`, `deactivatedAt`, `externalRequestSource`, `externalRequestDate`

**UI:**
- [ ] `apps/web/components/contacts/MarkInactiveModal.tsx` — Mantine `Modal`, `Select` למקור + בורר תאריך, כפתור אישור מושבת עד ששניהם תקינים (UX-DR13)
- [ ] חיבור כפתור "סמן כלא פעיל" בתוך `ContactEditDrawer` (Story 1.6) לפתיחת ה-Modal
- [ ] `useDeactivateContactMutation` (RTK Query, מול `apps/api`)

---

## Story 1.8: חיפוש וסינון אנשי קשר

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
- [ ] `apps/api/src/contacts/contacts.controller.ts` — מתווסף `GET /contacts?search=&supportedBodyId=&domainId=&status=&updatedYear=` + `JoiValidationPipe` על ה-query; `domainId` מסנן דרך `supportedBodies: { some: { supportedBody: { domains: { some: { domainId } } } } }`
- [ ] ברירת מחדל ב-`contacts.service.ts`: `status: 'ACTIVE'` אלא אם `includeInactive=true` (עקרון "ברירת מחדל פעילים בלבד" מ-`expertise-postgres-prisma`)

**UI:**
- [ ] `ContactsList.tsx` (Server Component, שליפה ראשונית דרך `apps/web/lib/api-client.ts`) + client filter toolbar (חיפוש debounced, checkbox "כלול לא פעילים", פילטרי גוף/תחום/שנה)
- [ ] Pagination + `Skeleton` לטעינה ראשונית + Empty State עם CTA "הוספת איש קשר ראשון" כשהרשימה ריקה
- [ ] `useListContactsQuery` (RTK Query, מול `apps/api`) לסינון בצד הלקוח

---

## כיסוי Epic 1

**FRs:** FR-4 (1.2, 1.3), FR-5 (1.4), FR-6 (1.5, 1.6), FR-7 (1.5 חלקי + 1.6 מלא — שיוך לגוף/גופים נתמכים; שיוך לתחום מתבצע ברמת הגוף הנתמך [Story 1.2], לא ברמת איש הקשר עצמו — החלטת מוצר), FR-8 (1.7), FR-9 (1.7), FR-10 (1.5), FR-11 (1.8).
**NFRs:** NFR-B חלקי (1.1 תשתית — מה/מתי כן, מי לא), NFR-D (1.1 + כל מסך).
**UX-DRs מכוסים:** UX-DR1, 2, 4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 22, 24.
**UX-DRs נדחים במפורש ל-Epic 2/3:** UX-DR3, 5, 10, 14, 17, 19, 20, 27 (תלויים בתור בקשות רישום או באכיפת הרשאות בפועל).
**⚠️ פערים ידועים (כפי שסוכם):** FR-1, FR-2, FR-3, NFR-E — לא באפיק זה, ואין login/הרשאות בכלל באפיק 1 (החלטת המוצר) — ולכן גם NFR-B (Audit Trail) מכוסה רק חלקית: פעולה+זמן מתועדים, "מי ביצע" לא.
