# Watershed Disturbance Mapping System: End-to-End Architecture and Integration Blueprint

## Executive Summary: System Purpose, Scope, and Key Architectural Decisions

The Watershed Disturbance Mapping System is designed to detect, quantify, and attribute changes in watershed condition using satellite time series, spatial analytics, and operational monitoring. The system ingests imagery from Landsat and Sentinel‑2, processes it locally using open‑source Python, and publishes analysis‑ready products through a geospatial database and a web API for visualization and analytical consumption. The architecture balances reproducibility, scale, and operational simplicity by adopting cloud‑optimized formats, chunked and lazy computation patterns, and index‑aware spatial data management.

Several decisions anchor the design. First, Cloud Optimized GeoTIFFs (COGs) are the standard for raster assets. COGs enable partial reads via HTTP Range requests and internal overviews, allowing efficient access to analysis‑ready tiles without full file downloads. This “pay for what you read” behavior is essential when streaming data from cloud storage to commodity or on‑premises compute, and it materially reduces egress and cost. Second, SpatioTemporal Asset Catalogs (STAC) are used for standardized discovery and metadata capture across sources such as USGS, Copernicus Data Space Ecosystem (CDSE), AWS Open Data, and Microsoft Planetary Computer. STAC items are normalized into the catalog schema and linked to derived change products to maintain lineage from scenes to outputs. Third, the PostgreSQL + PostGIS database stores scene metadata, spatial time‑series, change histories, and out‑of‑database COG references. TimescaleDB hypertables provide scalable time‑series storage, and temporal range types (TSTZRANGE) with triggers record validity windows for change histories. Fourth, the Python processing pipeline uses Xarray + Dask for labeled, chunked arrays and lazy parallelism, along with Rasterio for geospatial I/O and GeoPandas for vector overlays and zonal statistics. Change detection blends classical differencing/ratios, non‑parametric trend tests (Mann–Kendall/Sen’s slope), Bayesian change‑point detection (BEAST), and CPU‑first machine learning (Random Forest/SVM), with near real‑time monitoring methods (EWMA/CuSum/MoSum). Fifth, a Node.js API layer exposes geospatial endpoints (scene listing, AOI search, change summaries, time series, map tiles) with parameterization that exploits index‑aware predicates and bounding‑box filters. Sixth, a React frontend renders maps and analytics, while a private access VPN—primarily WireGuard with optional OpenVPN or OpenConnect—secures remote and field access. Finally, operational workflows automate data acquisition via USGS M2M application tokens and CDSE/Sentinel Hub APIs, with cloud‑native retrieval patterns on AWS S3 (requester‑pays) and federated discovery on Planetary Computer, accompanied by rate‑limit compliance and observability.

The narrative arc proceeds from what data the system ingests (Landsat/Sentinel‑2, STAC items), through how it processes and stores information (COG streaming, chunked compute, hypertables, history triggers), to why this matters operationally (scalable, reproducible, cost‑aware monitoring). The outcome is an engineering‑grade blueprint tailored to watershed programs that need robust change detection and audit-ready histories without the lock‑in of proprietary platforms. Throughout, security, reliability, and performance are treated as first‑class concerns: least‑privilege access, segmentation, backup/PITR, and predictable p95/p99 latencies for spatial queries.

## Functional Requirements and Non-Functional Constraints

The system must support end‑to‑end geospatial workflows spanning discovery, ingest, processing, analytics, storage, and delivery. Functionally, it discovers scenes via STAC, orders and downloads Landsat products through USGS EarthExplorer Machine‑to‑Machine (M2M), retrieves Sentinel‑2 via CDSE/Sentinel Hub, and accesses cloud archives on AWS Open Data or Planetary Computer. It automates acquisition with application tokens and OAuth‑style flows for CDSE/Sentinel Hub, and applies rate‑limit awareness, backoff, and retry logic across providers. Preprocessing involves cloud and shadow masking (Landsat QA bands; Sentinel‑2 L2A Scene Classification Layer), seasonal compositing, co‑registration, and normalization. Analytics produce indices (NDVI, NBR, TCG/TCW), bi‑temporal change maps via differencing/ratios, trend tests (Mann–Kendall/Sen’s slope), Bayesian change‑point detection (BEAST), CPU‑first ML attribution (RF/SVM), and near real‑time alerts (EWMA/CuSum/MoSum). Outputs are stored as COGs, NetCDF/Zarr intermediates, and PostGIS‑indexed vector summaries, with lineage metadata linking scenes to products.

Non‑functionally, the system targets predictable query performance, especially for map endpoints. It must meet availability and recovery objectives through backups and Point‑in‑Time Recovery (PITR), minimize egress costs via selective reads and cloud‑native retrieval, and secure remote access via a modern VPN posture with least‑privilege segmentation and audit trails. Observability is built in: pg_stat_statements tracks query performance; API metrics capture latencies and error rates; Dask dashboards profile computation graphs; and logs record data acquisition steps and provenance.

Information gaps remain around explicit rate limits and quotas for certain providers (USGS M2M and CDSE/Sentinel Hub), exact scene/tile size distributions for bandwidth planning, comprehensive formal licensing and redistribution policies, and empirical throughput benchmarks for specific PostGIS index types on representative datasets. These gaps are acknowledged and addressed with conservative client behavior, caching, adaptive throttling, and ongoing measurement in operations.

## Logical Architecture Overview

The logical architecture comprises six major components: the Python processing pipeline, PostgreSQL + PostGIS datastore, Node.js API server, React web frontend, private access VPN, and multi‑source satellite data acquisition workflows. Data flows from discovery through ingest to storage as STAC‑normalized metadata and COG raster references, then into analytical workflows that produce change products and time‑series, which are published through geospatial endpoints for visualization.

The Python pipeline follows a layered design: data access clients (STAC, USGS M2M, CDSE/Sentinel Hub, AWS/Planetary Computer) retrieve scenes and assets; preprocessors mask clouds/shadows, composite seasonal medians, and harmonize projections; analytics compute indices, perform differencing/ratios, run MK/Sen’s slope and BEAST, and train CPU‑friendly ML models; exporters write COGs with overviews and NetCDF/Zarr intermediates, publish derived metadata, and register outputs in the database. COGs and HTTP Range requests are used to stream only necessary pixels, minimizing I/O and memory pressure[^1][^2][^3][^4]. Rasterio provides robust I/O and geospatial operations, including windowed reads, masking, reprojection, and overview creation[^5]. Dask‑backed Xarray supports labeled, chunked arrays, lazy computation, and parallel execution patterns that scale from laptops to clusters[^6][^7].

