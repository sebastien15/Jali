# UX Quality Checklist — "Feels Like Uber"

Every story labelled `mobile` or `ux` must pass this checklist before it is closed.
It is the difference between "the feature works" and "the feature feels world-class".

## Clarity
- [ ] One primary action per screen, visually dominant (full-width button at the bottom).
- [ ] Rider can go from Home to a requested ride in **≤ 3 taps** after choosing a destination.
- [ ] Prices always show what the rider pays in total; any breakdown is one tap away.
- [ ] Driver identity (photo, name, car colour + model, **plate in large text**) is always visible during pickup.

## Speed & feedback
- [ ] Every tap gives feedback within 100 ms (pressed state, haptic on primary actions).
- [ ] Lists and cards use skeleton loaders, never a blank screen or a lone spinner (see `.claude/skills/ux-patterns.md`).
- [ ] Data shown instantly from TanStack Query cache, then refreshed.
- [ ] Animations at 60 fps on a mid-range Android (Reanimated, no JS-thread animations).
- [ ] Map markers move smoothly, never jump.

## Resilience
- [ ] Clear empty states with a next action (*No drivers nearby — widen search*).
- [ ] Human error messages, never raw API errors; retry button where it makes sense.
- [ ] Works on weak 3G and recovers from offline (OfflineBanner + retries).
- [ ] Active trip survives app kill and reopen.

## Consistency
- [ ] Colours only from `C.xxx` in `constants/theme.ts`; supports dark mode tokens.
- [ ] Ionicons only, consistent sizes (20 inline, 24 header, 28 primary).
- [ ] Bottom-sheet pattern for ride flows; same header component per area.
- [ ] Money formatted `3,400 RWF` everywhere (plus optional home currency, S9.4).

## International & accessible
- [ ] All strings in `locales/{en,fr,rw,sw}.json` — no hard-coded text.
- [ ] Layout survives long French strings and 200% font scale.
- [ ] Every touchable has `accessibilityLabel`; touch targets ≥ 44×44 pt.
- [ ] Text contrast ≥ 4.5:1.

## Safety & trust
- [ ] Safety shield (S18.7) reachable from every trip screen.
- [ ] Destructive or paid actions (cancel with fee, tip, pay) ask for confirmation showing the amount.
- [ ] No phone numbers or exact rider locations shown before they're needed.

## Proof
- [ ] Screen recording or screenshots (light + dark, EN + one other language) attached to the PR.
