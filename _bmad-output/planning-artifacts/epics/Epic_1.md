⬅ חזרה למסמך האפיקים הראשי (סקירה, מלאי דרישות, מפת כיסוי, רשימת כל האפיקים) (../epics.md)

# **Epic 1: ניהול גופים נתמכים ואנשי קשר (ליבת המערכת)**

**גישה פתוחה, ללא הרשאות (לפי החלטת המוצר):** כל מי שנכנס לאפליקציה — בלי login, בלי הבחנה בין רכז למנהל-על — יכול לראות ולערוך את כל הגופים הנתמכים ואנשי הקשר, ליצור, לערוך, להשבית, לחפש ולסנן, כולל שימור היסטוריה מלאה ותיעוד בקשות עדכון/הסרה חיצוניות. שיוך לתחום נעשה מתוך רשימת תחומים **קיימת** ב-DB בלבד (ללא מסך ניהול תחומים/הקצאת רכזים — נדחה ל-Epic 3, ר' אזהרת NFR-E/NFR-B ב-epics.md).

\_\[DRAFT — טרם אושר סופית\]\_

## **Story 1.1: תשתית הפרויקט, מעטפת אפליקציה, ו-Audit Trail אוטומטי (ללא הרשאות)**

בתור מי שנכנס למערכת (ללא login),

אני רוצה לראות מעטפת אפליקציה ריקה בעברית ו-RTL, כשכל פעולה עתידית מתועדת אוטומטית (פעולה/זמן/מה השתנה),

כדי שיהיה בסיס טכני יציב לכל המסכים הבאים, גם בלי מנגנון הרשאות בשלב הזה.

**Acceptance Criteria:**

**בהינתן** המונורפו (apps/internal, packages/db, packages/shared-schemas, packages/ui, packages/config) מוקם לפי ה-Structural Seed הארכיטקטוני

**כאשר** מריצים npm install ו-turbo run build מהשורש

**אז** כל ה-packages נבנים בהצלחה, ו-tsc \--noEmit עובר בכל package

**בהינתן** PostgreSQL רץ מקומית דרך Docker, ו-schema.prisma (ריק מבחינה עסקית בשלב זה) קיים ב-packages/db

**כאשר** מריצים prisma migrate dev

**אז** המיגרציה רצה בהצלחה מול מסד הנתונים המקומי

**בהינתן** האפליקציה עולה

**כאשר** כל אחד ניגש לכתובת האפליקציה (apps/internal) — בלי login, בלי מסך הזדהות

**אז** הוא רואה ישירות מעטפת אפליקציה (Sidebar \+ אזור תוכן), בעברית מלאה ו-RTL (dir="rtl", פונט Heebo, DirectionProvider), עם טוקני העיצוב הבסיסיים (UX-DR1, UX-DR4, UX-DR8, UX-DR9) מוטמעים ב-packages/ui

**בהינתן** מודל AuditLog קיים ב-packages/db, וה-Prisma Client Extension לתיעוד מיושם על ה-client היחיד שמיוצא מ-packages/db (expertise-postgres-prisma)

**כאשר** כל מוטציה עתידית (create/update/delete) תתבצע על מודל עסקי כלשהו (מ-Story 1.3 ואילך)

**אז** תיווצר אוטומטית רשומת Audit עם חותמת זמן ומה השתנה — בלי קוד ייעודי בכל endpoint

**⚠️ הבהרה (נגזר מהחלטת "בלי הרשאות"):** בלי login אין "משתמש מחובר" — שדה changedById ב-AuditLog יישאר ריק (null) בכל רשומות האפיק הזה. NFR-B (Audit Trail) נענה חלקית: **מה השתנה ומתי** כן מתועד; **מי ביצע** לא, עד שיהיה מנגנון זיהוי כלשהו (Epic 3). זהו המשך ישיר לפער שכבר סימנו לגבי NFR-E — שני הפערים ייסגרו יחד כשההרשאות ייבנו.

**Tasks / Subtasks:**

* \[ \] הקמת מונורפו Turborepo \+ npm workspaces — package.json שורש עם workspaces, turbo.json, packages/config (tsconfig/eslint משותפים)  
* \[ \] docker-compose.yml להרצת PostgreSQL מקומי  
* \[ \] packages/db: prisma.config.ts, schema.prisma ריק (עסקית), PrismaPg adapter, prisma migrate dev ראשון  
* \[ \] packages/ui: theme override של Mantine לפי טוקני DESIGN.md (צבעים, Heebo, radii) \+ DirectionProvider  
* \[ \] apps/internal: שלד Next.js App Router; app/layout.tsx עם dir="rtl", lang="he", mantineHtmlProps, MantineProvider\+DirectionProvider  
* \[ \] AppShell ריק (Sidebar \+ אזור תוכן) — בלי שער אימות, מוצג ישירות  
* \[ \] מודל AuditLog \+ מיגרציה ב-packages/db  
* \[ \] Prisma Client Extension לתיעוד (packages/db/src/client.ts, audit-context.ts) לפי expertise-postgres-prisma; changedById תמיד null באפיק זה  
* \[ \] הגדרת tsc \--noEmit כסקריפט בכל package  
* \[ \] אימות קצה-לקצה: npm install && turbo run build עובר בהצלחה

## **Story 1.2: שליפת רשימת תחומים קיימת (לצורך שיוך בלבד)**

בתור מי שנכנס למערכת,

אני רוצה לבחור תחום מתוך רשימה קיימת כשאני יוצר/עורך גוף נתמך או איש קשר,

כדי שאוכל לשייך רשומה לתחום הנכון, גם בלי מסך ניהול תחומים.

**Acceptance Criteria:**

**בהינתן** מודל Domain (id, name, isActive) קיים ב-packages/db (סכמה בלבד — ללא מסך ניהול, כפי שהוגדר)

**כאשר** מריצים seed חד-פעמי עם תחומים לדוגמה (למשל "חינוך", "בריאות")

**אז** הרשומות קיימות במסד הנתונים וזמינות לקריאה

**בהינתן** משתמש פותח טופס יצירת/עריכת גוף נתמך או איש קשר

**כאשר** הטופס נטען

**אז** שדה "תחום" מציג Select הנשלף מ-GET /api/domains?isActive=true, ממוין לפי שם

**בהינתן** אין תחומים פעילים במסד הנתונים (מקרה קצה)

**כאשר** המשתמש פותח את הטופס

**אז** שדה ה"תחום" מציג רשימה ריקה ללא שגיאה — לא חוסם שמירה של שאר שדות הטופס

**⚠️ הבהרה:** אין בסטורי זה שום מסך יצירה/עריכה/השבתה של תחומים, ואין הקצאת רכזים. נשאר ל-Epic 3\.

**Tasks / Subtasks:**

* \[ \] מודל Domain (id, name, isActive, timestamps) \+ מיגרציה ב-packages/db  
* \[ \] סקריפט seed חד-פעמי לתחומים לדוגמה (packages/db/prisma/seed.ts או scripts/seed-domains.ts)  
* \[ \] GET /api/domains?isActive=true — Route Handler, ממוין לפי שם, דרך dataResponse  
* \[ \] packages/shared-schemas/domains/types.ts — DTO לקריאה בלבד (אין schema.ts ליצירה/עריכה בסטורי זה)  
* \[ \] קומפוננטת DomainSelect משותפת ב-packages/ui (נצרכת ע"י יותר מ-feature אחד — לפי מפת המבנה ב-expertise-code-quality), טוענת מה-endpoint, לשימוש חוזר ב-Story 1.3 ו-1.6  
* \[ \] טיפול במקרה קצה: רשימת תחומים ריקה — לא חוסם שמירה של שאר הטופס

## **Story 1.3: יצירת רשומת גוף נתמך**

בתור מי שנכנס למערכת,

אני רוצה ליצור רשומת גוף נתמך חדשה עם שם, ח"פ, תחום וסטטוס,

כדי שאוכל להתחיל לשייך אליה אנשי קשר.

**Acceptance Criteria:**

**בהינתן** משתמש בטופס "גוף נתמך חדש"

**כאשר** הוא ממלא שם, מספר ח"פ, בוחר תחום מהרשימה (Story 1.2), ולוחץ "שמירה"

**אז** נוצרת רשומת SupportedBody חדשה עם status: ACTIVE, ומוצגת ברשימת הגופים הנתמכים

**בהינתן** משתמש מזין מספר ח"פ שכבר קיים במערכת עבור גוף אחר

**כאשר** הוא מנסה לשמור

**אז** מוצגת שגיאת ולידציה מיידית — "גוף נתמך עם ח\\"פ זה כבר קיים במערכת" \+ קישור לרשומה הקיימת (UX-DR18) — והשמירה נחסמת גם ברמת ה-DB (@unique) אם הבדיקה בצד הלקוח פוספסה

**בהינתן** שדות חובה (שם, ח"פ) ריקים

**כאשר** המשתמש מנסה לשמור

**אז** כפתור השמירה מושבת / מוצגת שגיאת ולידציה בזמן אמת, לפני קריאה לשרת

**וגם** הוולידציה רצה גם בצד השרת (Joi, עצמאית מהלקוח) לפני כתיבה למסד הנתונים

**Tasks / Subtasks:**

* \[ \] מודל SupportedBody (id, companyId ייחודי, name, domainId, isActive, timestamps) \+ מיגרציה  
* \[ \] packages/shared-schemas/supported-bodies/{types.ts,schema.ts} — createSupportedBodySchema  
* \[ \] POST /api/supported-bodies — Route Handler עם withBodyValidation, dataResponse/errorResponse  
* \[ \] תרגום שגיאת P2002 (הפרת ייחודיות ח"פ) ל-409 CONFLICT עם פרטי הרשומה הקיימת בתגובה (ל-UX-DR18)  
* \[ \] apps/internal/lib/features/supported-bodies/ — פונקציית שירות createSupportedBody  
* \[ \] apps/internal/components/supported-bodies/SupportedBodyForm.tsx — RHF \+ joiResolver, כולל DomainSelect מ-Story 1.2  
* \[ \] useCreateSupportedBodyMutation (RTK Query) ב-apps/internal/lib/api/supportedBodiesApi.ts  
* \[ \] חיבור טופס "גוף נתמך חדש" למסך/Drawer — שמירה עובדת ויוצרת את הרשומה בפועל  
* \[ \] כפתור "שמירה" פעיל ולחיץ ברגע ששדות החובה (שם, ח"פ) תקינים; מושבת **זמנית** רק כל עוד יש שדה חובה ריק/לא תקין (ולידציה בזמן אמת, לא רק בלחיצה) — UX-DR12

## **Story 1.4: עריכה והשבתה של רשומת גוף נתמך**

בתור מי שנכנס למערכת,

אני רוצה לערוך פרטי גוף נתמך קיים או להשבית אותו,

כדי שהמידע יישאר מעודכן גם כשגוף מפסיק להיות פעיל.

**Acceptance Criteria:**

**בהינתן** רשימת גופים נתמכים

**כאשר** המשתמש לוחץ בכל מקום בשורת הגוף

**אז** נפתח Drawer עריכה מהצד — לא תפריט "..." נסתר (UX-DR11)

**בהינתן** רשומת גוף נתמך קיימת פתוחה לעריכה

**כאשר** משתמש עורך שם/ח"פ/תחום ולוחץ "שמירה"

**אז** הרשומה מתעדכנת, וה-Audit Trail מתעד את מה שהשתנה

**בהינתן** רשומת גוף נתמך פעילה עם אנשי קשר משויכים

**כאשר** משתמש לוחץ "השבת" ומאשר

**אז** הרשומה מסומנת status: INACTIVE — **לא נמחקת**, ואנשי הקשר המשויכים אליה נשארים ללא שינוי (FR-4 תוצאה נבדקת)

**בהינתן** משתמש מנסה לשנות ח"פ לערך ששייך כבר לגוף אחר

**כאשר** הוא שומר

**אז** אותה שגיאת ייחודיות כמו ב-Story 1.3

**Tasks / Subtasks:**

* \[ \] PATCH /api/supported-bodies/\[id\] — Route Handler \+ updateSupportedBodySchema  
* \[ \] פונקציית שירות updateSupportedBody / deactivateSupportedBody (משתמשת ב-status: 'INACTIVE', לא מחיקה — per expertise-postgres-prisma)  
* \[ \] apps/internal/components/supported-bodies/SupportedBodyEditDrawer.tsx — לחיצה על שורה פותחת Drawer (UX-DR11)  
* \[ \] כפתור "השבת" \+ Modal אישור, מחובר לאותו PATCH endpoint  
* \[ \] useUpdateSupportedBodyMutation \+ invalidation תגיות RTK Query כך שרשימת הגופים (Story 1.5) מתעדכנת

## **Story 1.5: חיפוש וסינון גופים נתמכים**

בתור מי שנכנס למערכת,

אני רוצה לחפש ולסנן גופים נתמכים לפי שם, תחום, סטטוס ומספר ח"פ,

כדי שאמצא במהירות את הגוף שאני מחפש מתוך רשימה גדלה.

**Acceptance Criteria:**

**בהינתן** רשימת גופים נתמכים עם יותר מרשומה אחת

**כאשר** המשתמש מקליד בשדה החיפוש

**אז** הרשימה מסתננת לפי שם/ח"פ תואם, בחיפוש-תוך-הקלדה (debounced \~300ms), בלי כפתור "חפש" נפרד (UX-DR22)

**בהינתן** המשתמש בוחר פילטר תחום ו/או סטטוס

**כאשר** הפילטר מופעל

**אז** הרשימה מציגה רק רשומות תואמות, עם Pagination — לא גלילה אינסופית (UX-DR24)

**בהינתן** הרשימה בטעינה ראשונית

**כאשר** העמוד נטען

**אז** מוצג Skeleton בצורת שורות טבלה, לא spinner גנרי (UX-DR15)

**בהינתן** אין תוצאות תואמות לסינון

**כאשר** הרשימה ריקה

**אז** מוצג Empty State — אייקון \+ משפט הקשרי \+ פעולה ראשית אחת (UX-DR6)

**Tasks / Subtasks:**

* \[ \] GET /api/supported-bodies?search=\&domainId=\&status=\&companyId= — Route Handler \+ ולידציית query (Joi)  
* \[ \] שאילתת רשימה ב-apps/internal/lib/features/supported-bodies/ — select ממוקד (לא שליפת רשומה מלאה), פילטרים דרך שדות מאונדקסים  
* \[ \] SupportedBodiesList.tsx (Server Component, שליפה ראשונית) \+ client filter toolbar (שדה חיפוש debounced \~300ms — UX-DR22)  
* \[ \] קומפוננטת Pagination (לא גלילה אינסופית — UX-DR24)  
* \[ \] מצב Skeleton לטעינה ראשונית (UX-DR15) ו-Empty State לתוצאה ריקה (UX-DR6)  
* \[ \] useListSupportedBodiesQuery (RTK Query) לסינון בצד הלקוח

## **Story 1.6: יצירת רשומת איש קשר**

בתור מי שנכנס למערכת,

אני רוצה ליצור רשומת איש קשר חדשה ולשייך אותה לגוף נתמך ולתחום,

כדי שיהיה לי מקום מרכזי לפרטי איש הקשר הנכון.

**Acceptance Criteria:**

**בהינתן** משתמש פותח טופס "איש קשר חדש" מתוך מסך גוף נתמך (משויך אוטומטית) או ממסך אנשי הקשר הכללי

**כאשר** הוא ממלא שם מלא, תפקיד, טלפון, לפחות כתובת דוא"ל אחת, בוחר תחום (Story 1.2), מסמן העדפות ערוץ (דוא"ל/SMS, בוליאניים עצמאיים), ומוסיף הערות (אופציונלי)

**אז** נוצרת רשומת Contact חדשה עם status: ACTIVE, משויכת לגוף הנתמך שנבחר (FR-6, FR-7 חלקי)

**בהינתן** המשתמש מזין כתובת דוא"ל בפורמט לא תקין

**כאשר** הוא עוזב את השדה / מנסה לשמור

**אז** מוצגת שגיאת ולידציה מיידית ("כתובת הדוא\\"ל אינה בפורמט תקין") וכפתור השמירה מושבת עד לתיקון (UX-DR12); הבדיקה חוזרת גם בצד השרת

**בהינתן** המשתמש רוצה להוסיף יותר מכתובת דוא"ל אחת

**כאשר** הוא לוחץ "הוסף כתובת נוספת"

**אז** מתווסף שדה דוא"ל נוסף, וכל הכתובות נשמרות תחת אותה רשומת איש קשר (FR-10)

**בהינתן** שדות חובה (שם מלא, לפחות דוא"ל אחד) לא מולאו

**כאשר** המשתמש מנסה לשמור

**אז** כפתור השמירה מושבת עד שכל שדות החובה תקינים

**Tasks / Subtasks:**

* \[ \] מודל Contact (fullName, role, emails\\\[\\\], phone, notes, emailOptIn, smsOptIn, domainId, status, timestamps) \+ מודל ContactOnSupportedBody \+ מיגרציה  
* \[ \] packages/shared-schemas/contacts/{types.ts,schema.ts} — createContactSchema (emails כמערך, לפחות איבר אחד)  
* \[ \] POST /api/contacts — Route Handler  
* \[ \] apps/internal/lib/features/contacts/ — פונקציית שירות createContact (יוצרת Contact \+ ContactOnSupportedBody יחד; $transaction אם יש יותר משיוך אחד)  
* \[ \] apps/internal/components/contacts/ContactForm.tsx — RHF, שדה-מערך דינמי לכתובות דוא"ל ("הוסף כתובת נוספת"), DomainSelect מ-Story 1.2  
* \[ \] טרום-מילוי גוף נתמך כשהטופס נפתח ממסך גוף נתמך ספציפי  
* \[ \] useCreateContactMutation (RTK Query) \+ invalidation

## **Story 1.7: עריכת איש קשר ושיוך לגופים נתמכים נוספים**

בתור מי שנכנס למערכת,

אני רוצה לערוך פרטי איש קשר קיים ולשייך אותו ליותר מגוף נתמך אחד,

כדי שאיש קשר שמייצג כמה גופים יופיע נכון בכולם.

**Acceptance Criteria:**

**בהינתן** לחיצה על שורת איש קשר ברשימה

**כאשר** המשתמש לוחץ בכל מקום בשורה

**אז** נפתח Drawer עריכה מהצד (כיוון "תוכן" — נפתח משמאל, UX-DR7), לא תפריט נסתר (UX-DR11)

**בהינתן** רשומת איש קשר פתוחה לעריכה

**כאשר** המשתמש משנה שדות (תפקיד/טלפון/דוא"ל/תחום/הערות/העדפות ערוץ) ולוחץ "שמירה"

**אז** הרשומה מתעדכנת, וה-Audit Trail מתעד מה השתנה ברמת שדה (NFR-B)

**בהינתן** איש קשר משויך כרגע לגוף נתמך אחד

**כאשר** המשתמש בוחר "שייך לגוף נתמך נוסף" ובוחר גוף קיים

**אז** איש הקשר מופיע כעת ברשימת אנשי הקשר של שני הגופים הנתמכים (FR-7 תוצאה נבדקת)

**בהינתן** שמירה נכשלת (למשל שגיאת שרת)

**כאשר** המשתמש לוחץ "שמירה"

**אז** מוצג Notification (toast) עם שגיאה ספציפית; נתוני הטופס נשמרים במקום, ואפשר לנסות שוב מיד (UX-DR16)

**Tasks / Subtasks:**

* \[ \] PATCH /api/contacts/\[id\] — Route Handler \+ updateContactSchema  
* \[ \] Endpoint לשיוך גוף נתמך נוסף — POST /api/contacts/\[id\]/supported-bodies עם { supportedBodyId } (יחס Contact↔SupportedBody הוא many-to-many — ר' decision rule ב-expertise-api-rest)  
* \[ \] פונקציית שירות updateContact \+ addSupportedBodyToContact  
* \[ \] apps/internal/components/contacts/ContactEditDrawer.tsx — נפתח משמאל (כיוון "תוכן", UX-DR7), לחיצה על שורה פותחת אותו (UX-DR11)  
* \[ \] רכיב בחירת "שייך לגוף נתמך נוסף" בתוך ה-Drawer  
* \[ \] טיפול בכשל שמירה: Notification (toast) עם שמירת נתוני הטופס (UX-DR16)  
* \[ \] useUpdateContactMutation \+ useAddSupportedBodyMutation

## **Story 1.8: סימון איש קשר כלא פעיל עם תיעוד מקור ותאריך**

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

**אז** רשומת האיש קשר מתעדכנת ל-status: INACTIVE עם deactivatedAt, externalRequestSource, ו-externalRequestDate — **הרשומה לא נמחקת** (FR-8)

**בהינתן** איש קשר סומן כלא פעיל

**כאשר** המשתמש חוזר לרשימת אנשי הקשר של הגוף הנתמך (סינון ברירת מחדל: פעילים בלבד)

**אז** הרשומה הלא-פעילה לא מופיעה כברירת מחדל, אך מופיעה כשמסננים "כולל לא פעילים" (FR-8 תוצאה נבדקת, תלוי ב-Story 1.9)

**Tasks / Subtasks:**

* \[ \] אימות ששדות externalRequestSource/externalRequestDate (שהוגדרו כבר במודל Contact ב-Story 1.6) זמינים ל-update  
* \[ \] POST /api/contacts/\[id\]/deactivate — action endpoint עם { source, date } חובה יחד (Joi: שניהם נדרשים ביחד, לא שדות אופציונליים נפרדים)  
* \[ \] פונקציית שירות deactivateContact(contactId, source, date) — מעדכנת status: 'INACTIVE', deactivatedAt, externalRequestSource, externalRequestDate  
* \[ \] apps/internal/components/contacts/MarkInactiveModal.tsx — Mantine Modal, Select למקור \+ בורר תאריך, כפתור אישור מושבת עד ששניהם תקינים (UX-DR13)  
* \[ \] חיבור כפתור "סמן כלא פעיל" בתוך ContactEditDrawer (Story 1.7) לפתיחת ה-Modal  
* \[ \] useDeactivateContactMutation (RTK Query)

## **Story 1.9: חיפוש וסינון אנשי קשר**

בתור מי שנכנס למערכת,

אני רוצה לחפש ולסנן אנשי קשר לפי גוף נתמך, תחום, סטטוס, ושנת עדכון אחרונה,

כדי שאדע מיד מי איש הקשר הנכון בלי לחפש במיילים ישנים.

**Acceptance Criteria:**

**בהינתן** רשימת אנשי קשר עם יותר מרשומה אחת

**כאשר** המשתמש מקליד בשדה החיפוש (debounced \~300ms)

**אז** הרשימה מסתננת לפי שם תואם, ומציגה כברירת מחדל רק status: ACTIVE

**בהינתן** המשתמש מסמן "כלול לא פעילים"

**כאשר** הפילטר מופעל

**אז** גם רשומות INACTIVE מוצגות ברשימה (תלוי ב-Story 1.8)

**בהינתן** המשתמש בוחר פילטר גוף נתמך / תחום / שנת עדכון אחרונה

**כאשר** הפילטר מופעל

**אז** הרשימה מציגה רק רשומות תואמות, עם Pagination

**בהינתן** הרשימה ריקה (למשל גוף נתמך חדש בלי אנשי קשר)

**כאשר** הרשימה נטענת

**אז** מוצג Empty State עם פעולה ראשית "הוספת איש קשר ראשון" (UX-DR6)

**Tasks / Subtasks:**

* \[ \] GET /api/contacts?search=\&supportedBodyId=\&domainId=\&status=\&updatedYear= — Route Handler \+ ולידציית query  
* \[ \] ברירת מחדל בשירות: status: 'ACTIVE' אלא אם includeInactive=true (עקרון "ברירת מחדל פעילים בלבד" מ-expertise-postgres-prisma)  
* \[ \] ContactsList.tsx (Server Component, שליפה ראשונית) \+ client filter toolbar (חיפוש debounced, checkbox "כלול לא פעילים", פילטרי גוף/תחום/שנה)  
* \[ \] Pagination \+ Skeleton לטעינה ראשונית \+ Empty State עם CTA "הוספת איש קשר ראשון" כשהרשימה ריקה  
* \[ \] useListContactsQuery (RTK Query) לסינון בצד הלקוח

## **כיסוי Epic 1**

**FRs:** FR-4 (1.3, 1.4), FR-5 (1.5), FR-6 (1.6, 1.7), FR-7 (1.6 חלקי \+ 1.7 מלא), FR-8 (1.8), FR-9 (1.8), FR-10 (1.6), FR-11 (1.9).

**NFRs:** NFR-B חלקי (1.1 תשתית — מה/מתי כן, מי לא), NFR-D (1.1 \+ כל מסך).

**UX-DRs מכוסים:** UX-DR1, 2, 4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 22, 24\.

**UX-DRs נדחים במפורש ל-Epic 2/3:** UX-DR3, 5, 10, 14, 17, 19, 20, 27 (תלויים בתור בקשות רישום או באכיפת הרשאות בפועל).

**⚠️ פערים ידועים (כפי שסוכם):** FR-1, FR-2, FR-3, NFR-E — לא באפיק זה, ואין login/הרשאות בכלל באפיק 1 (החלטת המוצר) — ולכן גם NFR-B (Audit Trail) מכוסה רק חלקית: פעולה+זמן מתועדים, "מי ביצע" לא.