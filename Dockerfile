# ai-debt-audit — all six tools pre-installed, so CI/local runs skip the
# "pip install semgrep bandit pip-audit && curl gitleaks && npm install"
# dance the GitHub Action currently has to redo on every single run.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Modern git refuses to operate on a repo owned by a different user than
# the process running it ("detected dubious ownership"). This container
# always runs as root, but the mounted /repo volume is owned by whatever
# user owns it on the host — almost never root on a real CI runner (it
# silently worked in local testing only because that was root-on-root on
# both sides, which hid this entirely — caught by an actual GitHub Actions
# run, not local testing). Trusting any mounted directory is the right
# call here specifically because this container's only job is scanning
# whatever repo gets mounted into it.
RUN git config --system --add safe.directory '*'

# Debian's system Python is externally managed (PEP 668) — a venv keeps
# this contained instead of fighting pip with --break-system-packages.
RUN python3 -m venv /opt/aidebt-venv
ENV PATH="/opt/aidebt-venv/bin:${PATH}"
RUN pip install --no-cache-dir semgrep bandit pip-audit

# gitleaks ships as a single static binary — no package manager needed,
# resolve "latest" dynamically so this doesn't silently go stale.
RUN set -eux; \
    VERSION=$(curl -sSf https://api.github.com/repos/gitleaks/gitleaks/releases/latest | grep '"tag_name"' | head -1 | cut -d'"' -f4 | sed 's/^v//'); \
    curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz" | tar -xz -C /usr/local/bin gitleaks; \
    chmod +x /usr/local/bin/gitleaks

WORKDIR /opt/ai-debt-audit
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY bin ./bin
COPY scripts ./scripts
COPY rules ./rules

RUN ln -s /opt/ai-debt-audit/bin/aidebt-scan.js /usr/local/bin/aidebt-scan \
    && chmod +x /opt/ai-debt-audit/bin/aidebt-scan.js

WORKDIR /repo
ENTRYPOINT ["aidebt-scan"]
CMD ["."]
