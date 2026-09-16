---
name: ניהול אנשי קשר לגופים נתמכים
description: כלי ניהול פנימי (רכזים/מנהל-על) עם משטח פומבי אחד (טופס רישום) הבנוי מעל Mantine על Next.js. מסמך זה מפרט את שכבת המיתוג/העיצוב מעל ברירות המחדל של Mantine — עברית ו-RTL מלאים.
status: final
created: 2026-09-15
updated: 2026-09-15
colors:
  # שכבת מיתוג מעל ברירות המחדל של Mantine. כל טוקן שלא מוגדר כאן יורש מ-Mantine
  # (gray scale, white/black, background, border).
  # [ASSUMPTION] אין חומרי מיתוג ארגוניים קיימים — פלטה נבחרה מאפס, ניתנת להחלפה בקלות.
  primary: '#1C5D8C'            # כחול "אמון מוסדי" — כפתורים ראשיים, ניווט פעיל, קישורים
  primary-foreground: '#FFFFFF'
  primary-dark: '#4A8FC2'
  primary-foreground-dark: '#0A1620'
  accent: '#B8791A'              # ענבר עמום — מיועד אך ורק ל"דורש תשומת לב" (בקשות ממתינות)
  accent-foreground: '#1A1208'   # טקסט כהה, לא לבן — לבן על ענבר זה נותן ~3.6:1 (נכשל ב-AA); כהה נותן ~5.1:1
  accent-dark: '#D99A3E'
  accent-foreground-dark: '#1A1208'
  status-active: '#2F7D46'       # פעיל / אושר
  status-active-foreground: '#FFFFFF'
  status-inactive: '#6B7280'     # לא פעיל (אפור, לא אדום — זו לא שגיאה, זו עובדה)
  status-inactive-foreground: '#FFFFFF'
  status-pending: '#B8791A'      # ממתין לאישור — זהה ל-accent בכוונה
  status-pending-foreground: '#1A1208'  # ר' הערת ניגודיות ב-accent-foreground לעיל — אותו רקע, אותה בעיה
  status-rejected: '#B3261E'     # נדחה — האדום היחיד בפלטה, שמור לשלילה מפורשת בלבד
  status-rejected-foreground: '#FFFFFF'
typography:
  # Mantine בררת מחדל (system font stack) אינה מותאמת היטב לעברית ברוחב-אות ובקריאוּת.
  # [ASSUMPTION] Heebo — פונט Google Fonts חופשי, נתמך עברית מלאה, נפוץ באתרים ממשלתיים/ציבוריים בישראל.
  body:
    fontFamily: 'Heebo, system-ui, sans-serif'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  label:
    fontFamily: 'Heebo, system-ui, sans-serif'
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.4'
  heading-lg:
    fontFamily: 'Heebo, system-ui, sans-serif'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.25'
  heading-md:
    fontFamily: 'Heebo, system-ui, sans-serif'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
  caption:
    fontFamily: 'Heebo, system-ui, sans-serif'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  # Mantine ברירת מחדל (sm=4, md=8, lg=16) — נשמר כמעט כמו שהוא, מעט "רך" יותר לתחושת אנוש
  sm: 4px
  md: 8px
  lg: 12px
  pill: 999px
spacing:
  # סולם המרווחים של Mantine עצמו (xs..xl) — ללא שינוי
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  status-badge:
    radius: '{rounded.pill}'
    variants:
      active: { background: '{colors.status-active}', foreground: '{colors.status-active-foreground}' }
      inactive: { background: '{colors.status-inactive}', foreground: '{colors.status-inactive-foreground}' }
      pending: { background: '{colors.status-pending}', foreground: '{colors.status-pending-foreground}' }
      rejected: { background: '{colors.status-rejected}', foreground: '{colors.status-rejected-foreground}' }
  attention-card:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
---

## Brand & Style

זהו כלי עבודה פנימי לרכזים ותקציבאים, עם משטח פומבי אחד (טופס רישום). זו לא מוצר צרכני עם זהות ויזואלית תובענית — המטרה היא **אמון, בהירות, ומהירות סריקה**: רכז שפותח את המערכת 15 פעמים ביום צריך למצוא מידע מיד, לא "לחוות מותג". מבקש רישום אנונימי שמגיע פעם אחת דרך קישור צריך להרגיש שהטופס רציני ומכובד — לא "טופס גוגל" גנרי, אבל גם לא מעוצב-יתר.

