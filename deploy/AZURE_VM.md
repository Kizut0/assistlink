# Azure VM deployment checklist

The repository supplies the container, migration runner, Compose service, Nginx
location, and deployment script. Complete the Azure and host setup below once.

## 1. Azure resources

1. Use an Ubuntu Azure VM with a static public IP.
2. Enable its **system-assigned managed identity** under VM → Identity.
3. On the Key Vault, add the VM identity with the **Key Vault Secrets User** RBAC
   role. It needs read access only.
4. Add these Key Vault secrets with the exact names:
   `DATABASE-URL`, `JWT-SECRET`, `AD-CLIENT-SECRET`, and optionally
   `GEMINI-API-KEY`. For temporary demo login, also add
   `DEMO-AUTH-PASSCODE` with a strong shared passcode.
5. Set `DATABASE-URL` to
   `postgresql://assistlink:PASSWORD@postgres:5432/assistlink`, using the same
   password as the VM secret file created below. A password from
   `openssl rand -hex 32` needs no URL encoding.
6. Point the application's DNS name at the VM public IP.
7. In the network security group, expose ports 80 and 443. Restrict port 22 to
   trusted administrator IPs. Do not expose ports 8081 or 5432.

Microsoft references:

- <https://learn.microsoft.com/azure/virtual-machines/instance-metadata-service>
- <https://learn.microsoft.com/azure/key-vault/general/rbac-guide>
- <https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/how-to-configure-managed-identities>

## 2. Microsoft sign-in

Register this exact production redirect URI in the Microsoft Entra application:

```text
https://YOUR_DOMAIN/assistlink/api/auth/callback
```

Keep the application ID and tenant ID for `.env.production`; store the Entra
client-secret value only as `AD-CLIENT-SECRET` in Key Vault.

## 3. VM software and repository

Install Docker Engine with the Compose plugin, Git, Nginx, and Certbot. Follow the
official Docker Engine instructions for the VM's Ubuntu release:
<https://docs.docker.com/engine/install/ubuntu/>.

Clone the repository, then create the non-secret deployment configuration:

```bash
cp .env.production.example .env.production
chmod +x deploy.sh
chmod +x deploy/backup-postgres.sh
```

Edit `.env.production` with the vault URL, Entra identifiers, domain callback,
Gemini model, and the path `/etc/assistlink/postgres-password`. Never add database
passwords, JWT secrets, or API keys there.

Create the password file on the VM. Paste the same hexadecimal password used in
the Key Vault `DATABASE-URL` value when prompted:

```bash
sudo install -d -m 700 /etc/assistlink
read -r -s -p "PostgreSQL password: " ASSISTLINK_DB_PASSWORD
printf '\n'
printf '%s' "$ASSISTLINK_DB_PASSWORD" | sudo tee /etc/assistlink/postgres-password >/dev/null
unset ASSISTLINK_DB_PASSWORD
sudo chmod 600 /etc/assistlink/postgres-password
```

The password initializes PostgreSQL only when the `postgres_data` volume is
empty. Changing the file later does not rotate the password inside an existing
database.

## 4. Nginx and TLS

Add `deploy/nginx/assistlink.conf` inside the domain's HTTPS `server` block.
Test and reload Nginx after changing it:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Use Certbot to obtain and renew the certificate for the domain. Keep
`proxy_pass http://127.0.0.1:8081` without a trailing slash so Express receives
the `/assistlink` prefix.

## 5. Deploy and verify

```bash
./deploy.sh
curl --fail https://YOUR_DOMAIN/assistlink/api/health
```

`deploy.sh` fast-forwards `main`, builds the image, loads the database URL from
Key Vault, starts PostgreSQL, waits for it to become healthy, applies committed
Prisma migrations, and replaces the API container. A first deployment creates an
empty database schema; it does not load development seed data. The API listens
only on VM localhost, and PostgreSQL has no host port, so public traffic must pass
through Nginx.

### Demo data and test sign-in

For the recorded demonstration, set `DEMO_AUTH_ENABLED=true` in
`.env.production`, deploy, and seed through the same managed-identity/Key Vault
bootstrap used by the API:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm --no-deps api npm run seed:demo
```

The blank demo form accepts the shared Key Vault passcode for every account
created by the demo seed: `student1@university.edu` through
`student50@university.edu`, all nine professor emails, and
`admin@university.edu`. It rejects accounts that are present in the database but
are not part of the seed. Seeding is idempotent and does not create applications,
so the student-to-professor workflow starts clean.

The professor demo emails are:

- `prof@university.edu`
- `prof.management@university.edu`
- `prof.arts@university.edu`
- `prof.communication@university.edu`
- `prof.architecture@university.edu`
- `prof.food@university.edu`
- `prof.law@university.edu`
- `prof.music@university.edu`
- `prof.nursing@university.edu`

Every account above uses the same `DEMO-AUTH-PASSCODE` value. The application
does not display the account list or passcode.

After recording, set `DEMO_AUTH_ENABLED=false`, redeploy, and remove
`DEMO-AUTH-PASSCODE` from Key Vault unless evaluators still need access.

For troubleshooting:

```bash
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 api
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 postgres
```

## 6. Bootstrap the first admin

The production database starts without users. Sign in through Microsoft once so
the application creates your user, then promote only that account from the VM:

```bash
docker compose --env-file .env.production -f compose.production.yml exec postgres \
  psql -U assistlink -d assistlink \
  -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'YOUR_EMAIL';"
```

The command should report `UPDATE 1`. Sign out and back in, then use the admin UI
for later role assignments. Do not run the development seed in production unless
you intentionally want its fake users and postings.

## 7. Backups

The named Docker volume survives container replacement but not VM or disk loss.
Create a backup after deployment and on a daily schedule:

```bash
./deploy/backup-postgres.sh
```

Backups are written under `backups/postgres`, ignored by Git, with mode `0600`.
Copy every backup to encrypted storage outside the VM and periodically test a
restore. Never run `docker compose down -v` in production because `-v` deletes
the PostgreSQL volume.
