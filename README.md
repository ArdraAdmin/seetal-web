# STL Web (Next.js) — Phase 1 Admin

Admin web console for Seetal STL. Uses the same backend as the Flutter app.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Thin `fetch` API client against the testing API

## API

Default base URL (also in `.env.local`):

```
NEXT_PUBLIC_API_BASE=https://stl-api-testing.herokuapp.com
```

Copy `.env.example` if needed. Auth uses `POST /user/login` and stores JWT + role in `localStorage` and a session cookie. Only users with `role === "Admin"` can open `/admin/*`.

## Run locally

```bash
cd /Users/prathamdave/Documents/Projects/Flutter/Seetal/STLWeb
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.

## Phase 1 modules

| Area | Route | API |
|------|-------|-----|
| Dashboard | `/admin` | — |
| Drivers | `/admin/drivers` | `/admin/driver/*` |
| Vehicles | `/admin/vehicles` | `/admin/vehicle/*` |
| Stores | `/admin/stores` | `/admin/read/store` |
| Sales profiles | `/admin/profiles/sales` | `/admin/read/sales` |
| Warehouse profiles | `/admin/profiles/warehouse` | `/admin/read/warehouse` |
| Inventory | `/admin/inventory` | `/admin/product` |
| Pending orders | `/admin/pending-orders` | `/mock/warehouse/order/pending` |
| GRV | `/admin/grv` | `/admin/grv` |

Payments, Categories, and Warehouse entry points are present as dashboard tiles / placeholders (full UI later).

## Notes

- CORS: STLAPI already allows `Access-Control-Allow-Origin: *`. If browser OPTIONS fails, check Allow-Methods on the API.
- Push notifications, maps, CSV upload, and warehouse check flows are out of scope for Phase 1.
