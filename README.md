# OBEY HEALTH WISE

Responsive healthcare service-request website and installable PWA. Frontend assets are static; Vercel serverless functions handle requests. Supabase Postgres stores submissions.

## Included
- Responsive website using the supplied OBEY HEALTH WISE logo.
- Malaria test/treatment review, typhoid testing/clinical review, injection administration, BP, blood sugar, temperature, wound dressing, prescribed medication administration, health education/screening and first-aid request categories.
- Service request form with input validation, consent and reference number.
- Public contact phone: 07086125143; notification inbox: obeyhealthwise@gmail.com.
- Optional server-side email alerts for every successfully saved request using Resend.
- Server-side API; no database secret in browser code.
- Protected read-only admin request endpoint (`GET /api/admin-requests`).
- PWA manifest and offline cache for static pages.

## Deploy with GitHub + Vercel
1. Create a GitHub repository named `obey-health-wise` and upload all files in this folder to its root (not the parent folder).
2. In Vercel, choose **Add New → Project**, import the GitHub repository, and deploy. Vercel should detect the project as static with serverless API functions.
3. Create a Supabase project. In its SQL Editor, run `database/schema.sql`.
4. In Vercel → Project → Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (Sensitive; server-side only)
   - `ADMIN_ACCESS_KEY` (use a long random secret)
   - `RESEND_API_KEY` (Resend API key; required to send email alerts)
   - `RESEND_FROM_EMAIL` (a sender address on a domain verified in Resend, e.g. `OBEY HEALTH WISE <notifications@yourdomain.com>`)
   - `REQUEST_NOTIFICATION_EMAIL` = `obeyhealthwise@gmail.com`
   Add them to Production and Preview as appropriate, then redeploy.
5. In Resend, verify a sending domain and create an API key. Add the three email variables above in Vercel, then redeploy. The sender address must belong to the verified domain; do not use a made-up sender address.
6. Test a sample request, confirm a row appears in Supabase `service_requests`, and confirm the notification arrives at `obeyhealthwise@gmail.com`. Check Resend logs if the row is saved but no email arrives. Email alerts are best-effort: database saving remains successful if the mail provider is unavailable.

## Admin request list
Send a GET request to `/api/admin-requests` with header `Authorization: Bearer YOUR_ADMIN_ACCESS_KEY`. This endpoint returns up to 100 recent requests. It is an API endpoint, not a public admin page. Do not share the key. For production use, add authenticated staff accounts, audit logs, retention rules and role-based access before expanding staff access.

## Important launch checklist
- Confirm the displayed phone number and notification inbox are monitored by authorised staff; add a verified service address and operating hours before launch.
- Confirm the legal business/clinic identity, service area, operating hours, prices, staff credentials and scope of practice.
- Ensure malaria/typhoid testing and treatment decisions are made by qualified clinicians; never advertise automatic diagnosis or medication.
- Ensure injections and medication administration require appropriate clinical authorisation/prescription.
- Publish a privacy notice and obtain appropriate consent. Health information is sensitive: collect only what is necessary, restrict staff access, define retention/deletion, and confirm applicable Nigerian data-protection and healthcare obligations before launch.
- Provide a verified emergency contact route. The site currently tells users in Nigeria to call 112 or attend the nearest emergency department for emergencies.
- The site does not diagnose, prescribe, confirm an appointment, or replace emergency care.

## Local preview
Because the frontend is plain static HTML/CSS/JS, open `index.html` in a browser to preview the design. API submissions will only work after deployment with the environment variables and Supabase schema configured. For local API testing use Vercel CLI (`vercel dev`) with a local `.env.local`; never commit `.env.local`.

## GitHub Pages note
GitHub Pages can host the static frontend only; it cannot run the `/api` serverless functions. Use Vercel as the live host for both the frontend and API, with GitHub as the source repository and version-control backup.
