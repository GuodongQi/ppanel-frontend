# Customizations

This fork keeps site-specific changes on `custom/*` branches while `main`
tracks `perfect-panel/frontend`.

## Admin

- Normalize subscription `nodes` to numbers and remove empty `node_tags`
  before create/update requests. This avoids form validation failures and
  accidental node removal with PPanel Server 1.20.2.
- Add a `manual-<order-id>-<timestamp>` trade number when an administrator
  marks an order as paid.
- Include the standalone traffic overview at `apps/admin/public/traffic.html`
  and link it from the Users & Support menu.

## User

- Show applications when a download exists for the current platform, even
  when the application has no import URL scheme.
- Convert commission withdrawal amounts from the displayed currency unit to
  API cents.
- Show the end of the current traffic period as one second before the API's
  next-cycle boundary. For example, a reset boundary of
  `2026-10-21 00:00:00` is presented as `2026-10-20 23:59:59`.
- Use user-facing Chinese menu labels such as `使用教程`, `购买套餐`,
  `我的订单`, and `联系客服`.
- Sort documents by the configured category/document order, remove empty
  categories, and render client tutorials as platform tabs with inline
  content.
- Allow documents containing subscription placeholders to remain readable
  before purchase; unavailable subscription URLs are replaced by the purchase
  hint.

## Updating from upstream

1. Fetch `upstream`.
2. Create a temporary branch from the desired upstream release tag.
3. Cherry-pick the required customization commits from `custom/*`.
4. Remove a customization if upstream has fixed the same issue.
5. Run `bun run check`, `bun run test`, and `bun run build`.
6. Merge or tag only after testing the generated admin and user artifacts.
