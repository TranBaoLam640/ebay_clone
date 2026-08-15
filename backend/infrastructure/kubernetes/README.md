# Kubernetes deployment (k3s single VPS)

Deploys `sbay-backend` behind ingress-nginx + Cloudflare Tunnel, with MongoDB as a
StatefulSet and Keel for pull-based auto-deploy. Run all commands on the VPS unless noted.

Path: cloudflare edge → cloudflared (in-cluster) → ingress-nginx → backend Service → pods → MongoDB StatefulSet.

## 0. Prerequisites (gather first)
- GHCR PAT with `read:packages` (for the private image pull secret + Keel).
- Cloudflare account + a domain on it + a **Tunnel token** (Zero Trust → Networks → Tunnels → create → copy token).
- Verify the SOURCE Mongo before migration: `docker exec sbay_db mongod --version` (pin the StatefulSet image major to match) and confirm DB `sbay` has data.

## 1. Install k3s (Traefik + ServiceLB disabled)
```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --disable servicelb --write-kubeconfig-mode 644" sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes                     # Ready
kubectl get storageclass              # local-path (default)
kubectl top nodes                     # metrics-server bundled → returns data
```

## 2. Platform add-ons (Helm)
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add keel https://charts.keel.sh && helm repo update

# ingress-nginx as ClusterIP (no cloud LB; cloudflared reaches it internally).
# use-forwarded-headers + CF-Connecting-IP so rate-limit keys on the real client IP.
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace \
  --set controller.service.type=ClusterIP \
  --set controller.config.use-forwarded-headers="true" \
  --set controller.config.forwarded-for-header="CF-Connecting-IP"

helm install keel keel/keel -n keel --create-namespace \
  --set helmProvider.enabled=false
```

## 3. Namespace + secrets (never committed)
```bash
kubectl apply -f namespace.yaml

# GHCR pull secret (paste PAT without echoing it to history):
read -rs GHCR_PAT
kubectl -n sbay create secret docker-registry ghcr \
  --docker-server=ghcr.io --docker-username=konfusee --docker-password="$GHCR_PAT"
# Give Keel the same creds so it can poll the private image:
kubectl -n keel create secret docker-registry ghcr \
  --docker-server=ghcr.io --docker-username=konfusee --docker-password="$GHCR_PAT"
unset GHCR_PAT

# Mongo root creds + replica-set keyfile:
kubectl -n sbay create secret generic mongodb-secret \
  --from-literal=MONGO_INITDB_ROOT_USERNAME=admin \
  --from-literal=MONGO_INITDB_ROOT_PASSWORD='<mongo-pw>'
openssl rand -base64 756 > keyfile
kubectl -n sbay create secret generic mongodb-keyfile --from-file=keyfile && rm keyfile

# App secret (fill every field; see backend-secret.example.yaml):
kubectl -n sbay create secret generic backend-secret \
  --from-literal=MONGODB_USERNAME=admin \
  --from-literal=MONGODB_PASSWORD='<mongo-pw>' \
  --from-literal=JWT_ACCESS_SECRET='<32+>' \
  --from-literal=JWT_REFRESH_SECRET='<32+>' \
  --from-literal=CSRF_SECRET='<32+>' \
  --from-literal=EMAIL_USER='<smtp-user>' \
  --from-literal=EMAIL_PASSWORD='<smtp-pass>' \
  --from-literal=EMAIL_OTP_HMAC_SECRET='<32+ non-placeholder>'

# Cloudflare tunnel token:
kubectl -n sbay create secret generic cloudflared-token --from-literal=token='<TUNNEL_TOKEN>'
```

## 4. Edit non-secret config before applying
- `backend-config.yaml`: set `CLIENT_ORIGIN`, `EMAIL_FROM`, `EMAIL_VERIFICATION_URL` (**https**), and `COOKIE_SAME_SITE` (`none` if the frontend is a different origin than the API, else `lax`).
- `backend-ingress.yaml`: set `host:` to your Cloudflare hostname.
- In the Cloudflare dashboard, route that hostname → `http://ingress-nginx-controller.ingress-nginx.svc:80`.

## 5. Apply (Mongo BEFORE backend)
```bash
kubectl apply -f mongodb-priorityclass.yaml
kubectl apply -f backend-config.yaml
kubectl apply -f mongodb-service.yaml -f mongodb-statefulset.yaml
# On a fresh cluster the StatefulSet is Ready only AFTER rs-init (readiness asserts PRIMARY).
# publishNotReadyAddresses lets the init Job reach the pod first, so apply it now:
kubectl apply -f mongodb-rs-init-job.yaml
kubectl -n sbay wait --for=condition=complete job/mongodb-rs-init --timeout=5m
kubectl -n sbay rollout status statefulset/mongodb --timeout=2m   # now PRIMARY → Ready

# Then the app + edge:
kubectl apply -f backend-deployment.yaml -f backend-service.yaml -f backend-ingress.yaml -f backend-hpa.yaml
kubectl apply -f cloudflared.yaml
kubectl -n sbay rollout status deploy/backend --timeout=5m
```

## 6. Data migration (preserve existing data — Phase 5)
```bash
kubectl -n sbay scale deploy/backend --replicas=0            # quiesce
mongodump --gzip --archive=/tmp/sbay.gz --uri="mongodb://admin:<pw>@127.0.0.1:27017/?authSource=admin&replicaSet=rs0"
cp /tmp/sbay.gz /root/sbay-backup.gz                         # retain off-node backup until sign-off
kubectl -n sbay cp /tmp/sbay.gz mongodb-0:/tmp/sbay.gz
kubectl -n sbay exec mongodb-0 -- sh -c 'mongorestore --drop --gzip --archive=/tmp/sbay.gz --uri="mongodb://admin:<pw>@localhost:27017/?authSource=admin&replicaSet=rs0"'
kubectl -n sbay scale deploy/backend --replicas=2
# verify counts match, then delete archives. Keep the old compose Mongo until validated.
```

## 7. Verify
```bash
kubectl -n sbay get deploy,po,svc,ingress,hpa,statefulset
curl https://<cloudflare-host>/health                       # 200 over public HTTPS, no inbound port
# Zero-downtime: hey -z 60s -c 50 https://<host>/health & kubectl -n sbay rollout restart deploy/backend  → expect 0 responses >=500
# Keel: push to main → new image → Keel rolls pods within ~2m (no SSH)
# HPA: hey -z 120s -c 100 → kubectl -n sbay get hpa backend shows scale-up
```

## Notes / trade-offs (class-project scope)
- Rate limiting lives ONLY at ingress (app is stateless). nginx limits are coarse per-IP.
- `:latest` + Keel `force`: simple auto-deploy; for reliable rollback prefer pinning to `:<sha>` digests.
- local-path PV is node-pinned single copy → back up `/var/lib/rancher/k3s/storage` externally.
- Deferred (documented residual risk, no real users): datastore at-rest encryption, action SHA-pinning, PAT scoping/rotation.
