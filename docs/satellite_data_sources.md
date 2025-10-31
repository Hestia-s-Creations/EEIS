# Automated Satellite Data Acquisition for Landsat 8/9 and Sentinel‑2: APIs, Authentication, Formats, and Workflows

## Executive Summary

Machine-to-machine access to open Earth observation (EO) data has matured into a robust, production-ready capability across public and commercial platforms. For Landsat 8/9 and Sentinel‑2, teams can now build end‑to‑end pipelines that automatically discover, order, and download products; integrate cloud‑native retrieval; and apply analysis‑ready processing with minimal manual intervention. This report provides an engineering‑focused guide to the primary access pathways—USGS EarthExplorer’s Machine‑to‑Machine (M2M) API, the Copernicus Data Space Ecosystem (CDSE) Streamlined Data Access (SDA) and OData APIs, and the Sentinel Hub APIs—alongside cloud object storage and catalog routes via AWS Open Data and Microsoft’s Planetary Computer.

Key findings:
- USGS EarthExplorer M2M API has transitioned to application token authentication via a “login-token” endpoint, replacing the legacy “login” endpoint which is deprecated as of February 26, 2025. This change affects all automated login flows and requires provisioning tokens and updating client code to the new endpoint. The API remains the authoritative path to USGS archive ordering and download URLs for Landsat collections. [^1] [^2] [^3]
- Copernicus Data Space Ecosystem offers SDA and OData APIs for search and download of Sentinel‑2 L1C and L2A products, with the Sentinel Hub Process/Batch APIs providing on‑the‑fly rendering and analytics without full product downloads. Authentication is account‑based via CDSE, with the specific token flow documented in the platform’s API guides. [^4] [^6] [^7] [^8]
- AWS Open Data provides cloud‑native access to both USGS Landsat and Sentinel‑2 archives using requester‑pays S3, STAC catalogs, and SNS notifications. This route is cost‑aware, scalable, and enables event‑driven ingestion. The S2 zipped archives have a short retention window (three days), which must be accounted for in pipeline design. [^11] [^12]
- Microsoft Planetary Computer exposes a public STAC API for cross‑catalog discovery and supports data access via signed URLs and Azure-native patterns. Authentication is required for certain actions, with detailed guidance in the platform’s documentation. [^13] [^14] [^15] [^16]
- Landsat Collection 2 Level‑1 (L1) and Level‑2 (L2) products are distributed as Cloud‑Optimized GeoTIFFs (COGs), enabling HTTP range reads and cloud‑native analytics. Sentinel‑2 products are delivered in SAFE containers with JPEG2000 band images, with L2A providing surface reflectance and scene classification layers. [^9] [^19] [^21] [^22] [^23]
- Operational recommendations include using SNS‑triggered Lambdas for event‑driven downloads, STAC‑first discovery to filter by space/time/properties before requesting assets, COG streaming and overviews to minimize transfer volumes, and selective band retrieval versus whole product downloads depending on use case. Rate‑limit awareness and retry/backoff should be built into all clients. [^11] [^12]

Risks and considerations:
- Requester pays charges on AWS require budgeting and monitoring to prevent unexpected costs.
- CDSE and Sentinel Hub quotas and rate limits may apply but are not fully enumerated here; design clients to be adaptive.
- Landsat and Sentinel‑2 product sizes vary by level and band selection; pipelines should estimate volumes and avoid unnecessary full‑scene transfers when only subsets are needed.
- Zipped Sentinel‑2 archives on AWS are short‑lived; do not rely on them for long‑term staging. [^12]

The implementation section provides an end‑to‑end pipeline blueprint combining USGS M2M and CDSE/Sentinel Hub for search/order/download, AWS STAC/S3 for cloud‑native retrieval, and Planetary Computer for federated discovery and access. [^1] [^4] [^11] [^13]

## Scope, Objectives, and Data Coverage

This report focuses on automated acquisition of Landsat 8/9 and Sentinel‑2 L1C/L2A products for production‑grade geospatial pipelines. The primary data access modalities covered include:

- USGS EarthExplorer M2M API for discovery, search, ordering, and download URL retrieval of Landsat collections.
- Copernicus Data Space Ecosystem (CDSE) APIs—SDA and OData—for Sentinel‑2 search and download; Sentinel Hub Process/Batch APIs for rendered products and analytics.
- Cloud and federated catalogs: AWS Open Data for Landsat and Sentinel‑2 (S3, STAC, SNS), and Microsoft Planetary Computer (STAC API and Data API).
- Open‑source Python clients for automation (e.g., Sentinelsat).

Landsat 8/9 missions deliver reflective and thermal bands, with Collection 2 L1 products provided as digital numbers (DN) in unsigned 16‑bit COGs and L2 products providing surface reflectance and derived science products. Typical scene downloads include multiple bands plus metadata and browse images. [^9] [^10] Sentinel‑2 L1C provides top‑of‑atmosphere reflectance, while L2A provides bottom‑of‑atmosphere (surface reflectance) with added scene classification and auxiliary maps. Products are distributed in SAFE format with JPEG2000 imagery. [^19] [^21] [^22] [^23]

Automation objectives include:

