1. Add your Stripe test keys to `.env` to enable card checkout; set `PUBLIC_URL` to your site URL when deployed.
2. Run `docker compose up --build` from this folder.
3. Visit `http://localhost:3000`; private shop login is `/bmo-panel`.
4. Set `ADMIN_USER`, `ADMIN_PASS`, and `SESSION_SECRET` in `.env` before deployment.
5. Admin URL: http://localhost:3000/bmo-panel