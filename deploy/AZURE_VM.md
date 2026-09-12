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
   `GEMINI-API-KEY`.
5. Ensure the database in `DATABASE-URL` accepts connections from the VM. A
   managed Azure Database for PostgreSQL instance is recommended; do not expose
   PostgreSQL port 5432 publicly.
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
```

Edit `.env.production` with the vault URL, Entra identifiers, domain callback,
and Gemini model. Never add database passwords, JWT secrets, or API keys there.

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
Key Vault to apply committed Prisma migrations, and replaces the API container.
The API listens only on VM localhost; public traffic must pass through Nginx.

For troubleshooting:

```bash
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 api
```
