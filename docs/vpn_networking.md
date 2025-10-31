# Private Remote Access VPNs for Scientific Data: WireGuard, OpenVPN, and Self-Hosted Options

## Executive Summary

Scientific data workflows demand private remote access that is both secure and efficient for multi-user research teams. This report evaluates three classes of solutions—WireGuard, OpenVPN, and selected self-hosted alternatives (OpenConnect/AnyConnect, SoftEtherVPN)—against the operational realities of scientific computing: high-throughput data transfer, fine-grained access control, observability, and scale.

At a glance, WireGuard offers modern cryptography, a minimal codebase, and high performance; OpenVPN provides unmatched compatibility, mature enterprise features, and flexible transport; self-hosted solutions address stealth, firewall traversal, and protocol diversity. While vendor marketing claims often emphasize speed, the most reliable public latency data comes from cross-protocol measurements in a single comparative analysis, supplemented by architecture-focused reviews. We avoid protocol-agnostic “VPN product” benchmarks that do not isolate WireGuard and OpenVPN under controlled conditions.

Table 1 summarizes the recommended roles for each solution in scientific environments.

Table 1. Quick recommendation matrix

| Solution                 | Speed | Security Posture | Setup Complexity | Compatibility | Best-Fit Scientific Use Cases |
|--------------------------|-------|------------------|------------------|---------------|-------------------------------|
| WireGuard                | High  | Strong (modern crypto, small attack surface) | Low (key-based; lean config) | Broad across major OS; fewer router/firewall integrations | High-throughput data transfer; mobile roaming; simplified secure enclaves; container networking |
| OpenVPN                  | Medium–High (UDP) | Strong (OpenSSL; mature, flexible) | Medium–High (PKI, tun/bridge, many options) | Very broad (OS, routers, firewalls) | Complex enterprise integration; RADIUS/SSO; split/broad tunneling; L2 bridging; networks requiring TCP/443 or bespoke crypto |
| Self-hosted (OpenConnect/SoftEther) | High (OpenConnect); Variable (SoftEther) | Strong (OpenConnect: AnyConnect-grade; SoftEther: multi-protocol) | Medium (OpenConnect); Medium (SoftEther) | Broad via AnyConnect clients; SoftEther offers multi-protocol | Stealth/firewall traversal; NAT traversal; legacy/complex environments; protocol diversity on a single server |

Key takeaways:
- WireGuard is generally faster with lower overhead and a compact codebase, making it ideal for high-throughput and mobile workflows. OpenVPN’s strength lies in compatibility, enterprise controls, and flexible transport, especially in complex or regulated environments. Self-hosted options complement these by addressing firewall traversal and protocol diversity under adverse network conditions.[^2][^3]
- When targeting stealth and firewall penetration, OpenConnect (Cisco AnyConnect-compatible) and SoftEtherVPN (with SSTP and VPN-over-ICMP/DNS) are pragmatic complements to WireGuard/OpenVPN, even if run on separate servers due to port conflicts.[^4]
- For scientific data applications, design patterns that combine WireGuard for performance with OpenConnect for stealth or OpenVPN for compatibility often yield the most resilient deployments.

## Scientific Data Access Context and Requirements

Scientific data access spans file transfer to HPC systems, dataset synchronization, accessing Jupyter notebooks or RStudio servers, and interacting with instrument control networks. These workflows often require sustained high throughput, stable low-latency paths, and the ability to handle thousands of concurrent sessions during peak research windows. Enterprise VPN guidance emphasizes secure gateways, strong encryption, and centralized management—standards that translate directly to research environments where data integrity and operational visibility are paramount.[^6]

Typical access patterns involve both batch transfers (e.g., rsync, scp, or specialized parallel transfer tools) and interactive workloads (notebooks, remote desktops). Multi-user concurrency demands reliable session management, predictable bandwidth allocation, and mechanisms to isolate research groups and instruments. Non-functional requirements include authentication integration with institutional directories, logging for auditability, segmentation to limit blast radius, and high availability (HA) with failover tested within defined recovery windows (e.g., under a minute). Many of these controls are standard in enterprise-grade deployments and align with Zero Trust Network Access (ZTNA) principles—continuous verification, device posture checks, and application-level access instead of blanket network access.[^6]

## Evaluation Framework

We evaluate candidate VPNs across five dimensions:

