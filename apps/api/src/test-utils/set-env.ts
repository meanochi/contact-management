// @contact-management/db refuses to load without a connection string. Unit
// tests never connect (the pool is lazy and `db` is mocked), so any value works.
process.env["DATABASE_URL"] ??= "postgresql://test:test@localhost:5432/test";
