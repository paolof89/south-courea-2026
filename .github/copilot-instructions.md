# Project instructions

This repository contains a mobile-first travel itinerary PWA for Korea 2026.

Always read SPEC.md before making architectural or functional changes.

Technical constraints:

- Use semantic HTML5, native CSS and vanilla JavaScript ES modules.
- Do not introduce React, Next.js, Vue, Angular or other frameworks.
- Do not introduce a backend or database.
- Keep itinerary content in data/itinerary.json.
- The application must work on GitHub Pages under a repository subpath.
- Use relative URLs. Never assume the site is hosted at the domain root.
- Use hash-based routing.
- Implement offline support with a Service Worker.
- Preserve accessibility and mobile usability.
- Use textContent instead of innerHTML for itinerary data.
- Do not invent missing itinerary information.
- Mark uncertain data explicitly.
- Never add credentials, booking references, personal documents or secrets.
- Keep the application portable to Cloudflare Pages.
- Before completing a change, test that all JSON is valid and all internal
  paths work under a GitHub Pages project URL.