1. Setup complexity—certificate/PKI burden, configuration ergonomics, and operational overhead.
2. Security features—encryption strength, handshake model, auditability, default data handling, and resistance to downgrade risks.
3. Client compatibility—desktop OS, mobile, routers/firewalls, and ecosystem maturity.
4. Performance—latency and throughput characteristics, overhead under load, and mobile/roaming stability.
5. Scalability—concurrency, HA patterns, logging and accounting, and integration with enterprise controls.

Primary performance evidence includes controlled latency comparisons across protocols from a single comparative source and architectural analyses highlighting handshake behavior and overhead differences. We explicitly avoid cross-vendor “VPN product” benchmarks that conflate protocol performance with vendor implementations. Representative methodology and metrics are shown in Figure 1.[^7]

![Example VPN benchmark chart from PassMark—illustrative of methodology scope (context only; not protocol-specific).](.pdf_temp/viewrange_chunk_1_1_5_1761797659/images/9znnni.jpg)

The figure illustrates common performance metrics (download/upload speed, latency, jitter, packet loss, throughput) used to assess VPN products. While useful for vendor comparisons, these results do not isolate protocol behavior under identical conditions and therefore are not used to draw protocol-level conclusions in this report.[^7]

## Protocol Deep Dive: WireGuard vs OpenVPN (and why self-hosted complements both)

WireGuard and OpenVPN share the goal of secure private connectivity but differ materially in architecture, cryptography, transport, and configuration patterns. These differences drive their fit for scientific workloads.

Table 2 compares key technical attributes.

Table 2. Technical comparison: WireGuard vs OpenVPN

| Attribute                    | WireGuard                                                                 | OpenVPN                                                                                      |
|-----------------------------|---------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| Architecture                | Minimal codebase; Noise-based; cryptokey routing                          | Mature, feature-rich; OpenSSL-based; extensive configuration                                 |
| Codebase size               | ~4,000 lines (kernel module focus)                                        | Hundreds of thousands of lines                                                               |
| Cryptography                | ChaCha20, Poly1305, Curve25519, BLAKE2s, SipHash24, HKDF; fixed suite     | OpenSSL cipher suite flexibility (AES-256, ChaCha20/Poly1305, SHA- families, RSA, etc.)      |
| Handshake                   | ~1.5 RTT; Noise protocol framework                                        | SSL/TLS handshake; configurable                                                              |
| Transport                   | UDP-only                                                                  | UDP or TCP; supports IPv4/IPv6                                                               |
| Key management              | Static public keys; pre-shared keys supported                             | Full PKI with certificates; static key mode available                                        |
| Routing/ACLs                | AllowedIPs define routes and ACLs per peer                                | Flexible routing; supports L2 bridging and complex topologies                                |
| Data handling (default)     | Does not store persistent user data by default                            | Depends on configuration; supports logging and accounting                                     |

Sources: protocol documentation and architecture reviews.[^1][^3][^5]

### WireGuard Fundamentals

WireGuard is built around the Noise protocol framework, with a fixed suite of modern cryptographic primitives—ChaCha20 for encryption, Poly1305 for authentication, Curve25519 for key exchange, BLAKE2s for hashing, SipHash24 for hashtable key identification, and HKDF for key derivation. This conservative, standardized selection reduces configuration complexity and the risk of improper or weak cryptographic choices. The codebase is intentionally small—around four thousand lines—enhancing auditability and lowering the attack surface.[^1][^3]

Configuration resembles SSH-style key exchange. Each peer is identified by a static public key, and routing/access control is defined through AllowedIPs, which simultaneously serve as routes and access control lists. WireGuard roams seamlessly, updating endpoints as clients move across networks, which is particularly valuable for mobile researchers and instruments that switch between Wi‑Fi and cellular. Because the interface is a standard network tunnel, it can be moved into container network namespaces, enabling per-container secure network isolation.[^1]

### OpenVPN Fundamentals

OpenVPN’s hallmark is flexibility. Its OpenSSL foundation supports a broad array of ciphers and authentication modes. It can operate over UDP or TCP, supports IPv4 and IPv6, and can be configured for both routed (Layer 3) and bridged (Layer 2) topologies. While this flexibility increases setup complexity, it enables deployments in environments where transport constraints, legacy devices, or specific compliance requirements dictate non-default cryptographic or routing behavior. Enterprise guidance highlights robust compatibility, integration options (RADIUS/LDAP/SSO), and layered controls that align with regulatory needs.[^3][^6]