- Account‑based authentication and token lifecycle management for USGS and CDSE/Sentinel Hub.
- API discovery and search filters for area of interest (AOI), date/time, cloud cover, and quality criteria.
- Order/download flows (USGS M2M) and direct retrieval (CDSE OData/SDA, AWS S3).
- Cloud‑native access patterns using STAC catalogs, signed URLs, and HTTP range requests on COGs.
- Operational workflows for atmospheric correction and formatting into analysis‑ready outputs.

## Access Pathways Overview

A modern program should treat multiple access pathways as interchangeable tools, selecting the best route for each task: authoritative archive ordering via USGS M2M for Landsat; SDA/OData and Sentinel Hub for Sentinel‑2; AWS S3/STAC/SNS for event‑driven, cloud‑native retrieval; and Planetary Computer as a discovery and access layer that spans catalogs.

To illustrate trade‑offs, Table 1 compares USGS EarthExplorer M2M, CDSE SDA/OData, Sentinel Hub APIs, AWS Open Data (S3/STAC/SNS), and Planetary Computer across authentication, endpoints, formats, rate limits, cost model, and best‑fit use cases.

Table 1. Comparative view of access pathways

| Provider | Authentication | Core Endpoints | Data Formats | Typical Rate Limits | Cost Model | Typical Use Cases | Pros | Cons |
|---|---|---|---|---|---|---|---|---|
| USGS EarthExplorer M2M | Account + application token via “login-token”; legacy “login” deprecated Feb 26, 2025 | JSON-based M2M endpoints for collections, search, orders, download | Landsat C2 L1/L2 COGs; scene metadata, QA, browse | Not specified in collected sources | No-cost downloads; no egress fees from USGS; cloud access via AWS is requester pays | Authoritative archive ordering; consistent metadata; operational pipelines | Official USGS API; mature ordering; COG delivery | Requires token migration; legacy deprecation; download flow more steps than direct object retrieval | 
| CDSE SDA/OData | CDSE account; token-based auth | SDA (Streamlined) and OData for search/download | Sentinel‑2 SAFE (L1C/L2A), JP2 bands | Not fully enumerated in collected sources | No-cost data access; platform-specific rate limits may apply | Direct programmatic retrieval from Copernicus; integration with Sentinel Hub | Official ESA route; uniform metadata; strong L2A support | Rate limits unspecified; evolving APIs require client updates |
| Sentinel Hub APIs | Account; token-based auth | Process API, Batch Processing API | Rendered images; statistics; on‑the‑fly analytics; raw data access | Platform-enforced quotas | No-cost catalog access; service plans for heavy use | Subset/coverage analytics; avoid full product downloads | Fast analytics; minimized data transfer | Not a replacement for archive download; quotas apply |
| AWS Open Data (Landsat/S2) | AWS account for requester pays; public STAC | S3 object retrieval; STAC catalogs; SNS topics | COGs (Landsat); SAFE/JP2 (S2); S3 inventory files | API‑agnostic; throughput depends on S3 | Requester pays for egress and requests | Cloud‑native pipelines; event‑driven ingestion via SNS | Highly scalable; catalog + events; COG streaming | Requester pays; S2 zip retention short (3 days) | 
| Planetary Computer | Account for certain actions; public STAC | STAC API; Data API with signed URLs | Analysis‑ready datasets; STAC assets | Public STAC; signed URL access for bulk | Azure‑hosted; access is public; account needed for certain workflows | Federated discovery; access to curated collections | Unified catalog; cloud‑native analytics | Requires understanding of Azure auth; dataset coverage varies by collection |

USGS M2M provides authoritative programmatic access to the Landsat archive, while CDSE and Sentinel Hub are the primary routes for Sentinel‑2 and analytics. AWS Open Data enables cloud‑native, event‑driven access, and Planetary Computer offers a STAC‑first discovery layer and data access with signed URLs. [^1] [^4] [^7] [^11] [^12] [^13]

## USGS EarthExplorer Machine‑to‑Machine (M2M) API

USGS EarthExplorer’s M2M API mirrors the functionality of the web interface and is the canonical programmatic channel for Landsat collection discovery, scene search, ordering, and retrieval of download URLs. Teams building automated pipelines should treat M2M as the authoritative source for USGS archive operations and integrate its lifecycle around application token management and endpoint transitions.

Authentication changes and migration
- USGS has introduced application token authentication via the “login-token” endpoint, replacing the legacy “login” endpoint which was deprecated on February 26, 2025. Applications must be updated to use the new token endpoint and to manage token lifecycles. Token provisioning and secure handling are now integral to M2M clients. [^1] [^2] [^3]

Core API capabilities
- Collections: List and select appropriate Landsat collections (e.g., Collection 2 Level‑1 and Level‑2).
- Search: Query scenes by AOI, date/time, cloud cover, and metadata filters; evaluate processing tiers (T1/T2/RT) based on quality and geometry needs.
- Orders: Place orders for selected scenes and retrieve download URLs; integrate retry/backoff and session handling.
- Download: Use obtained URLs to fetch products and metadata; in cloud contexts, prefer COG streaming to reduce transfer volumes.

Table 2 maps M2M endpoints to typical client operations.

Table 2. USGS M2M endpoint‑to‑operation mapping