The PostGIS datastore persists scene metadata with footprint geometries, AOI relationships, spatial time‑series via TimescaleDB hypertables, and change histories with TSTZRANGE validity windows and triggers. Raster data is kept as out‑of‑database COGs referenced via GDAL virtual file systems; PostGIS indexes tile extents via ST_ConvexHull for efficient spatial pruning[^8][^9][^10]. Query patterns rely on index‑aware predicates (ST_Intersects, ST_DWithin), bounding‑box filters (&&), and nearest‑neighbor operators (<->) for performance.

The Node.js API layer implements endpoints for scene listing, AOI searches, change summaries, time‑series retrieval, and tile/vector services. API parameters exploit spatial predicates, bounding‑box filters, and time bucketing, with response caching and pagination where appropriate. The React frontend renders maps, AOI selection, and analytics views, while behind the scenes, the VPN provides secure remote access. The VPN posture prioritizes WireGuard for throughput and mobile support, with OpenVPN compatibility and OpenConnect stealth options for constrained networks[^11][^12][^13][^14][^15].

To illustrate component responsibilities and technology choices, Table 1 maps each component to its role and stack.

Table 1. Component-to-technology mapping and primary responsibilities

| Component | Primary Responsibilities | Key Technologies |
|---|---|---|
| Python processing pipeline | STAC discovery; USGS M2M and CDSE/Sentinel Hub ingest; preprocessing (masking, compositing); analytics (indices, differencing, MK/Sen’s slope, BEAST, ML); exports (COGs, NetCDF/Zarr); provenance | Python; Rasterio; Xarray + Dask; GeoPandas; EarthPy/Satpy; STAC clients; scikit‑image; pyMannKendall; BEAST; nrt; GDAL VFS; COGs[^1][^2][^3][^4][^5][^6][^7][^16][^17][^18] |
| PostgreSQL + PostGIS | Scene metadata with footprints; AOIs; spatial time‑series (hypertables); change histories (TSTZRANGE); out‑of‑db COG references; index‑aware spatial queries | PostgreSQL; PostGIS; TimescaleDB; GDAL VFS; COG registration; GiST/SP‑GiST/BRIN; triggers; Barman + PITR[^8][^9][^10] |
| Node.js API server | Scene list; AOI intersect; time‑series; change summaries; tile/vector services; caching; rate‑limit handling | Node.js/Express; PostGIS SQL; spatial predicates; MVT tiles; authentication/authorization |
| React frontend | Map visualization; AOI drawing/selection; analytical dashboards; tile consumption | React; map libraries; state management |
| VPN | Secure remote access; segmentation; audit; mobile roaming; optional stealth | WireGuard; OpenVPN; OpenConnect; enterprise controls (RADIUS/MFA)[^11][^12][^13][^14][^15] |
| Data acquisition | USGS M2M application tokens; CDSE/SDA/OData; Sentinel Hub Process/Batch; AWS S3/STAC/SNS (requester‑pays); Planetary Computer STAC/signed URLs | USGS M2M; CDSE; Sentinel Hub; AWS Open Data; Planetary Computer; STAC[^19][^20][^21][^22][^23][^24][^25][^26] |

Narratively, these components compose into an operational whole: discovery and ingest feed normalized metadata and COG rasters into storage; chunked, lazy processing yields reproducible analytics with controlled memory; index‑aware APIs deliver fast geospatial responses; and VPN ensures secure remote connectivity.

## Data Acquisition and Satellite Data Workflows

The system supports multiple access pathways, selecting the best route per task to balance reliability, cost, and latency. USGS EarthExplorer M2M is the authoritative path for Landsat collections. CDSE SDA/OData and Sentinel Hub serve Sentinel‑2, including rendered analytics via Process/Batch APIs. AWS Open Data offers event‑driven, cloud‑native retrieval via S3, STAC catalogs, and SNS notifications, subject to requester‑pays. Microsoft Planetary Computer provides federated discovery through a public STAC API and signed URL workflows. Each pathway has distinct authentication models, formats, and operational caveats; robust automation demands explicit token lifecycle management, rate‑limit awareness, and adaptive backoff.

USGS M2M now requires application tokens via the “login‑token” endpoint, with the legacy “login” deprecated in February 2025. M2M mirrors the EarthExplorer interface, enabling collection enumeration, scene search, order placement, and retrieval of download URLs. Landsat Collection 2 Level‑1 (L1) products deliver digital numbers (DN) in unsigned 16‑bit COGs; Level‑2 (L2) products deliver surface reflectance and science products as COGs. Scene bundles include QA bands, angle coefficients, browse images, and metadata, all of which are used for screening and provenance[^19][^20][^22][^27].

CDSE SDA/OData provide search and retrieval for Sentinel‑2 L1C and L2A SAFE products (JP2 bands), with L2A adding scene classification (SCL), aerosol optical thickness (AOT), and water vapour (WV). Sentinel Hub’s Process and Batch APIs support on‑the‑fly rendered imagery and statistics, allowing partial coverage analytics without full downloads[^20][^23]. AWS Open Data exposes Landsat and Sentinel‑2 on S3 with STAC catalogs and SNS topics. Landsat access is requester‑pays; Sentinel‑2 zipped archives have a three‑day retention window, which necessitates prompt staging and processing to avoid expiry[^24][^25]. Planetary Computer offers a public STAC API and Data API for signed URL access, enabling federated discovery and cloud‑native workflows[^26].

To compare these pathways, Table 2 summarizes authentication, endpoints, formats, cost models, rate limits, and use cases.

Table 2. Access pathways comparison

| Provider | Authentication | Core Endpoints | Data Formats | Cost Model | Rate Limits (where documented) | Typical Use Cases | Pros | Cons |
|---|---|---|---|---|---|---|---|---|
| USGS EarthExplorer M2M | Application token via “login‑token” | Collections, search, orders, download URLs | Landsat C2 L1/L2 COGs; metadata/QA/browse | No‑cost downloads; AWS requester‑pays applies via cloud | Not specified in collected sources | Authoritative Landsat ordering and download | Mature, authoritative; COG delivery | Requires token migration; multi‑step download[^19][^20][^24] |
| CDSE SDA/OData | CDSE account + token | SDA/OData search and retrieval | Sentinel‑2 SAFE (L1C/L2A), JP2 bands | No‑cost data access; platform rate limits | Not enumerated here | Direct Sentinel‑2 programmatic retrieval | Official ESA route; strong L2A | Evolving APIs; unspecified quotas[^20][^23] |
| Sentinel Hub APIs | Account + token | Process/Batch APIs | Rendered outputs; statistics; analytics | No‑cost catalog; service plans | Platform quotas | On‑the‑fly analytics without full downloads | Minimal transfer; fast | Quotas; not archive retrieval[^23] |
| AWS Open Data (Landsat/S2) | AWS credentials for requester‑pays | S3 object retrieval; STAC catalogs; SNS | COGs (Landsat); SAFE/JP2 (S2) | Requester‑pays for egress/requests | API‑agnostic | Event‑driven, cloud‑native pipelines | Highly scalable; events | Requester‑pays; S2 zip retention 3 days[^24][^25] |
| Planetary Computer | Account for certain actions | STAC API; Data API with signed URLs | Analysis‑ready datasets; STAC assets | Azure‑hosted; public STAC; signed URLs | Public STAC; signed URLs for bulk | Federated discovery; Azure workflows | Unified catalog; cloud‑native | Requires auth understanding[^26] |

