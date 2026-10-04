# CCH Solutions website

Static marketing site for CCH Solutions. Plain HTML, CSS and JavaScript: no build step, no frameworks, no dependencies.

```
index.html            the whole site
404.html              not-found page
favicon.svg
robots.txt
assets/
  css/style.css
  js/main.js          particle hero, scroll story, calculator, contact form
  logo.svg            clean vector CCH mark (from CCHLogoFiles/B.pdf)
  dickon.jpg          About photo
  og-image.png        preview image for link sharing (WhatsApp, LinkedIn, etc.)
```

## Preview locally

```bash
cd ~/Developer/CCHSolutions/website
python3 -m http.server 8000
```

Then open http://localhost:8000. Press `Ctrl+C` to stop.

## Editing

- **Text**: everything is in `index.html`. Search for the words you want to change.
- **Email address**: search `index.html` and `assets/js/main.js` for `dickon.collins@gmail.com`.
- **Colours**: the variables at the top of `assets/css/style.css` (`--brand`, `--brand-2` and so on).

## Deploy (GitHub → server → Docker)

Live at **https://solutions.cch-uk.tech**. The site runs in a small nginx container
(`Dockerfile`, `docker/nginx.conf`, `docker-compose.yml`). The container listens on
`127.0.0.1:8080` only. The server's main reverse proxy forwards the subdomain to it and handles HTTPS.

### 1. Push to GitHub (one-off, on your Mac)

Create an empty **private** repo on GitHub (e.g. `cch-website`) without a README, then:

```bash
cd ~/Developer/CCHSolutions/website
git init -b main
git add .
git commit -m "Initial site"
git remote add origin git@github.com:<your-username>/cch-website.git
git push -u origin main
```

### 2. DNS (one-off)

At your domain registrar, add an **A record**: `solutions` → your server's IP address.

### 3. On the server (one-off)

```bash
git clone git@github.com:<your-username>/cch-website.git ~/cch-website
cd ~/cch-website
docker compose up -d --build
curl -I http://127.0.0.1:8080      # should return 200 OK
```

Then point the reverse proxy at it. For host nginx, add
`/etc/nginx/sites-available/solutions.cch-uk.tech`:

```nginx
server {
    listen 80;
    server_name solutions.cch-uk.tech;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/solutions.cch-uk.tech /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d solutions.cch-uk.tech      # free HTTPS certificate
```

If port 8080 is already taken, change the left-hand port in `docker-compose.yml`
and in `proxy_pass` to match.

### 4. Updating the site later

```bash
# on your Mac
git add . && git commit -m "Update copy" && git push

# on the server
cd ~/cch-website && git pull && docker compose up -d --build
```

## Before going live

- [ ] Consider a business email on the domain (e.g. `hello@cch-uk.tech`) instead of Gmail.
- [ ] Check the About copy is accurate for you.
