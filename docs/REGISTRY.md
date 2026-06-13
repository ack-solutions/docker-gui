# Private image registry

docker-gui can run a private Docker image registry on your server, so your CI
(e.g. GitHub Actions) can **push** images to it and the server can **pull**
them back to deploy — no Docker Hub, no third-party registry required.

This is the building block for a "build in CI → push → deploy on the server"
workflow.

---

## 1. Enable the registry

1. Open **Features** in the panel.
2. Enable **Image registry**. This starts a `registry:2` container
   (`docker-gui-registry`) on the internal Docker network, with a persistent
   named volume (`docker-gui_registry-data`) and tag deletion enabled.
3. Open **Registry** in the panel and **Add a connection** pointing at the
   managed registry:
   - **Endpoint:** `http://docker-gui-registry:5000`
   - **Managed:** yes

The panel reaches the registry directly over the Docker network, so no host
port needs to be open for the panel to browse/prune images.

> By default the registry's host port is bound to `127.0.0.1:5000` — it is
> **not** reachable from the internet. For external push (from CI), expose it
> through the reverse proxy with TLS + auth (next section).

---

## 2. Expose it for external push (TLS + auth via the reverse proxy)

`docker push` from GitHub Actions needs to reach the registry over HTTPS with
authentication. The recommended path is to front it with the built-in reverse
proxy (Caddy):

1. Enable the **Reverse proxy** feature (Caddy) if you haven't.
2. Add a **Site** for e.g. `registry.example.com` with upstream
   `docker-gui-registry:5000`. Caddy issues a TLS certificate automatically.
3. Add HTTP basic authentication on that site (so only your CI can push).
4. In **Registry → your connection**, set:
   - **Push host:** `registry.example.com`
   - **Username / Password:** the basic-auth credentials

The panel will then show the correct `docker login` / `docker push` lines for
`registry.example.com`.

> Per-registry htpasswd auth and one-click "expose with auth" automation are
> on the roadmap; today the auth lives at the reverse-proxy layer, which keeps
> the registry container itself unprivileged and stateless.

---

## 3. Push from GitHub Actions

Store the registry credentials as repository secrets
(`REGISTRY_USERNAME`, `REGISTRY_PASSWORD`) and add a workflow:

```yaml
name: build-and-push
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to the registry
        uses: docker/login-action@v3
        with:
          registry: registry.example.com
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: registry.example.com/my-app:${{ github.sha }},registry.example.com/my-app:latest
```

The **Registry** page in the panel shows a copy-paste version of the
`docker login` / `docker tag` / `docker push` commands for each connection.

---

## 4. Deploy the pushed image on the server

Once an image is in the registry, deploy it on the server. Today this is a
manual pull + run (over SSH or from a container you manage in the panel):

```bash
docker login registry.example.com -u <user> -p <password>
docker pull registry.example.com/my-app:latest
docker rm -f my-app 2>/dev/null || true
docker run -d --name my-app --restart unless-stopped registry.example.com/my-app:latest
```

> **Coming next:** a "deploy on push" webhook. The registry emits a
> notification when a new image is pushed; docker-gui will receive it and
> (optionally, per container) pull + restart the matching container
> automatically. Until then, the pull + run above is the path.

---

## 5. Browse and prune from the panel

The **Registry** page lists every repository and its tags, with each tag's
digest and size. Operators and admins can delete a tag — this deletes the
underlying manifest (tag deletion is enabled on the managed registry). To
reclaim disk after deleting tags, run the registry's garbage collector:

```bash
docker exec docker-gui-registry \
  registry garbage-collect /etc/docker/registry/config.yml
```

(A one-click garbage-collect button is planned.)

---

## Roles

| Action | Minimum role |
| --- | --- |
| Browse repositories / tags | any signed-in user |
| Add / edit / remove a connection | operator |
| Delete a tag | operator |
| Enable / disable the registry feature | admin |

## Data & lifecycle

- Image data lives on the `docker-gui_registry-data` named volume and survives
  disabling → re-enabling the feature.
- Removing a **connection** in the panel only forgets how to reach a registry;
  it never deletes image data.
