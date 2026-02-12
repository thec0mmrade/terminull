---
title: "Security News Roundup: June 2025"
author: "The Editor"
handle: "r00t"
date: 2025-06-15
volume: 1
order: 4
category: security-news
tags: [news, vulnerabilities, industry]
description: "A curated roundup of the most significant security events and disclosures."
draft: true
---

# Security News Roundup: June 2025

A curated selection of the security stories that matter. No sponsored content, no vendor hype -- just signal.

## Critical Vulnerabilities

### CVE-2025-XXXX: libcurl Header Injection

A critical header injection vulnerability was discovered in libcurl versions 7.x through 8.x, affecting virtually every Linux distribution and countless embedded devices.

```
CVSS: 9.1 (Critical)
Affected: libcurl 7.0 - 8.7.1
Fixed: 8.8.0
Vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
```

> [!WARN] If you're running any version of curl/libcurl, update immediately. This one is being actively exploited in the wild.

### Supply Chain Alert: Compromised npm Package

The popular `event-utils` npm package (2M weekly downloads) was found to contain a credential-stealing backdoor after a maintainer's account was compromised.

Key takeaways:

* The malicious code was obfuscated in a minified file
* It targeted CI/CD environment variables
* Detection took 11 days
* Lock files and pinned dependencies would have mitigated impact

## Industry News

### CISA Mandates Memory-Safe Languages

CISA released new guidelines requiring memory-safe languages for all new federal government software projects. This follows the White House ONCD report and represents the strongest policy push yet toward Rust, Go, and similar languages.

> [!INFO] This doesn't mean C/C++ is dead -- but it means new projects should have strong justification for using memory-unsafe languages.

### Browser Zero-Day Marketplace Prices Surge

Reports indicate that zero-day prices for major browsers have reached record highs:

| Target | Reported Price |
|--------|---------------|
| Chrome RCE + Sandbox Escape | $3M+ |
| Safari RCE + Sandbox Escape | $2.5M+ |
| Firefox RCE | $1.5M+ |
| Full iOS Chain | $5M+ |

This reflects both improved browser security (higher cost to find bugs) and increased government demand for offensive capabilities.

## Tools & Releases

* **Ghidra 11.3** -- New RISC-V decompiler support, improved type inference
* **Burp Suite 2025.6** -- AI-assisted scan configuration
* **Nuclei v4** -- Major rewrite with improved template engine
* **pwndbg 2025** -- Enhanced heap visualization for glibc 2.39

## Community

### DEF CON 33 Preview

DEF CON 33 is shaping up to be massive. Highlights from the accepted talks include:

1. Exploiting AI model serving infrastructure at scale
2. Novel Bluetooth LE attacks on medical devices
3. Breaking post-quantum cryptography implementations
4. Hardware implant detection using software-defined radio

### Capture The Flag

Notable upcoming CTFs:

* **DEFCON CTF Finals** -- August 2025, Las Vegas
* **Google CTF** -- July 2025, Online
* **Hack The Box Uni CTF** -- October 2025, Online

---

*Stay informed. Stay paranoid. Stay patched.*