| Client Operation | M2M Endpoint Category | Notes |
|---|---|---|
| Authenticate | login-token | Use application token; legacy “login” deprecated (Feb 26, 2025). [^1] |
| Discover collections | collections | Enumerate Landsat collections and products. [^3] |
| Search scenes | search | Filter by AOI, date, cloud, processing tier; paginate results. [^3] |
| Place order | order | Request download URLs for selected scenes. [^3] |
| Retrieve URLs | order or status | Poll status until URLs are available. [^3] |
| Download | download URL (HTTP(S)) | Use provided URLs; implement retry and checksum if available. [^3] |

Data delivery and formats
- Landsat Collection 2 Level‑1 and Level‑2 products are delivered as Cloud‑Optimized GeoTIFFs (COGs). Level‑1 bands are stored as digital numbers (DN) in unsigned 16‑bit format, with metadata and QA bands. Level‑2 products include surface reflectance and other science products; COG delivery enables HTTP range reads and cloud‑native processing. [^9] [^10]
- Typical scene bundles include multiple spectral bands, angle coefficient files, solar and sensor angle files, QA bands, browse images, and metadata in MTL and XML formats. [^9]

Practical automation guidance
- Build robust search and ordering flows that treat the “login-token” transition as a required migration.
- Persist scene metadata and QA criteria to support downstream filtering.
- Where cloud workflows are appropriate, consider AWS Open Data for S3‑native retrieval and event‑driven ingestion to complement M2M ordering. [^11]

Table 3. Landsat Collection 2 delivery artifacts (typical)

| Artifact | Purpose |
|---|---|
| Spectral band COGs (DN, unsigned 16‑bit) | Primary imagery; cloud‑optimized for range reads. [^9] |
| Angle coefficient and solar/sensor angle files | Supports illumination geometry and corrections. [^9] |
| QA bands (pixel quality, radiometric saturation, terrain occlusion) | Quality screening for time series and analytics. [^9] |
| Browse images (reflective, thermal, quality) | Quicklooks and validation. [^9] |
| Metadata (MTL, XML) | Radiometric scaling, scene identifiers, processing details. [^9] |

## Copernicus Data Space Ecosystem (CDSE) and Sentinel Hub APIs

CDSE provides streamlined and OData APIs for programmatic discovery and retrieval of Sentinel‑2 L1C and L2A products. It unifies access to ESA’s Copernicus missions and is paired with Sentinel Hub’s Process and Batch APIs for rendered imagery, statistics, and analytics without requiring full product downloads. Together, these services support two complementary patterns: (1) archive retrieval of SAFE products and (2) on‑the‑fly processing tailored to application needs.

CDSE SDA/OData APIs
- SDA offers intuitive endpoints for searching and retrieving Sentinel‑2 products, while OData provides a flexible protocol for querying and accessing catalog entries. Both support filtering by geometry, time window, and processing level. Authentication is account‑based with token flows documented in CDSE guides. [^4]
- Sentinel‑2 L1C delivers top‑of‑atmosphere reflectance; L2A delivers bottom‑of‑atmosphere (surface reflectance) along with scene classification (SCL), aerosol optical thickness (AOT), and water vapour (WV) maps. [^19] [^21] [^22] [^23]

Sentinel Hub APIs
- The Process API enables requests for rendered images and statistics over AOIs and time ranges; the Batch Processing API scales these operations for larger jobs. These APIs are useful when the output can be derived without downloading entire products, reducing bandwidth and storage demands. [^7] [^8]
- Sentinel Hub’s data documentation for Sentinel‑2 L1C and L2A clarifies band availability, processing levels, and usage patterns. [^21] [^22]

AWS alternative route
- Sentinel‑2 is also available on AWS Open Data with STAC catalogs, requester‑pays S3 buckets, and SNS notifications for new products. This route supports event‑driven, cloud‑native pipelines, with caveats such as short retention windows for zipped archives. [^12]

Open‑source client
- Sentinelsat is a Python library that simplifies search and download of Sentinel products from Copernicus hubs, including CDSE/OData backends. It is useful for quickly scripting AOI‑based filtering, pagination, and bulk downloads. [^25]

Table 4 summarizes the main Sentinel‑2 access APIs and practical use cases.

Table 4. Sentinel‑2 access APIs and usage

| API | Capabilities | Auth | Typical Usage |
|---|---|---|---|
| CDSE SDA | Streamlined search and retrieval; integrates with CDSE catalog | CDSE account; token | Programmatic discovery and download of L1C/L2A SAFE products. [^4] |
| CDSE OData | Protocol‑based querying and access of catalog items | CDSE account; token | Flexible filtering and retrieval via OData endpoints. [^4] |
| Sentinel Hub Process | Rendered outputs, statistics, analytics | Account; token | On‑the‑fly imagery and summaries without full downloads. [^7] [^8] |
| Sentinel Hub Batch | Scaled batch jobs | Account; token | Bulk analytics and time series generation. [^7] |
| AWS S3/STAC | Cloud‑native retrieval; event triggers via SNS | AWS account; requester pays | Event‑driven ingestion; COG/JP2 streaming; cost-aware design. [^12] |
| Sentinelsat (Python) | Simplified search/download client | Hub account | Rapid scripting of AOI/time filters and bulk downloads. [^25] |

Table 5 compares Sentinel‑2 L1C and L2A for engineering decisions.

