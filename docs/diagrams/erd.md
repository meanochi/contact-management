# ERD: מסד הנתונים

נוצר מ-`packages/db/src/schema/index.ts` ב-2026-10-22. אין לערוך ידנית: מרעננים בעזרת הסקיל `expertise-diagrams`.

```mermaid
erDiagram
    Domain {
        text id PK
        text name UK
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
    }
    SupportedBody {
        text id PK
        text company_id UK
        text name
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
    }
    SupportedBodyOnDomain {
        text supported_body_id PK, FK
        text domain_id PK, FK
        timestamp createdAt
    }
    Contact {
        text id PK
        text first_name
        text last_name
        text id_number "nullable"
        text role "nullable"
        text[] emails
        text phone "nullable"
        text notes "nullable"
        boolean email_opt_in
        boolean sms_opt_in
        ContactStatus status
        timestamp deactivated_at "nullable"
        ExternalRequestSource external_request_source "nullable"
        timestamp external_request_date "nullable"
        timestamp createdAt
        timestamp updatedAt
    }
    ContactOnSupportedBody {
        text contact_id PK, FK
        text supported_body_id PK, FK
        timestamp createdAt
    }
    ContactOnSupportedBodyDomain {
        text contact_id PK, FK
        text supported_body_id PK, FK
        text domain_id PK, FK
    }
    AuditLog {
        text id PK
        text table_name
        text record_id
        text action
        jsonb before "nullable"
        jsonb after "nullable"
        text changed_by_id "nullable"
        timestamp changedAt
    }

    Domain ||--o{ SupportedBodyOnDomain : "has"
    SupportedBody ||--o{ SupportedBodyOnDomain : "belongs to"
    Contact ||--o{ ContactOnSupportedBody : "linked to"
    SupportedBody ||--o{ ContactOnSupportedBody : "has"
    ContactOnSupportedBody ||--o{ ContactOnSupportedBodyDomain : "composite FK"
    Domain ||--o{ ContactOnSupportedBodyDomain : "represents"
    %% ContactStatus: ACTIVE | INACTIVE
    %% ExternalRequestSource: PHONE | EMAIL | OTHER
```

## מה שהתרשים לא מראה

- איש קשר אף פעם לא נמחק: "מחיקה" היא `status = INACTIVE`.
- התחומים של איש קשר מול גוף נתמך חייבים להיות תת-קבוצה של התחומים של הגוף עצמו. זה נאכף ב-`ContactsService`, ואין לזה מפתח זר בסכמה.
- לאיש קשר אין `domainId` ישיר: הוא מגיע לתחום רק דרך הגוף הנתמך שאליו הוא מקושר.
- `AuditLog` קיימת בסכמה, אבל כרגע שום דבר לא כותב אליה.
- `Domain` היא טבלה ולא enum, כדי שאפשר יהיה להוסיף ולשנות תחומים בלי migration.
