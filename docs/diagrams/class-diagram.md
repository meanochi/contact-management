# Class Diagram: ה-API

נוצר מ-`apps/api/src` ב-2026-10-22. אין לערוך ידנית: מרעננים בעזרת הסקיל `expertise-diagrams`.

```mermaid
classDiagram
    direction LR

    class ZodValidationPipe {
        <<pipe>>
    }
    class DrizzleDb["DrizzleDb (packages/db)"] {
        <<package>>
    }

    namespace Contacts {
        class ContactsModule {
            <<module>>
        }
        class ContactsController {
            <<controller>>
            +list(query)
            +create(body)
            +update(id, body)
            +addSupportedBody(id, body)
            +updateSupportedBodyDomains(id, supportedBodyId, body)
            +removeSupportedBody(id, supportedBodyId)
            +deactivate(id, body)
            +activate(id)
        }
        class ContactsService {
            <<service>>
            +list(query)
            +create(input)
            +update(id, input)
            +addSupportedBody(contactId, supportedBodyId, domainIds)
            +updateSupportedBodyDomains(contactId, supportedBodyId, domainIds)
            +removeSupportedBody(contactId, supportedBodyId)
            +deactivate(id, source, date)
            +activate(id)
        }
    }

    namespace SupportedBodies {
        class SupportedBodiesModule {
            <<module>>
        }
        class SupportedBodiesController {
            <<controller>>
            +list(query)
            +create(body)
            +update(id, body)
        }
        class SupportedBodiesService {
            <<service>>
            +list(query)
            +create(input)
            +update(id, input)
        }
    }

    namespace Domains {
        class DomainsModule {
            <<module>>
        }
        class DomainsController {
            <<controller>>
            +list()
        }
        class DomainsService {
            <<service>>
            +listActive()
        }
    }

    ContactsModule --> ContactsController : registers
    ContactsModule --> ContactsService : registers
    SupportedBodiesModule --> SupportedBodiesController : registers
    SupportedBodiesModule --> SupportedBodiesService : registers
    DomainsModule --> DomainsController : registers
    DomainsModule --> DomainsService : registers

    ContactsController --> ContactsService : calls
    SupportedBodiesController --> SupportedBodiesService : calls
    DomainsController --> DomainsService : calls

    ContactsController ..> ZodValidationPipe : validates with
    SupportedBodiesController ..> ZodValidationPipe : validates with

    ContactsService --> DrizzleDb : queries
    SupportedBodiesService --> DrizzleDb : queries
    DomainsService --> DrizzleDb : queries

    note for ContactsController "ResponseInterceptor, LoggingInterceptor and AllExceptionsFilter are registered globally in main.ts and wrap every controller"
```

## מה שהתרשים לא מראה

- רק פעולות ציבוריות מופיעות. פונקציות עזר פרטיות, כמו `loadLinks` ו-`getDto`, הושמטו.
- ה-`ResponseInterceptor`, ה-`LoggingInterceptor` וה-`AllExceptionsFilter` נרשמים גלובלית ב-`main.ts` וחלים על כל ה-controllers. לכן הם מופיעים רק בהערה, ולא עם חץ לכל controller.
- מודולי `health` ו-`telemetry` לא נכללים: הם תשתית ולא חלק ממבנה הנתונים של הפרויקט.
- ה-controllers לא מתחברים ל-`DrizzleDb`: רק ה-services. זה הכלל של ארבע השכבות, ואם יופיע חץ כזה, זו הפרה.