### Security & Auditability

WireGuard’s small code footprint and standardized cryptographic suite simplify auditing and reduce opportunities for misconfiguration. Because the protocol avoids storing persistent user data by default, it reduces the risk of inadvertent data retention. OpenVPN’s maturity brings extensive real-world testing and configurable controls; however, flexibility requires disciplined configuration to avoid weak ciphers or insecure patterns.[^3][^5]

### Performance & Transport

WireGuard operates over UDP and completes handshakes in roughly 1.5 round trips, minimizing setup latency. Its reduced overhead often translates to higher throughput and better responsiveness, especially in mobile or roaming scenarios. OpenVPN in UDP mode can approach similar latencies in favorable conditions; TCP mode adds reliability under challenging networks but can incur additional overhead. Selecting UDP vs TCP is therefore a trade-off between speed and resilience in lossy or strictly controlled networks.[^2][^3]

## Performance Evidence

The most directly relevant public data comparing WireGuard and OpenVPN latencies across geographic distances comes from a single comparative analysis. Table 3 reproduces mean latency (ping) measurements from Central Europe to progressively distant regions, showing how transport choices impact responsiveness.[^2]

Table 3. Latency comparison (ms) across distance categories

| Distance Category | OpenVPN TCP | OpenVPN UDP | WireGuard |
|-------------------|-------------|-------------|-----------|
| Nearest gateway   | 73          | 27          | 28        |
| +1 time zone      | 165         | 57          | 58        |
| +2 time zones     | 183         | 107         | 98        |
| +3 time zones     | 161         | 141         | 114       |
| +5 time zones     | 194         | 146         | 119       |
| +10 time zones    | 456         | 373         | 331       |
| +12 time zones    | 834         | 412         | 407       |

These results suggest that WireGuard and OpenVPN UDP perform similarly at shorter distances, with WireGuard maintaining a more consistent advantage as distance increases. OpenVPN TCP exhibits substantially higher latency, reflecting TCP-over-TCP overhead and conservative behavior under adverse conditions.[^2] In scientific data transfers, such latency differences compound over long-haul routes and can materially affect throughput and user experience.

To situate performance in a broader testing context, Figure 2 shows a representative chart from an independent benchmark report that illustrates the metrics and layout commonly used in VPN evaluations. We use it purely to illustrate methodology and avoid drawing protocol-level conclusions from vendor product data.[^7]

![Representative benchmark visualization (PassMark); used to illustrate testing scope and metrics.](.pdf_temp/viewrange_chunk_1_1_5_1761797659/images/b0ix2w.jpg)

Information gaps and caveats:
- Published, protocol-specific throughput benchmarks under controlled, reproducible conditions remain sparse; most public data either compares vendor implementations or mixes transport/context variables. This report therefore relies on latency comparisons and architectural evidence to inform performance expectations.[^2][^7]
- Concurrency capacity numbers for self-hosted deployments are highly environment-dependent; they typically require application-specific load testing to validate. We provide design guidance rather than absolute capacity claims.

## Self-Hosted Options for Scientific Use

WireGuard and OpenVPN meet most needs, but scientific teams frequently encounter restrictive networks, legacy environments, or the need for protocol diversity on a single platform. Self-hosted solutions address these gaps.

Table 4 compares selected self-hosted options and their practical attributes.[^4]

Table 4. Self-hosted comparison

| Solution          | Protocol(s)                        | Firewall Traversal             | NAT Traversal           | Management/Ease          | Notable Features                                                                 |
|-------------------|------------------------------------|--------------------------------|-------------------------|--------------------------|----------------------------------------------------------------------------------|
| OpenConnect       | Cisco AnyConnect (open-source)     | Strong (HTTPS-based; DPI-resistant) | Via server configuration | Admin console; RADIUS    | Virtual hosting; accounting; AnyConnect client parity across OS; fast and lightweight |
| SoftEtherVPN      | OpenVPN, L2TP, IPsec, SSTP, SoftEther | Strong via SSTP; VPN over ICMP/DNS | Enabled by default       | HTML5 admin console      | Multi-protocol on one server; ICMP/DNS tunneling; stable SSTP; broad OS support        |
| OpenVPN (self-host) | OpenVPN                            | Good (UDP/TCP; can use 443)    | Supported               | Mature tooling           | PKI; tun/bridge; RADIUS accounting; scalable to hundreds/thousands                 |
| WireGuard (self-host) | WireGuard                         | Good (UDP; configurable port)  | Supported               | Simple tooling           | Key-based auth; mobile roaming; container integration                              |

