# EVCharge - EV Charging Station Finder

EVCharge is a web application for discovering EV charging stations, viewing station availability on a live map, and booking charging slots.

## Features

- User authentication and account settings
- Interactive map with nearby charging stations
- In-app station selection and route/path visualization
- Booking management with time-slot picker
- Admin dashboard for station management
- Separate admin login and protected admin dashboard route

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Supabase
- React Query
- Leaflet

## Getting Started

1. Install dependencies:

```sh
npm install
```

2. Create environment variables in `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

3. Run the development server:

```sh
npm run dev
```

4. Build for production:

```sh
npm run build
```

## Admin Access

- Admin login route: `/admin/login`
- Admin dashboard route: `/admin/dashboard`

A user must have `admin` role in `public.user_roles` to access the dashboard.