Format characteristics drive engineering choices. Landsat COGs support efficient partial reads via HTTP Range and internal overviews; Sentinel‑2 SAFE/JP2 products offer compression but often benefit from API‑rendered outputs or selective tile retrieval. Table 3 compares Landsat C2 (L1/L2) and Sentinel‑2 (L1C/L2A) across container, band format, tiling/overviews, metadata, partial reads, and conversion.

Table 3. Data formats comparison and pipeline implications

| Attribute | Landsat C2 (L1/L2) | Sentinel‑2 (L1C/L2A) |
|---|---|---|
| Container | Individual COG assets plus metadata | SAFE directory structure |
| Band format | COG (GeoTIFF), DN (unsigned 16‑bit) | JP2 images; quantification via metadata |
| Internal tiling/overviews | Yes (COG) | JP2 tiles; partial reads feasible but less cloud‑optimized |
| Metadata | MTL/XML; QA, angles, browse | XML manifests; quality masks; SCL/AOT/WV for L2A |
| Partial reads | Efficient via HTTP Range and overviews | Feasible but I/O‑intensive; prefer API‑rendered outputs |
| Conversion | L1 DN to TOA/radiance via scaling; L2 SR ready for analysis | L1C TOA; L2A BOA/Surface reflectance; SCL aids masking[^22][^23][^28] |

Cost and rate‑limit planning are operational necessities. While USGS and CDSE provide no‑cost data access, they may enforce throttling without publicly enumerated limits; clients must back off and cache. AWS requester‑pays requires budget alerts and minimized egress. Sentinel Hub enforces service quotas. Table 4 consolidates cost and rate‑limit considerations.

Table 4. Cost and rate-limit summary

| Provider | Cost Model | Example Rate Limits | Notes |
|---|---|---|---|
| USGS M2M | No‑cost from USGS; AWS requester‑pays for cloud | Not specified | Plan token migration; backoff; pagination[^19][^24] |
| CDSE SDA/OData | No‑cost data; platform quotas | Not specified | Adaptive throttling; monitor responses[^20] |
| Sentinel Hub | Public catalog; service plans | Platform quotas | Prefer Process API for subsets[^23] |
| AWS Open Data | Requester‑pays S3; public STAC/SNS | API‑agnostic | Budget egress; SNS events[^24][^25] |
| Planetary Computer | Public STAC; signed URL access | Public STAC; signed URL governance | Azure‑integrated workflows; auth details in docs[^26] |

For throughput and bandwidth planning, practical strategies include STAC‑first discovery, selective band retrieval, COG streaming, and scheduling bulk orders during off‑peak windows. Verification patterns rely on metadata and QA bands for Landsat, manifests/JP2 checks for Sentinel‑2, and event re‑try with dead‑letter queues for SNS‑triggered workflows[^24][^25].

## Python Processing Pipeline Architecture

The pipeline architecture implements lazy, chunked computation and composable stages that minimize memory while maximizing throughput. Discovery and ingest use STAC endpoints for both Landsat and Sentinel‑2, normalization into a catalog schema, and linkages to derived products. Preprocessing applies cloud/shadow masking via Landsat QA layers and Sentinel‑2 L2A SCL; seasonal compositing controls phenology noise; co‑registration and normalization ensure consistent geometry and radiometry. Analytics compute indices (NDVI, NBR, TCG/TCW), bi‑temporal differencing/ratios with thresholding, trend tests (Mann–Kendall and Sen’s slope), Bayesian change‑point detection (BEAST), CPU‑first ML attribution (RF/SVM), and near real‑time monitoring (EWMA/CuSum/MoSum). Outputs are exported as COGs with overviews for visualization and sharing, and NetCDF/Zarr intermediates for robust pipeline restarts. Provenance is captured at each stage, from scene identifiers and timestamps to parameter choices and versions.

Lazy computation and chunking with Xarray + Dask ensure larger‑than‑memory workloads are feasible. Chunk early and index early (via .sel/.isel) to prune data before resampling or groupby operations; rechunk when misalignment harms performance; call persist judiciously to keep expensive intermediates in memory; use apply_ufunc or map_blocks to parallelize NumPy‑like functions; and diagnose bottlenecks with the Dask dashboard[^6][^7]. Table 5 summarizes Dask+Xarray optimization levers and expected outcomes.

Table 5. Dask+Xarray optimization levers and effects

| Lever | Effect | Expected Outcome |
|---|---|---|
| Read‑time chunking | Smaller, parallel tasks | Lower memory; higher throughput when balanced[^6] |
| Early indexing | Prunes data early | Less computation; faster pipelines[^6] |
| Rechunking | Better alignment with operations | Reduced overhead; improved cache locality[^6] |
| persist() | Keeps results hot in memory | Fewer recomputations; faster downstream[^6][^7] |
| Intermediate saves | Checkpoints pipelines | Robustness; easier restarts[^6] |
| COG streaming | Partial reads via HTTP Range | Lower I/O; scalable AOI extraction[^1][^2][^4] |

Change detection toolkit composition spans classical and ML/DL methods, with CPU‑friendly models favored at watershed scale. Table 6 maps method categories to inputs, outputs, and stack components.

Table 6. Change detection method matrix

| Category | Typical Inputs | Outputs | Stack Components |
|---|---|---|---|
| Classical differencing/ratio | Bi‑temporal rasters (optical bands, NDVI) | Change magnitude/heatmap; binary mask | Rasterio (mask/warp), Xarray+Dask (lazy ops), scikit‑image (threshold/morphology), GeoPandas (vectorization), COG partial reads[^5][^6][^16] |
| Post‑classification comparison | Classified maps from two dates | Transition matrix; class‑specific change | Rasterio/Xarray for classification; scikit‑image metrics; GeoPandas zonal summaries[^5][^6][^16] |
| ML (feature‑based) | Hand‑crafted features; time series | Change probability per pixel/segment | Xarray feature engineering; scikit‑learn/scikit‑eo; Dask parallelization[^16] |
| DL (U‑Net, Siamese, transformers) | Bi‑temporal pairs or time series | Pixel/segment change masks | Xarray preprocessing; COG streaming; DL frameworks; local GPU optional[^17] |
| Building change (DL example) | High‑resolution bi‑temporal imagery | Building added/removed map | scikit‑image post‑processing; adapted patterns from samples[^18] |

