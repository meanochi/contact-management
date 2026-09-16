# מה זה "סקילי מומחיות" ולמה בנינו אותם

> מסמך זה בעברית, בשפה פשוטה, מסביר את חמשת קבצי ה-Skill החדשים שנוספו לפרויקט תחת `.claude/skills/expertise-*`. אלה **לא** סקילי BMAD (שמנהלים תהליך עבודה כמו כתיבת PRD) — אלה קבצי **ידע טכני** שנטענים אוטומטית כשעובדים על קוד בתחום מסוים.

## מה זה בכלל "Skill"?

Skill הוא קובץ הוראות (`SKILL.md`) שיושב בתיקיית `.claude/skills/<שם>/` בפרויקט. יש לו כותרת (`description`) שאומרת "מתי להשתמש בי". כשמישהו (אני, בסשן הנוכחי או בסשן עתידי לגמרי אחר) כותב קוד שקשור לתחום מסוים — למשל כותב קובץ `.ts`, או פותח קומפוננטת React — המערכת "רואה" שיש סקיל רלוונטי וטוענת אותו אוטומטית לתוך ההקשר, כדי שההוראות שבו יילקחו בחשבון.

**למה זה שונה מפשוט "לזכור" דברים?** כי שיחה עם Claude לא "נשארת בזיכרון" לצמיתות — כל סשן חדש הוא התחלה נקייה. קובץ Skill הוא הדרך לקבע ידע **בפרויקט עצמו** (נשמר ב-git, נגיש לכל מי שיעבוד על הקוד — כולל אתכן, וכולל Claude בסשנים עתידיים), כדי שלא נצטרך "לחקור מחדש" את אותם הדברים כל פעם.

## חמשת הסקילים שנוצרו, ולמה כל אחד

| סקיל | תחום | נטען אוטומטית כש... |
|---|---|---|
| `expertise-nodejs-typescript` | Node.js + TypeScript | כותבים קוד שרת/לוגיקה כללית, מגדירים workspace |
| `expertise-react-nextjs` | React + Next.js (App Router) | כותבים קומפוננטת React, route, layout |
| `expertise-postgres-prisma` | PostgreSQL + Prisma | כותבים/משנים סכימת מסד נתונים, migration, שאילתה |
| `expertise-testing` | Jest + React Testing Library | כותבים קובץ בדיקה (test) |
| `expertise-api-rest` | עיצוב API בסגנון REST | כותבים/בודקים route של API |

כל אחד מהם נבנה על ידי **מחקר אמיתי באינטרנט** (לא רק "מה ש-Claude כבר יודע") על המצב העדכני נכון ל-2026 של הטכנולוגיה הספציפית, ומותאם **לבחירות הטכנולוגיות המדויקות של הפרויקט הזה** (לא מדריך כללי — מדריך "בשבילנו").

## למה זה חשוב במיוחד — המחקר כבר מצא כמה דברים שדורשים שינוי החלטה

זו בדיוק הסיבה שביקשתן "לחקור על השפה, הספריות" — המחקר לא היה רק "אישוש" של מה שכבר החלטנו, הוא **מצא באמת דברים שצריך לדעת**:

1. **Prisma הסירו לגמרי (לא רק "ממליצים נגד") את ה-API הישן (`$use`) שתיארנו ביומן ההחלטות לצורך ה-Audit Trail האוטומטי.** הגרסה הנוכחית (Prisma 7) חייבת להשתמש ב-API חדש בשם Client Extensions (`$extends`). זה לא עניין של טעם — הקוד הישן פשוט לא יעבוד. עדכנו את זה בסקיל, וצריך לעדכן גם ביומן ההחלטות.
2. **הכלי ש"תכננו" להשתמש בו לתיעוד Swagger (`next-swagger-doc`) לא עודכן כבר יותר משנה**, בעוד שיש כלי מתחרה פעיל ומתוחזק (`next-openapi-gen`) שבנוי במיוחד בשביל Next.js App Router. שווה לשקול מעבר לפני שמתחילים לכתוב קוד.
3. **Mantine (ספריית ה-UI) עברו מ-Emotion ל-CSS Modules**, ומנגנון ה-RTL הנכון היום הוא קומפוננטה ייעודית בשם `DirectionProvider` — לא מה שהיה נהוג קודם.
4. **Next.js שינו את שם קובץ ה-Middleware** (מ-`middleware.ts` ל-`proxy.ts`) בגרסה האחרונה — משפיע ישירות על שכבת אכיפת ההרשאות המרכזית שתכננו.
5. **קצב הגרסאות של Node.js משתנה** החל מאוקטובר 2026 — כל גרסה תהיה LTS (נתמכת לטווח ארוך), לא כמו הפיצול הישן.

כל אחד מהממצאים האלה כבר מתועד בפירוט (עם קוד לדוגמה) בקובץ הסקיל הרלוונטי, ויעודכנו בהתאם גם ב-`ARCHITECTURE-SPINE.md` שנבנה כרגע.

## איך "רואים" קובץ סקיל בפועל

כל קובץ הוא בעצם מסמך Markdown רגיל שאפשר לפתוח בעורך הקוד (VS Code) כמו כל קובץ אחר. לדוגמה, ההתחלה של `expertise-nodejs-typescript/SKILL.md` נראית כך:

```markdown
---
name: expertise-nodejs-typescript
description: 'Node.js/TypeScript conventions and current best practices for this project...'
---

# Node.js + TypeScript Conventions (2026)

> Facts here (Node version numbers, TypeScript compiler version, tool defaults)
> are current as of September 2026. ... before treating a specific version
> number as gospel in a long-lived doc or CI pin, verify it's still accurate.

## Runtime: Node.js
- Active LTS is Node 24; ...
```

שאר הקובץ ממשיך באותו סגנון: כותרות ברורות, קוד לדוגמה, טבלאות "כן/לא". הקבצים עצמם נכתבו **באנגלית** (כי זה מסמך טכני-פנימי לקוד, לא תוכן שמשתמש קצה רואה) — אבל אתן יכולות בכל שלב לבקש תרגום/גרסה עברית לכל אחד מהם.

## איפה הקבצים בפועל

- `.claude/skills/expertise-nodejs-typescript/SKILL.md`
- `.claude/skills/expertise-react-nextjs/SKILL.md`
- `.claude/skills/expertise-postgres-prisma/SKILL.md`
- `.claude/skills/expertise-testing/SKILL.md`
- `.claude/skills/expertise-api-rest/SKILL.md`
