# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please do not open a public issue with exploit details.

Use one of the following approaches:

- Open a GitHub issue with minimal detail and request a private contact channel.
- Contact the maintainer directly if a secure channel is available.

Include:

- Affected component/file
- Reproduction steps
- Impact assessment
- Suggested remediation (if known)

## Scope

Security-sensitive areas include:

- Authentication and session handling
- Trading endpoints and broker integrations
- Secret/environment variable handling
- WebSocket authorization and data exposure

## Hardening Expectations

- Never commit `.env` files or private keys.
- Use strong secrets for all local deployments.
- Keep dependencies up to date and monitor advisories.
- Restrict CORS and network exposure in production.

## Disclosure Timeline

- Initial triage target: 72 hours
- Remediation planning target: 7 days
- Public disclosure: after a fix is available or a mitigation is documented