Local alternatives to cloud platforms remain pragmatic. QGIS with PyQGIS offers a desktop GIS route; the QGIS Earth Engine plugin integrates cloud processing when needed; and the pure local Python stack provides reproducible, batch pipelines with full control. Table 7 compares these options.

Table 7. Alternative approaches comparison

| Approach | Scale and Performance | Control and Reproducibility | Cost | Offline Capability | Skill Curve |
|---|---|---|---|---|---|
| QGIS + PyQGIS | Good for medium data; extensible via plugins | Strong provenance with scripts/workflows | Low (open source) | Full | Low‑to‑moderate (GUI + scripting) |
| QGIS GEE plugin | Leverages GEE scale; desktop UI | Tied to GEE; local artifacts possible | Low + cloud compute | Partial | Low‑to‑moderate |
| Pure local Python stack | Scales with chunking/Dask; COG streaming | Full local control; code‑based provenance | Low (open source) | Full | Moderate (Pythonic stack)[^5][^6][^16][^17] |

Security and cost considerations include minimizing egress by reading AOIs only, preferring partial COG reads over full downloads, and scheduling heavy operations off‑peak[^1][^2][^4].

## Data Model and Storage (PostgreSQL + PostGIS)

The data model separates concerns: relational metadata, out‑of‑database rasters, spatial time‑series, and change history. Scene metadata includes identifiers, acquisition time, sensor/platform, processing level, cloud cover, footprint geometry, and SRID. AOIs and their relationships to scenes are normalized in join tables. Raster data is referenced externally as COGs and indexed by tile extents. Spatial time‑series use TimescaleDB hypertables with optional secondary partitioning (region/sensor) to distribute write hotspots. Change histories employ TSTZRANGE validity windows and triggers to open and close intervals for time‑travel queries.

Spatial indexing is engineered for performance. GiST supports general geometry and kNN; SP‑GiST suits clustered point distributions; BRIN offers tiny, fast‑build indices for huge, append‑only tables when data is physically ordered[^29][^30][^31]. Index‑aware predicates such as ST_Intersects and ST_DWithin, along with bounding‑box filters (&&), reduce CPU and I/O. Nearest‑neighbor queries use ORDER BY <-> LIMIT N. Geometry complexity is managed with ST_Subdivide to keep predicates tractable and planner estimates accurate[^29][^30][^31].

COGs are registered out‑of‑database via GDAL VFS, with PostGIS storing references and indexing tile extents using ST_ConvexHull. COG internal tiling and overviews enable partial reads via HTTP Range requests, ensuring efficient access to only the required pixels for AOI operations[^8][^10]. Out‑of‑database rasters are enabled and GDAL drivers configured in the database; raster2pgsql loads references with tile sizes aligned to COG blocking; and GiST indices prune tiles for spatial queries[^8][^10].

Backup and disaster recovery use Barman for physical backups, WAL streaming to achieve near‑zero RPO, and PITR to recover to specific timestamps. Retention policies balance redundancy versus recovery windows. Regular recovery tests and monitoring are mandatory[^33][^34][^35].

Table 8 provides a schema plan for scenes, AOIs, and scene‑AOI relationships, with index choices.

Table 8. Imagery metadata schema and index plan

| Entity | Key Columns | Indices | Notes |
|---|---|---|---|
| scenes | scene_id PK; acquisition_time; sensor; platform; product_type; cloud_cover; footprint geom; srid | GiST(footprint); BTREE(sensor, acquisition_time DESC); BTREE(acquisition_time DESC) | Normalized metadata; partial indexes for hot sensors |
| aois | aoi_id PK; user_id; name; geom | GiST(geom) | User‑defined AOIs |
| scenes_aoi | scene_id; aoi_id | BTREE(scene_id, aoi_id) | Join table for many‑to‑many |

Raster storage decisions are summarized in Table 9, contrasting in‑DB raster versus out‑of‑database COGs.

Table 9. Raster storage decision table

| Aspect | In‑DB Raster | Out‑of‑DB COG |
|---|---|---|
| Performance | High for small/medium datasets; I/O grows quickly | High for large imagery; partial reads via Range; tiled overviews serve multi‑scale[^10] |
| Storage Cost | High (DB/WAL growth) | Low (object storage); DB stores references |
| Scalability | Limited by DB disk | Highly scalable (CDN, object storage) |
| Ops Complexity | Dump/restore includes pixel data | GDAL VFS; security via signed URLs/keys; align tiles/overviews |
| Indexing | ST_ConvexHull(rast) GiST | ST_ConvexHull(rast) GiST on tile table[^8][^10] |

Index and predicate choices determine performance outcomes. Table 10 maps index methods to workloads; Table 11 lists preferred predicates and remedies for common anti‑patterns.

Table 10. Index methods and use cases

| Index Method | Strengths | Limitations | Best Use Cases |
|---|---|---|---|
| GiST | Versatile; supports predicates and kNN | Larger index; higher maintenance | General geometries; joins; nearest neighbor[^29][^31] |
| SP‑GiST | Good for clustered points; space‑partitioned | No kNN; lossy | Massive points with natural partitioning[^29] |
| BRIN | Tiny; fast build; good for ordered data | Lossy; inclusion ops only; no kNN | Append‑only, huge tables; spatially sorted data[^29] |

Table 11. Predicate selection and anti-pattern remedies

| Task | Prefer | Avoid | Reason |
|---|---|---|---|
| AOI intersect | ST_Intersects (or &&) | Complex custom expressions | Index‑aware; bounding‑box filter first[^29][^30] |
| Within distance | ST_DWithin | ST_Distance in WHERE | ST_DWithin uses expanded bbox; index‑aware[^29][^30] |
| Nearest neighbor | ORDER BY <-> LIMIT N | ORDER BY ST_Distance | <-> is index‑aware; efficient pruning[^29] |
| Geometry complexity | ST_Subdivide | High‑vertex polygons | Subdivision reduces CPU work; better pruning[^31] |

Partitioning strategies are workload‑dependent. Time‑series benefit from hypertables by time, with optional region/sensor partitioning to distribute write load; global base layers may use list partitions by region; hybrid sub‑partitioning handles write hotspots and large volumes. Table 12 summarizes options.

Table 12. Partitioning strategy matrix