Table 5. Sentinel‑2 L1C vs L2A (selected characteristics)

| Attribute | L1C | L2A |
|---|---|---|
| Processing level | Top‑of‑atmosphere reflectance | Bottom‑of‑atmosphere (surface reflectance) |
| Product format | SAFE directory with JP2 band images | SAFE directory with JP2 band images plus SCL, AOT, WV maps |
| Quantification | DN to TOA reflectance via metadata offsets | DN to BOA/Surface reflectance via metadata offsets; supports negative reflectances |
| Additional outputs | Quality masks and auxiliary data | Scene Classification (SCL), AOT, WV; CEOS ARD compliant at threshold |
| Availability timeline | Global since 2015 (mission dependent) | Global since December 2018 (operational rollout varied regionally) |

These distinctions drive downstream choices: L2A is preferable for most quantitative analyses involving surface reflectance, while L1C may be sufficient for workflows that perform their own atmospheric correction or only need TOA reflectance. [^19] [^21] [^22] [^23]

## Cloud and Federated Catalogs: AWS Open Data and Microsoft Planetary Computer

Cloud‑native access patterns reduce infrastructure burden and improve scalability by moving computation to the data. For geospatial workflows, this means using object storage, STAC catalogs, and event notifications to create pipelines that react to new acquisitions without manual intervention.

AWS Open Data: Landsat and Sentinel‑2
- USGS Landsat on AWS exposes scenes and metadata on S3 (requestor‑pays), with STAC catalogs for discovery and SNS topics for notifications of newly available scenes and products. Data are updated daily. [^11]
- Sentinel‑2 on AWS offers L1C/L2A buckets, STAC endpoints, S3 inventory files (ORC/CSV) for cataloging, and SNS topics for new product notifications. Zipped archives for each product have a three‑day retention window. Access is requester‑pays. [^12]

Microsoft Planetary Computer
- Planetary Computer provides a public STAC API for searching datasets by space, time, and properties. The Data API supports signed URL access patterns and Azure‑native workflows. The catalog spans petabytes of environmental data in analysis‑ready formats. [^13] [^14] [^15] [^16]

Comparison and recommended roles
- Use AWS Open Data when you want cloud‑native ingestion and event‑driven pipelines for Landsat/Sentinel‑2, with cost awareness and COG/JP2 streaming. Use Planetary Computer when you need federated discovery across many datasets and Azure‑integrated workflows.
- Both AWS and PC reduce the need to operate archival storage if your analysis can be performed in the cloud; choose based on your compute environment and cost model.

Table 6 summarizes AWS resources relevant to automation.

Table 6. AWS resource summary for Landsat and Sentinel‑2

| Dataset | Buckets/Endpoints | Access Model | Discovery | Notifications | Retention Notes |
|---|---|---|---|---|---|
| Landsat (USGS) | S3: usgs‑landsat/collection02/ | Requester pays | STAC server; AWS Data Exchange | SNS topics for new scenes (L1/L2, L3, ARD tiles) | N/A (standard object storage) |
| Sentinel‑2 L1C/L2A | S3: sentinel‑s2‑l1c/, sentinel‑s2‑l2a/; STAC endpoints | Requester pays | STAC catalogs; S3 inventory (ORC/CSV) | SNS topics for L1C and L2A new products | Zipped archives retained for 3 days |

These cloud routes are best combined with STAC‑first discovery to minimize unnecessary asset retrieval and to enable selective band or tile access where feasible. [^11] [^12]

## Data Formats and Volume Implications

Engineering choices around formats drive bandwidth, storage, and compute costs. Landsat and Sentinel‑2 have different delivery formats that shape pipeline design.

Landsat Collection 2 COGs
- Landsat C2 L1 and L2 products deliver spectral bands as COGs, enabling HTTP range reads and cloud‑native analytics without full file downloads. Level‑1 data are DN in unsigned 16‑bit, with metadata, QA bands, angle files, and browse images included in typical scene packages. [^9] [^10]
- COG overviews and internal tiling permit efficient windowed reads and partial processing, which is critical for large‑scale, recurrent workflows.

Sentinel‑2 SAFE/JP2
- Sentinel‑2 products are delivered as SAFE directories containing JPEG2000 (JP2) band images, quality masks, and metadata. L2A adds scene classification and auxiliary maps. JP2’s compression reduces storage and download sizes but requires careful I/O strategies for partial reads and reprojection. [^19] [^21] [^23]
- SAFE structure organizes content into GRANULE (tile‑level imagery and masks), DATASTRIP (datastrip metadata), and AUX_DATA folders, with XML manifests describing product organization. [^23]

Band selection strategies
- For Landsat, many analyses can be satisfied with a subset of reflective bands (e.g., visible, red edge, NIR, SWIR) plus QA bands for screening; thermal bands may be included when needed. For Sentinel‑2, selection among 10 m/20 m/60 m bands should reflect the application’s spatial requirements and tolerance for I/O overhead.
- Where COG assets are available (Landsat), streaming subsets of bands for AOIs avoids full scene downloads. For SAFE/JP2, consider whether a full tile download is necessary or if a processed subset can be obtained via Sentinel Hub Process API.

Table 7 compares key format features across missions.

