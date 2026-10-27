# Security

This repository is a static browser demonstration. It has no backend, privileged keys, account system, telemetry or connection to the private production service. Teams and scrapbooks are stored in the current browser. Imported JSON is validated before saving.

Do not commit secrets, `.env` files, hosting manifests, private history or user exports. Do not place sensitive information in team names or notes when sharing a device or exported file.

For a potential vulnerability, use GitHub's **Security → Report a vulnerability** when available. Do not disclose exploit details or private data in a public issue. If private reporting is unavailable, open a minimal issue requesting a private reporting channel, without the sensitive details.

Dependency and browser security can change. The lockfile makes builds reproducible; it is not a guarantee that dependencies will stay free of vulnerabilities. Review dependency advisories and rerun relevant tests when changing versions.
