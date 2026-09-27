# Build

```bash
cd energydisplay
npm install
cp .env.example .env
npm run dev
npm test && npm run lint
```

`.github/workflows/docker.yml` builds `linux/amd64` and `linux/arm64` images and pushes them to `ghcr.io/hawkinslabdev/energydisplay` on every push to `main` (`latest`) and on `v*` tags.