Table 7. Format comparison and pipeline implications

| Attribute | Landsat C2 (L1/L2) | Sentinel‑2 (L1C/L2A) |
|---|---|---|
| Container | Individual COG assets plus metadata | SAFE directory structure |
| Band format | COG (GeoTIFF), DN (unsigned 16‑bit) | JP2 images; quantification via metadata |
| Internal tiling/overviews | Yes (COG) | JP2 tiles; partial reads possible but less cloud‑optimized than COGs |
| Metadata | MTL/XML; QA, angles, browse | XML manifests; quality masks; SCL/AOT/WV for L2A |
| Partial reads | Efficient via HTTP range and overviews | Feasible but I/O‑intensive; consider API‑rendered outputs |
| Conversion | L1 DN to TOA/radiance via scaling; L2 SR ready for analysis | L1C TOA; L2A BOA/Surface reflectance; SCL aids masking |

Table 8 outlines typical delivery artifacts by mission/level.

Table 8. Typical artifacts per product

| Mission/Level | Bands | Masks/QA | Angles | Metadata | Browse |
|---|---|---|---|---|---|
| Landsat C2 L1 | Spectral bands as COGs | QA bands (pixel quality, saturation, terrain occlusion) | Angle coefficients; solar/sensor angles | MTL/XML | Reflective/thermal/quality browse |
| Landsat C2 L2 | Surface reflectance and science COGs | QA/derived layers | As above | MTL/XML | Browse images |
| Sentinel‑2 L1C | JP2 bands at 10/20/60 m | Quality masks (cloud, detector footprint) | Auxiliary ECMWF/CAMS | SAFE manifest + XML | TCI (true color) JP2 |
| Sentinel‑2 L2A | JP2 bands + SCL, AOT, WV | Scene classification, quality masks | Auxiliary as above | SAFE manifest + XML | TCI JP2 |

These format details matter most when designing partial reads and cloud‑aware workflows: COGs support “pay for what you read” patterns; SAFE/JP2 often benefits from API‑rendered outputs or selective tile retrieval. [^9] [^19] [^21] [^23]

## Bandwidth, Rate Limits, and Cost Considerations

Production pipelines must budget for throughput, rate limits, and egress costs. The platforms considered impose different cost models and constraints.

Cost models
- USGS EarthExplorer M2M: No‑cost downloads from USGS; no egress fees when served by USGS. Cloud‑hosted Landsat via AWS Open Data is requester‑pays, so data transfer and requests incur costs. [^11]
- AWS Open Data for Sentinel‑2 and Landsat: Requester‑pays S3 access applies. SNS notifications and STAC catalogs are public. [^11] [^12]
- Microsoft Planetary Computer: Public STAC API and documentation; signed URL access patterns for bulk downloads. Account requirements apply for certain workflows. [^13] [^14] [^16]

Rate limits
- USGS M2M: Specific rate limits are not enumerated in the collected sources; design clients to be polite with exponential backoff and pagination.
- CDSE/Sentinel Hub: Platform quotas exist but are not fully enumerated here; rely on service guidance and implement adaptive throttling.
- Commercial example (Planet Labs Data API): Activation at ~2 requests/sec; download/search endpoints ~5 requests/sec; other endpoints up to ~10 requests/sec. This illustrates typical rate‑limit planning and client throttling in production. [^26]

Throughput planning
- Optimize with partial reads and band subsets.
- Prefer cloud‑native analytics (e.g., COG streaming, Sentinel Hub Process API) to reduce transfer volumes.
- Schedule bulk orders and SNS‑triggered processing during off‑peak windows.
- Use STAC filters to minimize irrelevant assets before retrieval.

Table 9 summarizes cost and rate‑limit considerations.

Table 9. Cost and rate‑limit summary

| Provider | Cost Model | Example Rate Limits | Notes |
|---|---|---|---|
| USGS M2M | No‑cost from USGS; AWS requester‑pays for cloud | Not specified | Plan for token migration and backoff. [^1] [^11] |
| CDSE/SDA/OData | No‑cost data; platform quotas | Not specified | Use adaptive throttling; monitor responses. [^4] |
| Sentinel Hub | Public catalog; service plans for heavy use | Platform quotas | Prefer Process API for subsets. [^7] |
| AWS Open Data | Requester‑pays S3; public STAC/SNS | API‑agnostic | Budget egress; use SNS events for efficient triggers. [^11] [^12] |
| Planetary Computer | Public STAC; signed URL access | Public STAC; access governed by docs | Azure‑integrated workflows; auth details in docs. [^13] [^16] |
| Planet Labs (example) | Commercial pricing | ~2 req/s activation; ~5 req/s download/search | Example of rate‑limit planning. [^26] |

## Automated Download Workflows (Step‑by‑Step)

This section outlines practical, step‑by‑step workflows for automated acquisition of Landsat 8/9 and Sentinel‑2 across the main providers. These are designed to be composable; teams can pick the pieces that best fit their environment.

USGS M2M (Landsat 8/9)
1. Provision application token and update client to “login-token”.
2. Authenticate and obtain session credentials.
3. Select collection (e.g., C2 L1 or L2).
4. Search scenes by AOI, date/time, cloud cover, and processing tier (T1/T2/RT).
5. Place an order for selected scenes; poll status to retrieve download URLs.
6. Download scene bundles; verify integrity via metadata and QA bands.
7. If operating in AWS, optionally integrate SNS notifications for complementary cloud‑native triggers. [^1] [^3] [^11]