| Workload | Strategy | Partition Keys | Notes |
|---|---|---|---|
| Time‑series events | Hypertable | ts | Rolling retention; time_bucket aggregations[^32] |
| Global base layers | List | region_code | Localizes I/O; eases cloning |
| Hotspots | Hybrid sub‑partition | time, region_id | Distributes writes; prune both time and space[^32] |

Query optimization follows three rules: use index‑aware predicates and bounding‑box filters; subdivide large geometries; write queries the planner can understand (select only needed columns, VACUUM ANALYZE, EXPLAIN ANALYZE, adjust random_page_cost where appropriate)[^31]. Vector tile generation (ST_AsMVT) and caching complement map serving. Observability and scaling rely on pg_stat_statements, cache hit ratio, memory configuration (shared_buffers, work_mem), and parallelism settings; connection pooling and read replicas support throughput; sharding is a last resort[^31][^36].

## Node.js API Layer and Integration Patterns

The API layer exposes endpoints tailored to geospatial workflows:

- GET /scenes?bbox=&time_start=&time_end=&sensor=&cloud_max=: Lists scenes with AOI and time filters, using index‑aware spatial predicates and paginated responses.
- GET /aois/{aoi_id}/scenes?time_start=&time_end=&sensor=&cloud_max=: Returns scenes intersecting an AOI, leveraging bounding‑box filters and ST_Intersects.
- GET /changes?aoi_id=&method=&time_start=&time_end=&threshold=: Returns change detection results with metadata and optional confidence rasters.
- GET /timeseries?geom=&start=&end=&bucket=: Returns time‑bucket aggregations for a geometry, parameterized for spatial predicates and time windows.
- GET /tiles/{z}/{x}/{y}?layer=: Returns map tiles from pre‑rendered layers or vector tiles from ST_AsMVT.

Integration patterns parameterize queries to exploit spatial indexes and time bucketing, bounding‑box filters, and ST_DWithin for distance predicates. Response caching and pagination are applied where payloads are large or frequently accessed. PostGIS functions are encapsulated in parameterized queries or views to ensure consistent index‑aware behavior[^29]. Authentication is role‑based; logging captures request IDs and execution metrics; and rate‑limit handling protects external data sources (e.g., throttling catalog searches or batch process requests).

## React Frontend Architecture and Visualization

The React frontend delivers interactive mapping and analytical views. Core components include map rendering layers (basemaps, COG tile overlays), AOI drawing tools, and dashboards for change analytics and time‑series plots. State management handles user inputs, selected AOIs, data layer visibility, and filter controls. Performance considerations include tile caching, viewport‑based queries, and debouncing user interactions to avoid excessive API calls. Accessibility follows a consistent map legend, clear attribution, and responsive layouts. COG visualization uses cloud‑aware retrieval, rendering only needed tiles and leveraging overviews for zoomed‑out views[^10].

## Secure Remote Access via VPN

The VPN architecture balances performance, compatibility, and resilience. WireGuard is the primary choice for high throughput and mobile/instrument roaming, leveraging modern cryptography (ChaCha20/Poly1305/Curve25519/BLAKE2s), compact codebase, and key‑based configuration (AllowedIPs). OpenVPN complements WireGuard with mature enterprise integrations (RADIUS/LDAP/SSO), flexible transport (UDP/TCP), and extensive device/router support. OpenConnect (AnyConnect‑compatible) serves stealth and firewall traversal needs in restrictive environments; SoftEtherVPN offers multi‑protocol options including SSTP and VPN‑over‑ICMP/DNS. In multi‑user scientific deployments, segmentation, logging, MFA, and high availability are standard, aligning with enterprise VPN guidance and Zero Trust principles[^11][^12][^13][^14][^15].

To visualize the comparative context for latency and testing scope, the following figures illustrate representative benchmark charts from PassMark and a performance visualization; these are used strictly as methodological context and not as protocol‑level conclusions.

![Representative VPN performance chart (PassMark)—illustrative context for latency/throughput comparison methodologies.](.pdf_temp/viewrange_chunk_1_1_5_1761797659/images/9znnni.jpg)

![Example performance visualization—used to illustrate metrics and testing context.](.pdf_temp/viewrange_chunk_1_1_5_1761797659/images/b0ix2w.jpg)

Table 13 maps scientific constraints to recommended VPN patterns.

Table 13. Pattern-to-use-case mapping

| Constraint/Goal | Recommended Pattern | Rationale |
|---|---|---|
| Maximize throughput for bulk transfer | WireGuard‑only | Lower overhead; fast handshake; mobile‑friendly[^11][^12] |
| Mixed device fleets and legacy appliances | Dual‑protocol (WireGuard + OpenVPN) | Optimize performance; fallback to compatibility[^12][^13] |
| Strict DPI/firewall blocking | OpenConnect‑centric (+ WireGuard where feasible) | HTTPS‑based stealth; AnyConnect parity across OS[^14] |
| Instruments behind NAT with no port forwarding | SoftEtherVPN | NAT traversal; VPN‑over‑ICMP/DNS fallback[^14] |
| HA, segmentation, audit requirements | OpenVPN with enterprise integration | RADIUS/LDAP/SSO; rich logging; segmentation[^15] |

Client compatibility remains broad across major OS for both WireGuard and OpenVPN; router/firewall ecosystems still favor OpenVPN in many environments, which informs protocol choice in mixed fleets[^12][^13]. Performance evidence suggests WireGuard and OpenVPN UDP exhibit similar latencies at short distances, with WireGuard maintaining advantages as distance increases; OpenVPN TCP shows higher latency due to TCP‑over‑TCP overhead[^12].

## Data Flow and Sequence Diagrams (Textual)

Three canonical sequences underpin the system’s operation.

Sequence 1: STAC discovery → scene ingest → preprocessing → COG export → PostGIS registration

1. Client queries STAC endpoints by AOI, date range, and cloud cover; normalizes items to the catalog schema.
2. For Landsat, USGS M2M application tokens authenticate and place orders; for Sentinel‑2, CDSE/SDA or OData retrieves products; AWS/Planetary routes fetch assets when cloud‑native access is desired.
3. Preprocessing applies cloud/shadow masks (Landsat QA; Sentinel‑2 L2A SCL), computes seasonal medoids/medians, and harmonizes projections and pixel sizes.
4. Exports write COGs with overviews (internal tiling) for downstream visualization and NetCDF/Zarr intermediates for pipeline robustness.
5. PostGIS registers COG references, footprint geometries, scene metadata, and lineage links from STAC items to derived products[^19][^20][^26][^10].

Sequence 2: Time‑series ingestion → Timescale hypertable inserts → index‑aware queries via Node API → React rendering

1. Ingest pipeline appends per‑pixel or per‑tile observations to a hypertable partitioned by time, optionally by region/sensor.
2. API queries parameterize time_bucket aggregations and spatial predicates (&&, ST_Intersects, ST_DWithin), returning summarized values or tiles.
3. React renders time‑series plots and maps; tile caching and viewport‑based requests keep interactions responsive[^29][^32].