OpenConnect is well-suited to environments requiring stealth against deep packet inspection or where port 443 is preferred for parity with HTTPS. SoftEtherVPN’s ability to present multiple protocols (including SSTP and VPN-over-ICMP/DNS) helps in networks that block conventional transports. Note that some combinations cannot run simultaneously on the same server due to port conflicts (e.g., OpenConnect and SoftEther both competing for TCP 443), reinforcing the value of deploying protocol-specialized servers side by side rather than forcing a single platform to cover all scenarios.[^4]

## Client Compatibility and Ecosystem

Compatibility often dictates operational feasibility across heterogeneous research teams. OpenVPN’s longer history translates into broad support across operating systems, routers, and firewalls; WireGuard’s support is now strong across major desktop and mobile platforms but remains thinner in router/firewall ecosystems. Enterprise platforms and documentation emphasize compatibility assessments during solution selection.[^2][^3]

Table 5 summarizes client and platform compatibility.

Table 5. Client/platform compatibility matrix

| Platform/OS      | WireGuard Support                         | OpenVPN Support                            |
|------------------|-------------------------------------------|--------------------------------------------|
| Linux            | Native kernel and user space              | Broadly supported                          |
| Windows          | Supported (native-like experience)        | Broadly supported                          |
| macOS            | Supported                                  | Broadly supported                          |
| iOS/Android      | Supported                                  | Broadly supported                          |
| BSD variants     | Supported                                  | Broadly supported                          |
| Routers/Firewalls| Fewer current integrations                | Extensive legacy and enterprise support     |

While WireGuard’s router support is improving, deployments depending on consumer-grade routing/firewall appliances will find OpenVPN’s support more accessible. Scientific institutions with mixed device fleets and network appliances should factor this into their protocol selection, especially when standardized client deployment is a requirement.[^2]

## Deployment Patterns for Multi-User Scientific Environments

For concurrent scientific users, deployment should prioritize performance, observability, and resilience:

- Single-protocol high-performance pattern: A WireGuard server tuned for high throughput, providing simple, secure access to data enclaves and instrument networks. Its key-based configuration and container readiness simplify secure access for research groups and workloads that benefit from per-namespace isolation.[^1]
- Dual-protocol resilience pattern: WireGuard for performance and OpenVPN for compatibility and advanced controls. Teams can fail over or steer clients based on device capabilities or network constraints, avoiding single points of protocol failure.[^2][^3]
- Stealth/firewall traversal pattern: OpenConnect (AnyConnect) as the primary access path under restrictive networks, complemented by WireGuard for throughput within allowed paths. SoftEtherVPN can provide alternative transports (SSTP, ICMP, DNS) for environments where even OpenConnect is throttled.[^4]
- Enterprise integration: Centralized management, integration with directory services (LDAP/AD), MFA, RADIUS accounting, logging to SIEM, segmentation, and HA/failover procedures—all highlighted in enterprise VPN guidance—are essential to multi-user scientific deployments.[^6]

Table 6 maps common scientific constraints to recommended patterns.

Table 6. Pattern-to-use-case mapping

| Constraint/Goal                                   | Recommended Pattern                              | Rationale                                                           |
|---------------------------------------------------|--------------------------------------------------|---------------------------------------------------------------------|
| Maximize throughput for bulk data transfer        | WireGuard-only                                    | Lower overhead, mobile-friendly, fast handshake                      |
| Mixed device fleet and legacy network appliances  | Dual-protocol (WireGuard + OpenVPN)              | Optimize performance where possible; fall back to OpenVPN compatibility |
| Strict DPI/firewall blocking VPNs                 | OpenConnect-centric (+ WireGuard where feasible)  | HTTPS-based stealth; AnyConnect client parity across OS              |
| Instruments behind NAT with no port forwarding    | SoftEtherVPN (with NAT traversal)                | Built-in NAT traversal; VPN-over-ICMP/DNS fallback                   |
| HA and segmentation with audit requirements       | OpenVPN with enterprise integration               | RADIUS/LDAP/SSO; segmentation; rich logging                          |