CDSE/OData (Sentinel‑2 L1C/L2A)
1. Create a CDSE account and obtain token credentials.
2. Use SDA or OData to search for products by AOI, time window, and processing level.
3. Filter by cloud cover and quality masks; assess overlap areas and tile selection.
4. Download SAFE products; verify JP2 bands and manifests.
5. For analytics without full downloads, call Sentinel Hub Process/Batch APIs for rendered outputs and statistics. [^4] [^7] [^21] [^22]

AWS S3/STAC/SNS (Sentinel‑2 and Landsat)
1. Discover datasets via STAC catalogs (e.g., Sentinel‑2 L1C/L2A; Landsat STAC).
2. Subscribe to SNS topics to receive new product notifications.
3. On event, retrieve asset references via STAC; decide whether to download full products or stream subsets (COG/JP2).
4. For Sentinel‑2 zipped archives, stage and extract promptly due to three‑day retention.
5. Use requester‑pays mode wisely; avoid unnecessary egress by operating in‑cloud when possible. [^11] [^12]

Planetary Computer (STAC‑first discovery; signed URL access)
1. Use the STAC API to search across the catalog by AOI, date/time, and properties.
2. Retrieve item assets; obtain signed URLs using the Data API when required.
3. Integrate into Azure‑native compute pipelines; prefer in‑cloud processing to minimize egress. [^13] [^14] [^16]

Open‑source client: Sentinelsat (Sentinel‑2)
1. Configure hub credentials for CDSE/OData.
2. Define AOI and date range; set cloud cover thresholds.
3. Query and iterate over results; download products or selected bands.
4. Integrate into Python workflows with robust retry and logging. [^25]

Table 10 presents an end‑to‑end pipeline checklist.

Table 10. End‑to‑end pipeline checklist

| Stage | USGS M2M (Landsat) | CDSE/OData (Sentinel‑2) | AWS S3/STAC/SNS | Planetary Computer | Sentinelsat |
|---|---|---|---|---|---|
| Auth | Application token; “login-token” | CDSE token | AWS credentials (requester pays) | Account for signed URLs | Hub credentials |
| Discovery | M2M collections/search | SDA/OData search | STAC search | STAC API search | Query via client |
| Order/Download | Order; get download URLs | Download SAFE products | S3 object retrieval; SNS events | Signed URL access | Download via client |
| Verification | Metadata/QA bands | Manifest/JP2 checks | Asset checksums/manifests | Asset metadata | Product checks |
| Failure handling | Retry/backoff; status polling | Retry/backoff | Event re‑try; DLQ patterns | Signed URL expiry handling | Retry/backoff |
| Notification | SNS (AWS route as adjunct) | Platform hooks | SNS subscriptions | Azure‑integrated events | Client logs |

These workflows are deliberately redundant by design: teams can mix and match providers to meet reliability, cost, and latency requirements. [^1] [^4] [^11] [^13] [^25]

## Data Processing Workflows

Data must often be pre‑processed to achieve analysis‑ready outputs. The choice of method depends on the product level, application, and available auxiliary data.

Landsat (L1 DN to TOA/radiance)
- Level‑1 products deliver DN in unsigned 16‑bit integers. Conversion to top‑of‑atmosphere reflectance or radiance uses scaling factors provided in the metadata. QA bands support quality screening, and angle files support illumination corrections. [^9]
- Level‑2 products deliver surface reflectance and other science products, reducing the need for atmospheric correction in many applications. [^10]

Sentinel‑2 (L1C TOA; L2A SR)
- L1C provides TOA reflectance, suitable for analyses that either tolerate atmospheric effects or apply custom corrections.
- L2A provides bottom‑of‑atmosphere (surface reflectance) along with scene classification (SCL), aerosol optical thickness (AOT), and water vapour (WV) maps. L2A is typically preferred for quantitative studies of land surface processes. [^21] [^22]

Tools and libraries
- Sentinel‑2 atmospheric correction is commonly performed with Sen2Cor, which produces L2A from L1C. Sen2Cor parameters and limitations are documented in the L2A Product Definition Document. [^24]
- For Landsat and other multispectral imagery, commercial toolkits like ENVI offer atmospheric correction methods (e.g., FLAASH, QUAC) and radiometric calibration routines. Open‑source alternatives exist, but licensing and capabilities vary by method. [^29]
- Cloud‑based platforms such as Google Earth Engine provide access to Landsat and Sentinel‑2 collections with built‑in processing and export capabilities, which can accelerate workflows when full control over algorithms is not required. [^17] [^18]

Table 11 summarizes common preprocessing steps by product/mission.

Table 11. Preprocessing steps by product