Sequence 3: Near real‑time monitoring → alerts → validation workflow

1. History window is fitted using EWMA/CuSum/MoSum methods; new acquisitions trigger monitoring with confirmation rules to reduce false positives.
2. Alerts are stored with confidence levels and spatially indexed; dashboards highlight candidate disturbances.
3. Validation uses QA bands (Landsat) and SCL (Sentinel‑2 L2A) to filter spurious detections; analysts confirm events with high‑resolution imagery or field evidence[^23][^28].

## Operations, Observability, Reliability, and DR

Operations hinge on query visibility and compute profiling. pg_stat_statements tracks top offenders by total and mean execution time, calls, rows, and buffers; cache hit ratio monitors memory efficacy; parallelism settings align with CPU counts; and work_mem is tuned per operation to avoid spills[^31]. Backup and DR use Barman with base backups, continuous WAL streaming (near‑zero RPO), and PITR; retention policies employ redundancy or recovery windows; regular recovery tests verify procedures; and restore commands and remote‑ssh restore patterns are documented for cross‑host recovery[^33][^34][^35]. Security controls enforce least‑privilege access, segmentation via routing/ACLs, MFA, and centralized logging (SIEM), aligned with enterprise VPN guidance[^15].

Table 14 summarizes tuning knobs and observability metrics; Table 15 compares backup options and expected RPO/RTO; Table 16 contrasts retention models.

Table 14. Tuning knobs and observability quick reference

| Area | What to Check | Purpose |
|---|---|---|
| Query observability | pg_stat_statements: total_exec_time, mean_exec_time, calls, rows | Find heavy queries; track improvements[^31] |
| Cache efficiency | heap hit ratio | Aim ~99% hit ratio; adjust shared_buffers[^31] |
| Memory | work_mem; maintenance_work_mem | Avoid spills; speed sorts/aggregations[^31] |
| Parallelism | max_worker_processes; max_parallel_workers | Scale analytical scans across cores[^31] |
| Scaling | pooling; replication; partitioning; caching | Increase throughput; reduce load[^36] |

Table 15. Backup types and expected RPO/RTO

| Method | RPO | RTO | Operational Notes |
|---|---|---|---|
| Periodic base backups | Hours–days | Medium | Larger recovery gap; simple ops |
| Base + WAL archiving | Minutes | Medium | Narrower gap; archive_command coverage |
| Base + WAL streaming | Near‑zero | Low | Minimal data loss; requires streaming setup[^33][^34][^35] |

Table 16. Retention policy models

| Policy | Definition | When to Use |
|---|---|---|
| REDUNDANCY N | Keep N full backups | Predictable restore points; fixed inventory |
| RECOVERY WINDOW OF D DAYS | Keep backups/WAL to any time within last D days | Audits; compliance; rolling recovery windows[^33][^34] |

Observability extends beyond databases: API latencies and error rates, rate‑limit events from providers, Dask compute graphs and task durations, and event‑driven pipeline statuses on SNS are monitored and alerted.

## Integration Patterns and End-to-End Workflow Recipes

Three reference workflows integrate the architecture components.

Recipe 1: Sentinel‑2 change detection via stackstac

1. Discover Sentinel‑2 scenes via CDSE STAC; filter by AOI, dates, and cloud cover.
2. Build a lazy xarray.DataArray with stackstac; preserve metadata for QA bands; apply cloud/shadow masks using L2A SCL or QA assets.
3. Compute NDVI and align dates for bi‑temporal comparison; perform differencing/ratio operations lazily; threshold with scikit‑image.
4. Persist intermediates when beneficial; export composites to NetCDF/Zarr; save masks as COGs for visualization[^37].

Recipe 2: Landsat time‑series analysis with local I/O

1. Download Landsat assets via USGS M2M or use local copies; open bands with Rasterio; optionally use EarthPy for stacking and masking.
2. Apply scaling to TOA for L1 or use L2 surface reflectance; mask clouds/shadows with QA bands; compute indices (NDVI, NBR).
3. Build seasonal composites with Xarray groupby/resample; export results as COGs with overviews for downstream services[^38].

Recipe 3: QGIS‑assisted validation with optional GEE plugin

1. Visualize baseline masks and candidate change maps from the local stack; perform on‑screen checks and vectorization for sampling plans.
2. Where cloud resources offer scale advantages (e.g., broad baselines), use the QGIS Earth Engine plugin for targeted tasks; return results to the local stack for provenance and reproducibility[^39].

Table 17 maps each recipe to inputs, discovery, stacking, processing, and outputs.

Table 17. Workflow-to-component mapping

| Recipe | Input Sources | Discovery | Lazy Stacking | Processing | Outputs |
|---|---|---|---|---|---|
| S2 change detection | Sentinel‑2 via CDSE STAC | STAC | stackstac | Xarray+Dask; scikit‑image | Masks; change rasters; NetCDF/Zarr; COGs[^37] |
| Landsat time series | Landsat via M2M/Local | — | — | EarthPy/Rasterio + Xarray | Indices; seasonal composites; COGs[^38] |
| QGIS validation | Local stack outputs | — | — | QGIS + GEE plugin | Maps; vectors; QC artifacts[^39] |

## Risks, Trade-offs, and Decision Matrix

Every architecture choice entails trade‑offs. COGs versus SAFE/JP2 present I/O and compression trade‑offs; in‑DB raster versus out‑of‑DB COGs impact cost and scale; index strategies (GiST/SP‑GiST/BRIN) depend on data shape and query patterns; backup retention models affect compliance and cost; and scaling options (pooling/replicas/sharding) are sequenced by necessity. Table 18 consolidates key decisions and selection criteria.

Table 18. Decision matrix across key architecture choices

| Decision | Option | Criteria | When to Choose |
|---|---|---|---|
| Raster format | COG vs SAFE/JP2 | Partial reads; overviews; compression | Prefer COGs for streaming AOIs; SAFE/JP2 where archive format required; use API‑rendered outputs when appropriate[^10][^23] |
| Raster storage | in‑DB vs out‑of‑db COG | Size; cost; access patterns | Favor out‑of‑db COGs for scale and cost; in‑DB for small/medium datasets with tight transactional coupling[^8][^10] |
| Index | GiST vs SP‑GiST vs BRIN | Data shape; update frequency; kNN needs | GiST for general/kNN; SP‑GiST for clustered points; BRIN for huge ordered append‑only tables[^29][^31] |
| Partitioning | time vs region vs hybrid | Query patterns; hotspots; retention | Time for time‑series; region for global datasets; hybrid for hotspots and scale[^32] |
| Backup | redundancy vs recovery window | Audit/compliance; RPO/RTO | Redundancy for fixed restore points; recovery window for continuous audit windows[^33][^34] |
| Scaling | pooling vs replication vs sharding | Concurrency; read/write mix; data volume | Pooling and replicas first; partition; shard last[^36] |

