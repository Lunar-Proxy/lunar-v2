# Task Progress: Add Chrome-like dev console for JS execution in iframe

Previous: Dev server on 4321 [completed]

New Steps:
- [x] 1. User approved new plan (Ctrl+Shift+I toggle, postMessage for safe cross-origin exec)
- [ ] 2. Create src/components/DevConsole.astro (UI: toggle btn, drawer, input, exec btn, output)
- [ ] 3. Update src/layouts/side.astro (add devtools btn)
- [ ] 4. Update src/pages/index.astro (add DevConsole)
- [ ] 5. Create src/utils/devconsole.ts + build logic if needed
- [ ] 6. Update src/main.css (drawer styles)
- [ ] 7. Update src/utils/index.ts or shortcuts.ts (handle toggle/exec)
- [ ] 8. Test & attempt completion

Notes: Safe postMessage exec; dev server hot-reloads.

