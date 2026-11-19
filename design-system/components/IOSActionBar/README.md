# IOSActionBar

iPhone bottom action bar: replaces the hidden desktop toolbar in the phone layout.

**Source:** `.ios-action-bar`, `.ios-action-button`. Fixed to the bottom in the app; shown inline here.

- Four equal columns, gap `space-2`. 96% `bg-primary` with a top hairline and an upward shadow. Bottom padding adds `safe-area-inset-bottom`.
- Buttons are at least 52px tall: icon over label in `ios-action-label` (0.78rem/600), `bg-primary`, `border-color`, `radius-xl`.
- **Active:** `accent-color` border and text, not a fill. Disabled: 45% opacity.
- Overflow actions open the iOS action sheet. Every toolbar action must be reachable here or there.
