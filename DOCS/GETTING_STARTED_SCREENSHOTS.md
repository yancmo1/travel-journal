# Getting Started screenshot checklist

The reusable guide is rendered by `src/components/GettingStarted.jsx`. Capture screenshots from the current build at each state below so the guide’s annotated images stay aligned with the live UI.

## Required states

- Welcome screen: “Let’s set up your travel story”
- Home base: city/ZIP explanation and suggestion list
- First memory: location, date, photo metadata message, and apply actions
- First journey: first memory already selected
- Completion: edit memory, add another memory, and explore the map actions
- Getting Started navigation item on desktop
- Getting Started navigation item inside the mobile menu
- Dashboard empty state with contextual help link
- Beta invitation email result with accepted status and protected fallback link

## Review before publishing screenshots

- Test at 375px, 768px, 1024px, and 1440px widths.
- Confirm all visible copy matches current labels and actions.
- Confirm text and controls meet accessible contrast requirements.
- Confirm every actionable control has a visible keyboard focus state and a minimum 44px touch target.
- Confirm the guide can be closed, reopened, skipped, and resumed.
- Confirm a saved home base does not cause the home prompt to reappear on another device.
- Confirm screenshots do not contain private email addresses, invitation tokens, or personal memories.