## Security Architecture and Controls

Security posture must balance ease of use with rigor:

- WireGuard’s minimal attack surface and standardized crypto reduce misconfiguration risks and simplify audits. Its default non-retention of persistent user data is aligned with data minimization principles.[^1][^3][^5]
- OpenVPN’s flexibility is an asset only when governed by strict cryptographic policies and hardened configurations. Its maturity and extensive controls make it well-suited to regulated or complex environments.[^3][^6]
- Enterprise controls—AES-256 encryption, MFA, segmentation, Zero Trust integration, centralized logging, and device posture checks—should be mapped to institutional policies. Policy enforcement and observability matter as much as protocol selection.[^6]

Table 7 provides a checklist for hardening and policy alignment.

Table 7. Security features checklist

| Feature/Control              | WireGuard                        | OpenVPN                           | Enterprise Considerations                         |
|-----------------------------|----------------------------------|-----------------------------------|---------------------------------------------------|
| Strong encryption           | Fixed modern suite               | Configurable via OpenSSL          | Mandate AES-256 or equivalent                     |
| Forward secrecy             | Yes (PFS)                        | Yes (with modern key exchange)    | Enforce PFS; review cipher suites                 |
| Downgrade resistance        | High (fixed suite)               | Depends on config                 | Disable weak/legacy ciphers                       |
| Auditability                | High (small codebase)            | Moderate (large codebase)         | Code audits; configuration baselines              |
| Data retention (default)    | Minimal by design                | Configurable                      | Limit logs; align with privacy policies           |
| MFA/directory integration   | External (e.g., portal/gateway)  | Native/adjacent (RADIUS/SSO)      | Integrate with LDAP/AD and SIEM                   |
| Segmentation                | Via routing/ACLs                 | Via routes/bridges/policies       | Apply least privilege per group/project           |
| ZTNA alignment              | App-level via policy             | App-level via policy              | Continuous verification, device posture checks    |

Sources: protocol specifications and enterprise guidance.[^1][^3][^6]

## Decision Matrix and Recommendations

The final decision hinges on workload characteristics, network constraints, and institutional controls. Table 8 provides a weighted decision matrix to guide selection.

Table 8. Weighted decision matrix (illustrative)

| Criterion                 | Weight | WireGuard Score | OpenVPN Score | OpenConnect/SoftEther Score |
|--------------------------|--------|------------------|---------------|-----------------------------|
| Throughput/performance   | 30%    | 9                | 7             | 8 (OpenConnect) / 7 (SoftEther) |
| Setup complexity         | 20%    | 9                | 6             | 7                           |
| Security posture         | 20%    | 9                | 8             | 8                           |
| Compatibility            | 20%    | 7                | 9             | 8                           |
| Stealth/traversal        | 10%    | 7                | 7             | 9 (OpenConnect/SoftEther)   |
| Weighted total (100%)    | —      | 8.2              | 7.6           | 7.9                         |

Recommended default posture:
- Primary: WireGuard for performance-centric scientific transfers and mobile/instrument roaming, backed by enterprise controls (MFA, segmentation, logging).
- Compatibility and regulated environments: OpenVPN for its flexible transport, mature integrations, and extensive device support.
- Resilience under restrictive networks: OpenConnect (AnyConnect) for stealth; SoftEtherVPN for multi-protocol fallback or NAT traversal. Deploy protocol-specialized servers side by side to avoid port conflicts and maximize path diversity.[^1][^2][^3][^4][^6]

This multi-protocol stance ensures that performance, compatibility, and resilience are not mutually exclusive—scientific teams can steer clients based on context without compromising security or usability.

## Implementation Checklist and Operational Runbook

A pragmatic implementation plan reduces risk and accelerates adoption:

Table 9. Implementation checklist