Risk management includes rate‑limit compliance (adaptive throttling, caching), cost controls (budget alerts, COG streaming, selective bands), retention caveat handling (Sentinel‑2 zipped archives on AWS), token lifecycle management (USGS “login‑token”), and format anomalies (QA/SCL screening and reprocessing when needed)[^24][^25][^19][^23].

## Appendices: Commands, API Patterns, and Reference Snippets

Operational consistency depends on repeatable commands and endpoint patterns. The following checklist consolidates essential operations.

Table 19. Command checklist by use case

| Use Case | Commands |
|---|---|
| Create PostGIS raster environment | CREATE EXTENSION postgis; CREATE EXTENSION postgis_raster; ALTER DATABASE db SET postgis.enable_outdb_rasters = true; ALTER DATABASE db SET postgis.gdal_enabled_drivers = 'GTiff';[^8] |
| Load COG references | raster2pgsql -R -k -s <SRID> -t <W>x<H> -Y <N> /vsicurl/<COG_URL> <table> | psql <db>[^8][^10] |
| Create spatial index | CREATE INDEX ON <table> USING GIST (ST_ConvexHull(rast)); or CREATE INDEX ON <table> USING GIST (footprint);[^8][^29] |
| Hypertable creation | SELECT create_hypertable('events', 'ts', '<partition_key>', <partitions>);[^32] |
| History range index | CREATE INDEX ON <history> USING GIST (valid_range);[^40] |

API endpoint catalog (representative):

- GET /scenes?bbox=&time_start=&time_end=&sensor=&cloud_max=: Scene listing with AOI/time/sensor filters; uses index‑aware predicates.
- GET /aois/{aoi_id}/scenes?time_start=&time_end=&sensor=&cloud_max=: AOI‑scoped scene search.
- GET /changes?aoi_id=&method=&time_start=&time_end=&threshold=: Change results by method and thresholds.
- GET /timeseries?geom=&start=&end=&bucket=: Time‑bucket aggregations over spatial predicates.
- GET /tiles/{z}/{x}/{y}?layer=: Map tile retrieval (vector MVT or raster COG tiles).

Glossary highlights:

- COG: Cloud Optimized GeoTIFF—tiled and overviewed GeoTIFF enabling HTTP Range partial reads.
- SAFE: Standard Archive Format for Europe—directory structure for ESA EO products.
- JP2: JPEG2000—compressed imagery format for Sentinel‑2 bands.
- STAC: SpatioTemporal Asset Catalog—standard for describing geospatial collections/items.
- TSTZRANGE: PostgreSQL range type for timestamps with time zone, used for validity windows.
- MVT: Mapbox Vector Tile—compact tile format for vector data.

## Information Gaps

Several areas require project‑specific validation and ongoing measurement:

- USGS M2M explicit rate limits and download quotas beyond deprecation/token guidance; clients must adopt conservative backoff.
- CDSE/SDA/OData detailed quotas and throttling behaviors; adaptive throttling and monitoring are essential.
- Exact per‑scene and per‑tile size distributions across bands for planning bandwidth and storage.
- Comprehensive formal licenses and redistribution terms across platforms; institutional policy review needed.
- Empirical throughput benchmarks comparing GiST vs SP‑GiST vs BRIN on representative datasets.
- Ground‑truthed performance trade‑offs between geometry and geography for global distance/area queries under different SRIDs.
- Operational guidance for secure access to private cloud objects (signed URLs, IAM integration) and CDN edge caching specifics for COG rasters.
- Detailed RPO/RTO service levels for multi‑region PostGIS clusters using Barman alongside replication and failover orchestration.

Teams should incorporate measurement into CI/CD, pilot workloads, and iterate architecture choices based on empirical evidence.

## References