| Product | Input | Method | Output | Notes |
|---|---|---|---|---|
| Landsat C2 L1 | DN (unsigned 16‑bit) | Apply metadata scaling; optional TOA | TOA reflectance/radiance | Use QA and angles as needed. [^9] |
| Landsat C2 L2 | COG SR products | N/A (already corrected) | Surface reflectance | Ready for many analyses. [^10] |
| Sentinel‑2 L1C | JP2 (DN) | Quantification to TOA; optional custom correction | TOA reflectance | Consider Sen2Cor if L2A desired. [^21] [^24] |
| Sentinel‑2 L2A | JP2 (DN) | Quantification to BOA/SR; use SCL/AOT/WV | Surface reflectance + SCL | Preferred for quantitative SR analyses. [^22] |

Table 12 compares L2A generation options.

Table 12. L2A generation options

| Option | Requirements | Outputs | Pros | Cons |
|---|---|---|---|---|
| Sen2Cor (user‑run) | L1C input; local compute | L2A SAFE (SR, SCL, AOT, WV) | Control over parameters; local reproducibility | Compute‑intensive; must manage baselines and anomalies |
| CDSE/Sentinel Hub L2A | Account; API | Rendered SR and analytics | Minimal local compute; fast | API quotas; may not provide full product assets |
| Platform pre‑processed (e.g., GEE) | Platform account | Analysis‑ready SR | Simplified pipeline | Less control over algorithm versions |

The decision hinges on control versus convenience: Sen2Cor provides full control but requires compute and curation; platform‑provided L2A accelerates delivery but constrains algorithm tuning. [^21] [^22] [^24] [^17]

## Operational Best Practices and Risk Management

Production pipelines need safeguards against cost overruns, rate‑limit violations, data loss, and format pitfalls. The following practices help teams maintain reliability.

Rate‑limit compliance and robustness
- Implement client‑side throttling and exponential backoff on all APIs.
- Use pagination and checkpointing; log request IDs and responses for auditability.
- For services without publicly documented limits (e.g., CDSE/Sentinel Hub), instrument clients to detect throttling and adapt dynamically.

Cost controls (requester pays awareness)
- Monitor egress and request costs; use cloud‑native analytics to avoid unnecessary downloads.
- Prefer selective band retrieval and COG streaming over full scene downloads.
- Schedule bulk operations during off‑peak hours; avoid duplicated work by caching metadata and deduplicating AOIs/time windows. [^11] [^12]

Data integrity and retention
- Verify product manifests and metadata; use QA bands for quality screening (Landsat) and SCL for masking (Sentinel‑2 L2A).
- For AWS S2 zipped archives, stage and process promptly given the three‑day retention window. [^12]
- Maintain checksums where available; record provenance and processing baselines for reproducibility.

Security and access management
- Store application tokens (USGS) and platform credentials securely; rotate per policy.
- Manage AWS keys and Planetary Computer authentication with least privilege.
- Track audit trails for data acquisition and processing steps.

Error handling and observability
- Build dead‑letter queues for SNS‑triggered workflows; log and replay failed tasks.
- Instrument pipelines with metrics (request counts, latency, egress) and alerts for anomalies.
- Document reprocessing baselines and provide rollback strategies.

Table 13 lists a concise risk matrix.

Table 13. Risk matrix and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rate‑limit throttling | Medium | Medium | Backoff; adaptive throttling; caching; paginate; monitor. |
| Requester‑pays cost overruns | Medium | High | Budget alerts; COG streaming; in‑cloud analytics; selective bands. |
| S2 zip retention expiry | High (for zips) | Medium | Avoid relying on zips; use STAC/S3 assets; timely staging. [^12] |
| Token expiry/auth failures | Medium | Medium | Secure storage; rotation; robust login flows (USGS “login-token”). [^1] |
| Format anomalies/artefacts | Low‑Medium | Medium | QA/SCL screening; reference PSD/DFCB; reprocessing when needed. [^23] |
| Data integrity issues | Low | High | Checksums; metadata verification; audits; versioning. |

## Appendix: Quick Reference

This appendix consolidates selected endpoints, clients, and acronyms for quick reference.

Endpoint and client quick‑reference
- USGS EarthExplorer M2M: JSON‑based API for collections, search, orders, and download. Authenticate via “login-token” with application token; legacy “login” deprecated. [^1] [^3]
- Copernicus Data Space Ecosystem: SDA and OData APIs for Sentinel‑2 search and download; token‑based authentication per platform docs. [^4]
- Sentinel Hub APIs: Process and Batch APIs for rendered outputs and analytics; data docs for Sentinel‑2 L1C/L2A. [^7] [^8] [^21] [^22]
- AWS Open Data: Landsat S3 (usgs‑landsat/collection02/), Sentinel‑2 S3 (sentinel‑s2‑l1c/, sentinel‑s2‑l2a/), STAC endpoints, SNS topics for notifications. Requester‑pays. [^11] [^12]
- Microsoft Planetary Computer: Public STAC API; Data API for signed URL access; catalog overview and quickstarts. [^13] [^14] [^15] [^16]
- Open‑source client: Sentinelsat (Python) for Copernicus hub search/download. [^25]
- Commercial example: Planet Labs Data API rate‑limit guidance. [^26]

