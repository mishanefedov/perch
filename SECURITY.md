# Security

perch-pet runs in the visitor's browser and makes no network requests of its own, except one optional `fetch` of the creature JSON file you point `creatureUrl` at (same site).

Please report a vulnerability privately through GitHub: Security tab, "Report a vulnerability". Do not open a public issue for it. Expect a first answer within a week.

In scope: the script (`dist/perch.js`), the tuner, and the `perch-pet` command. The command only reads and writes files inside the project folder you run it in.