[^1]: Cloud Optimized GeoTIFF (COG) — Official Site. https://cogeo.org/
[^2]: OGC COG Specification (21‑026). https://docs.ogc.org/is/21-026/21-026.html
[^3]: Accessing Data in Cloud‑Optimized GeoTIFFs (COGs) with Python — Cloud Native Geospatial Guide. https://guide.cloudnativegeo.org/cloud-optimized-geotiffs/accessing-cogs-in-python.html
[^4]: RFC 7233: HTTP Range Requests. https://tools.ietf.org/html/rfc7233
[^5]: Rasterio: access to geospatial raster data — rasterio documentation. https://rasterio.readthedocs.io/
[^6]: Parallel Computing with Dask — Xarray documentation. https://docs.xarray.dev/en/stable/user-guide/dask.html
[^7]: Dask Best Practices — Dask documentation. https://docs.dask.org/en/stable/best-practices.html
[^8]: Crunchy Data: Using Cloud Rasters with PostGIS. https://www.crunchydata.com/blog/using-cloud-rasters-with-postgis
[^9]: PostGIS Documentation: Raster Data Management, Queries, and Applications. https://postgis.net/docs/using_raster_dataman.html
[^10]: GDAL Documentation: COG Driver. https://gdal.org/en/stable/drivers/raster/cog.html
[^11]: WireGuard: fast, modern, secure VPN tunnel. https://www.wireguard.com/
[^12]: OpenVPN vs WireGuard: Top Two VPN Protocols Side By Side. https://www.goodaccess.com/blog/openvpn-vs-wireguard
[^13]: WireGuard vs. OpenVPN | What Are the Differences? https://www.paloaltonetworks.com/cyberpedia/wireguard-vs-openvpn
[^14]: 5 Best Self-hosted VPN/Proxy Solutions in 2024. https://www.linuxbabe.com/vpn/best-self-hosted-vpn-proxy-solutions
[^15]: Enterprise VPN Solutions - Security, Control, and Flexibility at Scale. https://www.fortinet.com/resources/cyberglossary/enterprise-vpn-solutions
[^16]: Work with Landsat Remote Sensing Data in Python — Earth Lab. https://earthdatascience.org/courses/use-data-open-source-python/multispectral-remote-sensing/landsat-in-Python/
[^17]: Basic example — stackstac documentation. https://stackstac.readthedocs.io/en/latest/basic.html
[^18]: Sentinel‑2 L1C — Sentinel Hub. https://docs.sentinel-hub.com/api/latest/data/sentinel-2-l1c/
[^19]: USGS M2M Application Token Documentation. https://www.usgs.gov/media/files/m2m-application-token-documentation
[^20]: APIs — Copernicus Data Space Ecosystem. https://documentation.dataspace.copernicus.eu/APIs.html
[^21]: Using the Planetary Computer’s Data API — Quickstart. https://planetarycomputer.microsoft.com/docs/quickstarts/using-the-data-api/
[^22]: USGS Landsat — Registry of Open Data on AWS. https://registry.opendata.aws/usgs-landsat/
[^23]: Sentinel‑2 — Registry of Open Data on AWS. https://registry.opendata.aws/sentinel-2/
[^24]: Planetary Computer: Documentation. https://planetarycomputer.microsoft.com/docs
[^25]: Landsat Collection 2 Level‑1 Data — USGS. https://www.usgs.gov/landsat-missions/landsat-collection-2-level-1-data
[^26]: Sentinel‑2 L2A — Sentinel Hub. https://docs.sentinel-hub.com/api/latest/data/sentinel-2-l2a/
[^27]: Landsat 8‑9 Collection 2 Level 2 Science Product Guide (PDF). https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/media/files/LSDS-1619_Landsat8-9-Collection2-Level2-Science-Product-Guide-v6.pdf
[^28]: PostGIS Documentation: Using PostGIS Data Management. https://postgis.net/docs/using_postgis_dbmanagement.html
[^29]: PostGIS Workshop: Spatial Indexes. https://postgis.net/workshops/postgis-intro/indexing.html
[^30]: Crunchy Data: PostGIS Performance and Postgres Tuning. https://www.crunchydata.com/blog/postgis-performance-postgres-tuning
[^31]: mrzk.io: Building High-Performance Spatial Apps. https://mrzk.io/posts/building-high-performance-spatial-apps/
[^32]: TimescaleDB Docs: Architecture (Hypertables, Chunks). https://docs.timescale.com/latest/introduction/architecture
[^33]: Barman Manual 3.10.0. https://docs.pgbarman.org/release/3.10.0/
[^34]: Stormatics: PostgreSQL Backup and Recovery Management using Barman. https://stormatics.tech/blogs/postgresql-backup-and-recovery-management-using-barman
[^35]: Barman 1.6.1 Tutorial. https://docs.pgbarman.org/release/1.6.1/
[^36]: Instaclustr: PostgreSQL Best Practices for 2025. https://www.instaclustr.com/education/postgresql/top-10-postgresql-best-practices-for-2025/
[^37]: stackstac: Turn a STAC catalog into a Dask‑based xarray — GitHub. https://github.com/gjoseph92/stackstac
[^38]: Work with Landsat Remote Sensing Data in Python — Earth Lab. https://earthdatascience.org/courses/use-data-open-source-python/multispectral-remote-sensing/landsat-in-Python/
[^39]: QGIS Earth Engine Plugin — Official Repository. https://plugins.qgis.org/plugins/ee_plugin/
[^40]: PostGIS Workshop: Tracking Edit History using Triggers. https://postgis.net/workshops/postgis-intro/history_tracking.html
[^41]: API — Sentinel Hub. https://www.sentinel-hub.com/develop/api/
[^42]: Beginner’s Guide — Sentinel Hub. https://docs.sentinel-hub.com/api/latest/user-guides/beginners-guide/
[^43]: Sentinelsat — Python API Overview. https://sentinelsat.readthedocs.io/en/stable/api_overview.html
[^44]: ESDS‑RFC‑049 Cloud Optimized GeoTIFF V1 — NASA Earthdata. https://www.earthdata.nasa.gov/s3fs-public/2024-05/ESDS-RFC-049%20Cloud%20Optimized%20GeoTIFF%20V1.pdf
[^45]: Planetary Computer: Landsat Collection. https://planetarycomputer.microsoft.com/dataset/group/landsat
[^46]: SpatioTemporal Asset Catalogs (STAC) — Specification. https://stacspec.org/
[^47]: Reading Data from the STAC API — Planetary Computer Quickstart. https://planetarycomputer.microsoft.com/docs/quickstarts/reading-stac/
[^48]: USGS: SpatioTemporal Asset Catalog (STAC). https://www.usgs.gov/landsat-missions/spatiotemporal-asset-catalog-stac
[^49]: Copernicus Data Space: STAC product catalogue. https://documentation.dataspace.copernicus.eu/APIs/STAC.html
[^50]: Change Detection – Landscape Toolbox. https://landscapetoolbox.org/remote-sensing-methods/change-detection/
[^51]: Exercise: Vegetation change detection — Digital Earth Africa Training. https://training.digitalearthafrica.org/en/latest/session_5/02_vegetation_exercise.html
[^52]: Clean Remote Sensing Data in Python – Clouds, Shadows & Cloud Masks (Landsat) — Earth Data Science. https://earthdatascience.org/courses/use-data-open-source-python/multispectral-remote-sensing/landsat-in-Python/remove-clouds-from-landsat-data/
[^53]: Rbeast: Bayesian Change-Point Detection and Time Series Decomposition (BEAST). https://github.com/zhaokg/Rbeast
[^54]: ec-jrc/nrt: Near Real Time monitoring of satellite image time-series (Python). https://github.com/ec-jrc/nrt
[^55]: pyMannKendall: A Python package for non-parametric Mann–Kendall family of trend tests. https://github.com/mmhs013/pyMannKendall
[^56]: nrt: operational monitoring of satellite image time-series in Python — JOSS (2024). https://doi.org/10.21105/joss.06815
[^57]: Machine learning approaches to Landsat change detection analysis (2024). https://www.tandfonline.com/doi/full/10.1080/07038992.2024.2448169
[^58]: Implementation of the LandTrendr Algorithm on Google Earth Engine — Remote Sensing (2018). http://www.mdpi.com/2072-4292/10/5/691
[^59]: lt-gee-py: Python interface to GEE LandTrendr. https://github.com/eMapR/lt-gee-py
[^60]: Planetary Computer: Data Catalog. https://planetarycomputer.microsoft.com/catalog
[^61]: ESDS‑RFC‑049 Cloud Optimized GeoTIFF V1 — NASA Earthdata. https://www.earthdata.nasa.gov/s3fs-public/2024-05/ESDS-RFC-049%20Cloud%20Optimized%20GeoTIFF%20V1.pdf
[^62]: Satellite Image Deep Learning Techniques — GitHub. https://github.com/satellite-image-deep-learning/techniques
[^63]: Counting features in satellite images using scikit‑image — Esri Python Samples. https://developers.arcgis.com/python/latest/samples/counting-features-in-satellite-images-using-scikit-image/
[^64]: Change Detection of Buildings from Satellite Imagery — Esri Python Samples. https://developers.arcgis.com/python/latest/samples/change-detection-of-buildings-from-satellite-imagery/