Glossary
- COG: Cloud‑Optimized GeoTIFF—GeoTIFF with internal tiling and overviews enabling HTTP range reads.
- SAFE: Standard Archive Format for Europe—container directory structure for ESA EO products.
- JP2: JPEG2000—compressed imagery format used in Sentinel‑2 bands.
- STAC: SpatioTemporal Asset Catalog—standard for describing geospatial collections and items.
- SNS: Simple Notification Service—AWS pub/sub service for event notifications.
- AOT: Aerosol Optical Thickness—auxiliary map in Sentinel‑2 L2A.
- SCL: Scene Classification Map—L2A mask labeling pixels by type (e.g., vegetation, cloud, shadow).
- TOA/BOA: Top of Atmosphere/Bottom of Atmosphere reflectance.
- QA: Quality Assessment band—Landsat pixel quality indicators.

Table 14 presents STAC and SNS resource pointers for AWS.

Table 14. STAC and SNS resource quick‑list

| Dataset | STAC | SNS Topics |
|---|---|---|
| Landsat (USGS) | STAC server available via LandsatLook and AWS documentation | Topics for new scenes: L1/L2, L3 science products, ARD tiles (requestor‑pays). [^11] |
| Sentinel‑2 | STAC endpoints for L1C/L2A | SNS topics for L1C (eu‑west‑1) and L2A (eu‑central‑1). [^12] |

## Information Gaps

The following items are not fully enumerated in the collected sources and should be validated during implementation:
- USGS M2M explicit rate limits and download quotas beyond deprecation and token guidance.
- CDSE/SDA/OData detailed quotas and throttling behaviors.
- Exact per‑scene and per‑tile size distributions across bands for Landsat 8/9 and Sentinel‑2 L1C/L2A.
- Comprehensive processing baseline history and reprocessing timelines for Sentinel‑2 (e.g., all Collection‑1 baseline dates).
- Microsoft Planetary Computer Data API authentication specifics and rate‑limit details for bulk downloads.
- Formal licenses/terms for downstream redistribution from each platform in a unified policy statement.

## References

[^1]: USGS M2M Application Token Documentation. https://www.usgs.gov/media/files/m2m-application-token-documentation  
[^2]: M2M Application Token Documentation (PDF). https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/files/M2M%20Application%20Token%20Documentation_02112025_0.pdf  
[^3]: Machine‑to‑Machine (M2M) API — USGS. https://m2m.cr.usgs.gov/  
[^4]: APIs — Copernicus Data Space Ecosystem. https://documentation.dataspace.copernicus.eu/APIs.html  
[^6]: Copernicus Data Space Ecosystem — Sentinel Hub. https://www.sentinel-hub.com/explore/copernicus-data-space-ecosystem/  
[^7]: API — Sentinel Hub. https://www.sentinel-hub.com/develop/api/  
[^8]: Beginner’s Guide — Sentinel Hub. https://docs.sentinel-hub.com/api/latest/user-guides/beginners-guide/  
[^9]: Landsat Collection 2 Level‑1 Data — USGS. https://www.usgs.gov/landsat-missions/landsat-collection-2-level-1-data  
[^10]: Landsat 8‑9 Collection 2 Level 2 Science Product Guide (PDF). https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/files/LSDS-1619_Landsat8-9-Collection2-Level2-Science-Product-Guide-v6.pdf  
[^11]: USGS Landsat — Registry of Open Data on AWS. https://registry.opendata.aws/usgs-landsat/  
[^12]: Sentinel‑2 — Registry of Open Data on AWS. https://registry.opendata.aws/sentinel-2/  
[^13]: Using the Planetary Computer’s Data API — Quickstart. https://planetarycomputer.microsoft.com/docs/quickstarts/using-the-data-api/  
[^14]: Reading Data from the STAC API — Planetary Computer. https://planetarycomputer.microsoft.com/docs/quickstarts/reading-stac/  
[^15]: Data Catalog — Planetary Computer. https://planetarycomputer.microsoft.com/catalog  
[^16]: Documentation — Planetary Computer. https://planetarycomputer.microsoft.com/docs  
[^17]: Google Earth Engine Landsat Collections. https://developers.google.com/earth-engine/datasets/catalog/landsat  
[^18]: Landsat Algorithms — Google Earth Engine. https://developers.google.com/earth-engine/guides/landsat  
[^19]: S2 Products — SentiWiki (Copernicus). https://sentiwiki.copernicus.eu/web/s2-products  
[^21]: Sentinel‑2 L1C — Sentinel Hub. https://docs.sentinel-hub.com/api/latest/data/sentinel-2-l1c/  
[^22]: Sentinel‑2 L2A — Sentinel Hub. https://docs.sentinel-hub.com/api/latest/data/sentinel-2-l2a/  
[^23]: Sentinel‑2 Products Specification Document (PSD) v14.9 (PDF). https://sentinels.copernicus.eu/documents/247904/685211/S2-PDGS-TAS-DI-PSD-V14.9.pdf  
[^24]: Sentinel‑2 L2A Product Definition Document (PDF). https://step.esa.int/thirdparties/sen2cor/2.10.0/docs/S2-PDGS-MPC-L2A-PDD-V14.9-v4.9.pdf  
[^25]: Sentinelsat — Python API Overview. https://sentinelsat.readthedocs.io/en/stable/api_overview.html  
[^26]: Planet Labs Data API Overview. https://docs.planet.com/develop/apis/data/  
[^29]: Atmospheric Correction — ENVI (NV5 Geospatial Software). https://www.nv5geospatialsoftware.com/docs/AtmosphericCorrection.html