המוצר יורש את רוב ברירות המחדל של **Mantine** (הספרייה שנבחרה ל-UI, ר' `docs/tech-stack-decisions.md`) כמעט כמו שהן. שכבת המיתוג כאן היא דלתא קטנה ומכוונת: צבע ראשי אחד (אמון), צבע הדגשה אחד (accent — "דורש תשומת לב", לא קישוט), ואוצר מילים סמנטי אחד לסטטוסים שחוזר בכל המערכת (פעיל/לא פעיל/ממתין/נדחה).

**עברית ו-RTL הם לא "תוספת" — הם קו הבסיס.** כל מסך, כל רכיב, כל דוגמת קוד עתידית — נבדקים תחילה ב-RTL, לא מותאמים אליו בדיעבד.

## Colors

- **כחול ראשי (`#1C5D8C` בהיר / `#4A8FC2` כהה)** — כפתורים ראשיים, פריט ניווט פעיל, קישורים. מחליף את ה-`primary` של Mantine.
- **ענבר-הדגשה (`#B8791A`)** — שמור **אך ורק** למשמעות "יש כאן משהו שדורש את תשומת ליבך" (מספר בקשות רישום ממתינות בתפריט, כרטיס "בקשות ממתינות" בדשבורד). לעולם לא לקישוט, לעולם לא לניווט רגיל.
- **פלטת סטטוס סמנטית** — ארבעה צבעים קבועים שחוזרים בכל המערכת (badges, אינדיקטורים): `active` (ירוק), `inactive` (אפור — כי "לא פעיל" הוא עובדה נייטרלית, לא כישלון), `pending` (ענבר), `rejected` (אדום — הצבע האדום היחיד בפלטה כולה, שמור לדחייה מפורשת בלבד כדי לשמור על משמעות חדה).
- **כל שאר הטוקנים** (רקע, טקסט, גבולות, אפור) יורשים מברירות המחדל של Mantine.

הימנעות: יותר משני צבעי מיתוג, שימוש בירוק/אדום למשהו שאינו סטטוס, גרדיאנטים.

## Typography

`[ASSUMPTION]` **Heebo** בכל המערכת — פונט חופשי עם תמיכת עברית מלאה ואיכות גבוהה גם בגדלים קטנים (חשוב לטבלאות אנשי קשר עם הרבה שורות). Mantine's system-font stack ברירת המחדל לא מותאם היטב לעברית. אם לארגון יש פונט מיתוגי קיים — קל להחליף כאן.

היררכיה: `heading-lg` לכותרות מסך (למשל "אנשי קשר"), `heading-md` לכותרות משנה/כרטיסים, `body` לתוכן וטבלאות, `label` לתוויות שדה (מודגש קלות כדי לבלוט מעל הערך), `caption` לטקסט משני (תאריכי עדכון, הערות שוליים).

## Layout & Spacing

סולם המרווחים של Mantine (`xs..xl`) ללא שינוי. רוחב תוכן מקסימלי לטפסים: `600px` (טופס איש קשר, טופס רישום פומבי) — טופס צר וממוקד קריא יותר מטופס רחב. טבלאות (רשימת אנשי קשר/גופים נתמכים) משתמשות ברוחב מלא של אזור התוכן, ללא הגבלת רוחב.

פריסה: Sidebar ניווט קבוע בצד ימין (RTL) במסך רחב (`md+`), הופך ל-Drawer נשלף מעל ב-`sm`. הטופס הפומבי **אינו** משתמש ב-Sidebar כלל — הוא עמוד עצמאי, ממוקד, בלי ניווט מסיח.

**חשוב — שני סוגי Drawer, שני כיוונים שונים (לא אותו כלל):**
- **Drawer ניווט** (הגרסה המצומצמת של ה-Sidebar ב-`sm`) — נפתח **מצד ימין**, מאותו הצד שבו יושב ה-Sidebar הקבוע במסך רחב. המשתמש מצפה שהניווט "יחליק" מהמקום שבו הוא רגיל לחיות; פתיחה מהצד השני תבלבל.
- **Drawer תוכן** (למשל עריכת איש קשר, ר' Component Patterns ב-EXPERIENCE.md) — נפתח **מצד שמאל**. זהו "חלון עבודה זמני" שנפתח מעל הרשימה, לא הרחבה של הניווט הקבוע, ולכן אין ציפייה שיגיע מכיוון הניווט.
זו לא סתירה — זו הבחנה בין שני תפקידים שונים של אותו רכיב UI (Mantine `Drawer`), וצריך לציין ב-props/config איזה משני הכיוונים משתמשים בכל מופע.

## Elevation & Depth

ברירת המחדל של Mantine (צל עדין ב-hover/פוקוס, ללא היררכיית "עומק" ויזואלית מוגזמת). כרטיס `attention-card` (בקשות ממתינות) מקבל הצללה מעט בולטת יותר כדי לבלוט כ"קריאה לפעולה".

## Shapes

`rounded/sm` (4px) לשדות קלט, `rounded/md` (8px) לכפתורים וכרטיסים, `rounded/lg` (12px) למודלים, `rounded/pill` לתגיות סטטוס (status badges) בלבד — כדי שתגית סטטוס תהיה מזוהה מיידית ושונה חזותית משאר הרכיבים.

## Components

רוב הרכיבים משתמשים ב-Mantine כמו שהם, ללא שינוי: `Button` (variants: secondary/outline/subtle), `TextInput`, `Select`, `Table`, `Modal`, `Drawer`, `Notification` (toast), `Tabs`, `Breadcrumbs`, `Pagination`.

רכיבי שכבת-מיתוג:

- **Button (primary)** — מילוי `{colors.primary}`, טקסט `{colors.primary-foreground}`, `{rounded.md}`. שאר הוריאנטים יורשים מ-Mantine כמו שהם.
- **Status Badge** — רכיב מותאם, לא ברירת מחדל של Mantine Badge. ארבעה variants קבועים (`active`/`inactive`/`pending`/`rejected`), `{rounded.pill}`. **חובה בכל וריאנט, בלי יוצא מן הכלל: צבע + אייקון בעל צורה ייחודית לוריאנט + טקסט המילה במפורש** (״פעיל״/״לא פעיל״/״ממתין״/״נדחה״). זו לא המלצה אלא דרישת המפרט: לא מספיק "צבע + אייקון" אם האייקון הוא אותה נקודה/עיגול צבוע בארבעת הוריאנטים — זה עדיין "צבע בלבד" מבחינת מי שלא מבחין בצבעים. צורות מומלצות: `active`=✓ בעיגול, `inactive`=עיגול חלול/מקף, `pending`=שעון, `rejected`=✕ בעיגול.
- **Attention Card** — כרטיס "בקשות ממתינות לאישור" בדשבורד/תפריט. `{colors.accent}` מילוי, טקסט `{colors.accent-foreground}` (כהה — ר' הערת ניגודיות למעלה), מופיע לכל היותר פעם אחת למסך.
- **Dropzone** — עוטף את Mantine `Dropzone` (חבילת `@mantine/dropzone`) ללא שינוי ויזואלי; משמש להעלאת מסמכים בטופס הרישום הפומבי (ר' Component Patterns ב-EXPERIENCE.md).
- **Skeleton (מצב טעינה)** — יורש במלואו מ-Mantine `Skeleton`, ללא שינוי ויזואלי. משמש לשורות טעינה בטבלאות (ר' State Patterns ב-EXPERIENCE.md).
- **Card (כללי)** — יורש במלואו מ-Mantine `Card` (מסגרת `{colors border}`, `{rounded.md}`, צל עדין מ-Elevation & Depth למעלה). משמש לכרטיסי בקשת רישום ולכרטיס פרטי גוף נתמך.
- **Empty State** — מבנה מותאם (לא רכיב Mantine בודד): אייקון עדין (גודל `heading-lg` בערך) בצבע `inactive`, כותרת `heading-md`, טקסט גוף `body`, כפתור פעולה ראשי אחד (`Button primary`). אין רכיב Mantine ייעודי לכך — מורכב מ-Stack פשוט.

## Do's and Don'ts

| כן | לא |
|---|---|
| להשתמש ב-`accent` (ענבר) רק ל"דורש תשומת לב" | להשתמש ב-accent לקישוט או לניווט רגיל |
| תגית סטטוס = צבע + אייקון **בצורה ייחודית** + טקסט | תגית סטטוס עם צבע בלבד, או עם אייקון זהה-צורה בכל הוריאנטים (בעיית נגישות) |
| טקסט כהה (`#1A1208`) על רקע `accent`/`pending` | טקסט לבן על `accent`/`pending` — נכשל ב-WCAG AA (כ-3.6:1 בלבד) |
| טפסים ברוחב מוגבל (600px), קריאים | טופס רחב על כל המסך שגורם לעין "לנדוד" |
| RTL כברירת מחדל בכל בדיקה | לבדוק קודם ב-LTR ו"לתקן" ל-RTL בסוף |
| אדום (`status-rejected`) רק לדחייה מפורשת | אדום לכל שגיאה/אזהרה כללית |