| Task Area              | Key Actions                                                                              |
|-----------------------|--------------------------------------------------------------------------------------------|
| Planning              | Define user populations and concurrency targets; select protocol patterns per site         |
| Addressing            | Allocate IP ranges for tunnels; define route aggregation and AllowedIPs (WireGuard)        |
| Authentication        | Choose identity source (LDAP/AD/RADIUS); enable MFA; configure certificate lifecycle (OpenVPN) |
| Security hardening    | Enforce strong ciphers; disable legacy suites; set logging retention and audit cadence     |
| Firewall rules        | Open required ports (UDP for WireGuard/OpenVPN; TCP 443 for OpenConnect/SSTP); test paths |
| Routing/ACLs          | Apply least privilege segmentation; integrate with ZTNA policies                           |
| HA/failover           | Deploy redundant gateways; test failover recovery (target <60 seconds)                     |
| Monitoring            | Forward logs to SIEM; track latency/jitter; monitor throughput and concurrent sessions     |
| Client rollout        | Provide platform-specific installers; document connection procedures                        |
| Compliance            | Document policies; perform periodic audits; validate device posture checks                 |

These operational practices align with enterprise VPN guidance on scaling, HA/failover, and security integration. They ensure multi-user scientific deployments remain reliable, observable, and maintainable over time.[^6]

## Appendix

### A. Cryptographic primitives and roles

Table 10. Primitive mapping

| Primitive   | Role                                         | WireGuard Usage                         | OpenVPN Typical Usage                          |
|-------------|----------------------------------------------|-----------------------------------------|------------------------------------------------|
| ChaCha20    | Stream encryption                            | Primary cipher                          | Available via OpenSSL                          |
| Poly1305    | AEAD authentication                          | Authentication                          | Available via OpenSSL                          |
| Curve25519  | Elliptic-curve key exchange                  | ECDH (Noise)                            | ECDHE via OpenSSL                              |
| BLAKE2s     | Hashing                                      | Hash and KDF                            | Available via OpenSSL                          |
| SipHash24   | Hashtable key authentication                 | Identifiers                             | Not typical                                    |
| HKDF        | Key derivation                               | Derivation                              | Available via OpenSSL                          |
| AES-256     | Block cipher                                 | Not used by default                     | Common choice via OpenSSL                      |

Sources: protocol documentation and technical comparisons.[^1][^3][^5]

### B. Glossary

- Cryptokey Routing: WireGuard’s model of associating public keys with AllowedIPs to act as both routes and ACLs.[^1]
- ZTNA (Zero Trust Network Access): An access model emphasizing continuous verification, device posture checks, and application-level authorization rather than implicit network trust.[^6]
- PFS (Perfect Forward Secrecy): Property that ensures compromise of one key does not compromise past session keys; supported by both WireGuard and OpenVPN under modern configurations.[^3][^5]
- DPI (Deep Packet Inspection): Network analysis technique used to detect and filter traffic; OpenConnect’s HTTPS-based transport resists DPI in restrictive environments.[^4]
- HA (High Availability): System design to ensure continuous operation, typically via redundant gateways and tested failover.[^6]

### C. Latency dataset references

All latency figures in Table 3 are sourced from a comparative analysis measuring mean ping latency across distance categories from a single origin (Central Europe) with consistent methodologies for each protocol and transport.[^2]

### D. Image credits

All figures in this report are included for methodological illustration and context only. The PassMark benchmark charts are representative visualizations of testing scope and are not used to draw protocol-specific conclusions.[^7]

![Appendix figure: Additional benchmark visualization (contextual illustration).](.pdf_temp/viewrange_chunk_2_6_10_1761797659/images/pxjbc8.jpg)

---

## References

[^1]: WireGuard: fast, modern, secure VPN tunnel. https://www.wireguard.com/

[^2]: OpenVPN vs WireGuard: Top Two VPN Protocols Side By Side. https://www.goodaccess.com/blog/openvpn-vs-wireguard

[^3]: WireGuard vs. OpenVPN | What Are the Differences? https://www.paloaltonetworks.com/cyberpedia/wireguard-vs-openvpn

[^4]: 5 Best Self-hosted VPN/Proxy Solutions in 2024. https://www.linuxbabe.com/vpn/best-self-hosted-vpn-proxy-solutions

[^5]: OpenVPN vs. WireGuard Comparison. https://www.zenarmor.com/docs/network-security-tutorials/openvpn-vs-wireguard

[^6]: Enterprise VPN Solutions - Security, Control, and Flexibility at Scale. https://www.fortinet.com/resources/cyberglossary/enterprise-vpn-solutions

[^7]: VPN Products Performance Benchmarks (Edition 1) - PassMark Software. https://www.passmark.com/reports/VPN_Products_Performance_Benchmarks_2023_Ed1.pdf