# Watershed Disturbance Mapping System Database Schema - Technical Design and Migration Blueprint

## Executive Summary and Objectives

This document defines a standards-aligned, implementation-ready technical architecture for the Watershed Disturbance Mapping System’s relational database, optimized for geospatial analytics and time-series workloads. The design leverages PostgreSQL 14 with PostGIS 3.2 for spatial storage and querying, and TimescaleDB for scalable time-series management. The blueprint translates platform and domain requirements—stemming from the specified processing of Landsat and Sentinel-2 imagery, detection algorithms (LandTrendr and FNRT), alert thresholds, and quality-control (QC) protocols—into a coherent data model, indexing strategy, and migration playbook.

The system objectives are to support reliable detection of disturbances such as logging, clearing, fire, flooding, and infrastructure development, while providing a foundation for near-real-time monitoring, historical baseline analysis, and operational reporting. The schema prioritizes correctness (spatial reference identifiers, enumerations, constraints), performance (spatial GiST indices, hypertable partitioning), integrity (foreign keys, CHECKs, temporal consistency via TSTZRANGE), and operability (migration framework, backup and recovery, observability and tuning).

Key outcomes include:
- A clear conceptual model and detailed logical schema for entities (watersheds, detections, time-series, baselines, users, alerts, QC).
- Indexing and query optimization strategies designed for large geospatial datasets (GiST, SP-GiST, BRIN) and scalable time-series (TimescaleDB hypertables).
- Temporal history and auditing via PostgreSQL range types and triggers for time-travel queries.
- Migration scripts that support forward and rollback-safe evolution across environments.
- A query playbook with canonical patterns for spatial pruning, nearest neighbor, bucketed aggregations, and time-travel.
- Backup, recovery, and disaster recovery (DR) guidance aligned to operational SLAs using Barman, WAL streaming, and PITR.
- A consolidated mapping of requirements to design decisions and artifacts.

### Deliverables

The implementation is distributed across schema DDL, migration scripts, seed data, and query templates, accompanied by comprehensive documentation.

- code/database/001_initial_schema.sql — Core table definitions, enumerations, constraints, GiST spatial indices; baseline migration into a Timescale hypertable.
- code/database/002_advanced_indexes.sql — Additional spatial and compound indices (SP-GiST, BRIN), partial/targeting indexes, and hypertable-specific optimizations.
- code/database/003_migrations_framework.sql — TSTZRANGE temporal triggers, forward/rollback migration scaffolds, and environment hooks.
- code/database/004_sample_data.sql — Enumerations and minimal seed data to validate constraints and queries in development.
- code/database/005_common_queries.sql — Canonical query templates and views for spatial AOI intersect, kNN, time bucketing, and time-travel predicates.
- docs/database_schema.md — Comprehensive written schema documentation with usage examples, operational guidance, and optimization techniques.

Information gaps to be finalized during deployment include: definitive SRIDs per region, precise Timescale chunk sizes and secondary partition keys, finalized enumerations beyond the defined subsets, retention durations and archival policy, and SLAs for RPO/RTO and associated Barman operational specifics.

## Requirements Baseline and Stakeholder Needs

The system ingests Landsat (8/9) and Sentinel-2 (A/B) imagery; optionally integrates Sentinel-1 SAR for cloud-penetrating observations. It computes spectral indices (NDVI, NBR, TCG), applies cloud masking and atmospheric correction, and performs monthly processing (5-day revisit cadence). Detections compare recent observations to baselines (e.g., rolling 3-year medians) and apply persistence and confidence gating (e.g., alert threshold >0.8). Minimum detectable patch size is around 0.04 hectares. The architecture emphasizes RBAC (admin, analyst, viewer), secure APIs, and cloud deployment with read replicas and caching where appropriate.

To anchor decisions, Table 1 summarizes requirements and their mapping into schema, constraints, indices, and workflows.

To illustrate how requirements are realized in the database, Table 1 presents a concise requirement-to-design matrix.

| Requirement | Schema Element | Constraint/Index | Workflow/Query |
|---|---|---|---|
| Multi-sensor imagery (Landsat/Sentinel) | time_series.sensor, platform; enumerations for sensors | CHECK constraints; BTREE(sensor, platform) | Harmonization and filtering by sensor/time |
| Spectral indices (NDVI, NBR, TCG) | time_series.ndvi, nbr, tcg | CHECKs on numeric ranges where applicable | time_bucket aggregations; baseline comparisons |
| Monthly processing, 5-day cadence | time_series.ts (timestamptz) | Hypertable partitioning by time; BTREE(ts) | time_bucket('1 month', ts); rolling windows |
| AOI intersect (watershed boundaries) | watersheds.geom; detections.geom | GiST indices on geometry | AOI intersect using && and ST_Intersects[^2] |
| Minimum patch size (~0.04 ha) | detections.area_ha; geom | CHECK area_ha ≥ threshold | Filter out sub-threshold detections |
| Confidence gating (>0.8 alerts) | detections.confidence; alerts.status | CHECK confidence ∈ [0,1]; enum for status | Alert generation when confidence > threshold |
| Baselines (rolling 3-year median) | baselines.valid_range; baselines.median/mad/stddev | TSTZRANGE GiST index | Valid_range @> T for time-travel |
| QC: cloud cover, min observations | quality_control; time_series.qa_flags | CHECK ranges; enum flags | Exclude "CLOUD"/"SHADOW" observations |
| RBAC roles | users.role | CHECK role ∈ {admin,analyst,viewer} | RBAC enforcement at API and DB layer |
| Near-real-time monitoring | time_series partitions | Hypertable chunk sizing | Bucketed counts, AOI filters with DWithin[^9] |
| Historical analysis | baselines, detections_history | TSTZRANGE GiST | Time-travel and interval overlap queries[^13][^14] |

Table 1. Requirements-to-Design matrix aligning functional needs to schema elements and workflows.

The overarching design enforces constraints at the database level to minimize downstream processing defects. Index-aware predicates and partitioning are selected to meet latency and throughput objectives for map serving and analytical workloads.[^2][^4][^9]

### Functional Requirements

- Spatial entities: watersheds and detection footprints as geometries with GiST indices and consistent SRIDs.
- Temporal series: time_series table as a hypertable to store per-observation spectral indices, sensor metadata, QA flags, and spatial references.
- Baselines: baselines capture rolling medians, robust spreads, and validity windows, scoped by ecosystem type or region.
- Alerts: notifications triggered by high-confidence detections and area thresholds, with delivery status and acknowledgment tracking.
- QC: thresholds for cloud cover, minimum clear observations, and QA flags to suppress low-quality data.

### Non-Functional Requirements

- Spatial indexing and query optimization: Use GiST for geometries and SP-GiST/BRIN as appropriate; employ index-aware predicates and bounding-box pruning.[^1][^4]
- Time-series scalability: Hypertable partitioning with chunk sizing tuned to write/read profiles; optional secondary partitioning (e.g., watershed_id).[^9]
- Availability and DR: Barman with base backups, WAL streaming, and PITR; validate RPO/RTO in non-prod.[^10][^11][^12]
- Observability and tuning: pg_stat_statements for heavy queries; tune work_mem, parallelism, and shared_buffers; maintain VACUUM ANALYZE hygiene.[^5]

## Data Architecture Fundamentals (PostGIS and Spatial Types)

The architecture distinguishes between geometry (planar operations in a projected SRID), geography (spherical calculations over large extents), and raster (gridded coverages). For regional operations and performance, geometry is preferred, with SRIDs selected to keep units in meters and support fast planar computations. Geography is reserved for global distance/area calculations. Raster is employed conceptually for imagery metadata and references; actual pixel data is stored as out-of-database COGs for cost and scale efficiency.[^1]

Consistency in SRIDs across predicates is mandatory to preserve index awareness. When transformations are necessary, apply ST_Transform at query boundaries (not inline on unindexed columns) and ensure predicates operate in a single SRID.

Table 2 summarizes the PostGIS data types and their typical use cases.

To guide spatial type selection, Table 2 contrasts PostGIS geometry, geography, and raster.

| Data Type | Function Coverage | Performance | Supported Shapes | Typical Use Cases |
|---|---|---|---|---|
| geometry | Broadest set of spatial functions; index-aware predicates | High in projected SRS with meter units | Points, LineStrings, Polygons, Multi* | AOI intersect, spatial joins, nearest neighbor |
| geography | Geodetic calculations | Lower than geometry due to spherical math | No curves/TIN/PolyhedralSurface | Global distance/area; worldwide phenomena |
| raster | Coverage analytics; sampling | High for out-of-db COG access when indexed | Gridded coverages with bands | Imagery and DEMs; time-series rasters |

Table 2. PostGIS data type comparison.[^1]

### Geometry vs Geography

Choose geometry for regional extents where a suitable projected SRID yields meter units, maximizing performance and function coverage. Choose geography when spanning continents or requiring spheroidal accuracy for distance/area across the globe. Avoid mixing SRIDs in predicates to preserve index usage; apply ST_Transform at the edge of queries.[^1]

## Conceptual Model and Domain Relationships

The conceptual model captures core entities and event semantics:

- watersheds: spatial boundaries (polygon/multipolygon) with SRID metadata.
- detections: change events with polygon/multipolygon footprints, detection date, disturbance type, confidence score, area, and lifecycle status.
- time_series: observations of spectral indices (NDVI, NBR, TCG), with timestamps, sensor/platform identifiers, QA flags, and spatial references; implemented as a hypertable.
- baselines: rolling medians and robust statistics for indices, scoped by ecosystem/region, with validity windows.
- users: identity and role metadata for RBAC.
- alerts: notification records linked to detections, with delivery status and acknowledgments.
- quality_control: thresholds and outcomes for data quality checks (cloud cover, minimum observations).

Table 3 outlines relationships and cardinalities to enforce integrity and enable performant joins.

To clarify how entities relate, Table 3 describes parent-child relationships and join semantics.

| Entity | Related Entity | Cardinality | Relationship Notes |
|---|---|---|---|
| watersheds | detections | 1:N | Detections occur within watershed extents; optional FK with spatial checks |
| watersheds | time_series | 1:N | Observations keyed to watersheds or spatial tiles |
| watersheds | baselines | 1:N | Baselines scoped by ecosystem/region within watershed |
| detections | alerts | 1:N | Alerts generated for high-confidence detections |
| users | alerts | 1:N | Users receive alerts; status and ack tracking |
| time_series | quality_control | 1:N | QC applies per observation window and thresholds |

Table 3. Entity relationship matrix with cardinalities and join considerations.

### Entity Descriptions and Event Semantics

watersheds are the spatial frame of reference. detections represent state changes and support lifecycle states such as new, confirmed, false_positive, and resolved. time_series captures per-observation metrics with QA flags and supports temporal aggregations. baselines provide reference distributions and validity windows. users define roles. alerts manage notification workflows and delivery status. quality_control logs thresholds and outcomes used to filter observations.

## Logical Schema Design and Table Definitions

The schema emphasizes explicit spatial columns, enumerations via CHECK constraints, and a hypertable for time_series. Baselines include TSTZRANGE validity windows and robust statistics (median, MAD, stddev, sample size) to support temporal comparisons.

Table 4 provides a comprehensive column catalog (core fields), ensuring clear semantics and constraints.

To serve as the canonical mapping for implementation, Table 4 details columns, types, and constraints.

| Table | Column | Type | Constraints/Default | Notes |
|---|---|---|---|---|
| watersheds | watershed_id | UUID | PK, NOT NULL | Unique identifier |
|  | name | text | NOT NULL | Human-readable name |
|  | geom | geometry(Polygon/MultiPolygon, SRID) | NOT NULL | Watershed boundary |
|  | srid | int | NOT NULL | SRS identifier |
| detections | detection_id | UUID | PK, NOT NULL | Unique identifier |
|  | watershed_id | UUID | FK → watersheds.watershed_id | Optional spatial validation |
|  | geom | geometry(Polygon/MultiPolygon, SRID) | NOT NULL | Detection footprint |
|  | detection_date | date | NOT NULL | Date of detection |
|  | disturbance_type | text | CHECK in (logging, clearing, fire, flooding, infrastructure, other) | Domain enumeration |
|  | confidence | numeric(5,4) | CHECK 0 ≤ x ≤ 1 | Confidence score |
|  | area_ha | numeric | CHECK x ≥ 0 | Area in hectares |
|  | status | text | CHECK in (new, confirmed, false_positive, resolved) | Lifecycle state |
|  | valid_range | tstzrange | GiST index | Temporal validity |
| time_series | series_id | UUID | PK, NOT NULL | Unique identifier |
|  | watershed_id | UUID | FK → watersheds.watershed_id | Optional |
|  | ts | timestamptz | NOT NULL | Observation time (hypertable partition key) |
|  | geom | geometry(Point/Polygon, SRID) | NOT NULL | Pixel center or tile footprint |
|  | sensor | text | CHECK in (landsat-8, landsat-9, sentinel-2a, sentinel-2b) | Sensor enumeration |
|  | platform | text | NOT NULL | Landsat/Sentinel |
|  | ndvi | numeric | NULL | Index value |
|  | nbr | numeric | NULL | Index value |
|  | tcg | numeric | NULL | Index value |
|  | qa_flags | text[] | NULL | Flags subset {"CLOUD","SHADOW","SNOW","AOT_HIGH","WVP_HIGH","SATURATED","DEMOID"} |
| baselines | baseline_id | UUID | PK, NOT NULL | Unique identifier |
|  | ecosystem_type | text | NOT NULL | Forest, riparian, etc. |
|  | index_name | text | NOT NULL | NDVI/NBR/TCG |
|  | median | numeric | NOT NULL | Central tendency |
|  | mad | numeric | NULL | Robust spread |
|  | stddev | numeric | NULL | Optional spread |
|  | sample_size | int | CHECK x ≥ 0 | Underlying sample |
|  | valid_start | timestamptz | NOT NULL | Validity start |
|  | valid_end | timestamptz | NULL | Open-ended allowed |
|  | valid_range | tstzrange | GiST index | Temporal validity |
| users | user_id | UUID | PK, NOT NULL | Unique identifier |
|  | username | text | UNIQUE, NOT NULL | Login name |
|  | email | text | UNIQUE, NOT NULL | Contact |
|  | role | text | CHECK in (admin, analyst, viewer) | RBAC |
| alerts | alert_id | UUID | PK, NOT NULL | Unique identifier |
|  | detection_id | UUID | FK → detections.detection_id | Linked detection |
|  | recipient | text | NOT NULL | Email/phone/webhook |
|  | channel | text | CHECK in (email, sms, webhook) | Delivery channel |
|  | status | text | CHECK in (pending, sent, delivered, failed, canceled, acknowledged) | Lifecycle |
| quality_control | qc_id | UUID | PK, NOT NULL | Unique identifier |
|  | cloud_cover_threshold | numeric | CHECK 0 ≤ x ≤ 100 | Threshold for filtering |
|  | min_clear_obs | int | CHECK x ≥ 0 | Min valid obs |
|  | outcome | text | CHECK in (passed, failed, warnings) | QC result |
|  | notes | text | NULL | Freeform comments |

Table 4. Column and constraint catalog per table (core fields).

### Enumerations and Domain Constraints

CHECK constraints enforce enumerations for disturbance types, roles, alert statuses, sensor lists, and QA flags. This approach reduces ambiguity, prevents invalid states, and ensures consistent behavior across services.[^20][^21]

### Spatial Types and SRID Strategy

Spatial operations rely on geometries with consistent SRIDs chosen per region to yield meter units. Geography is used sparingly for global distance/area calculations. Raster data is referenced conceptually and stored as out-of-database COGs for scale and cost efficiency; PostGIS raster functions support metadata indexing where needed.[^1]

## Relationships and Referential Integrity

Foreign keys (FKs) enforce integrity across entities. Watersheds link to detections and time-series observations; detections link to alerts; baselines reference watersheds and ecosystem types; alerts reference users for recipient tracking. Delete policies generally restrict cascading deletes on parent entities to preserve historical records. When strict lifecycle dependencies exist (e.g., alerts tied exclusively to detections), a CASCADE policy may be applied where appropriate.

Table 5 summarizes FK policies and reasoning.

To clarify referential policies, Table 5 lists FKs and delete behaviors.

| Parent | Child | FK Column | On Delete | Rationale |
|---|---|---|---|---|
| watersheds | detections | detections.watershed_id → watersheds.watershed_id | RESTRICT | Preserve detection history |
| detections | alerts | alerts.detection_id → detections.detection_id | CASCADE or RESTRICT | Dependent lifecycle or strict linkage |
| watersheds | time_series | time_series.watershed_id → watersheds.watershed_id | RESTRICT | Maintain observation provenance |
| watersheds | baselines | baselines.watershed_id → watersheds.watershed_id | RESTRICT | Keep historical baselines intact |
| users | alerts | alerts.recipient → users.username | SET NULL | Allow alerts even if user record changes |

Table 5. FK matrix with delete policies.

### Constraint Strategy

Constraints enforce NOT NULL for core fields, CHECK ranges for numerics and enumerations, and uniqueness for user identity. Status transitions may be mediated by the application layer or implemented via triggers when stricter workflows are required. These patterns align with performance tuning guidance and maintain query stability under varying workloads.[^5]

## Spatial Indexing and Query Patterns

The indexing strategy follows best practices for large geospatial datasets. GiST is the default for geometry columns and supports bounding-box pruning (&&), precise overlap checks (ST_Intersects), and nearest neighbor (<->). SP-GiST can be used for massive point datasets with natural clustering; BRIN is effective for very large, append-only tables where data is physically ordered (e.g., by time), though it does not support kNN.[^1][^4]

Table 6 summarizes index methods and their best-fit workloads.

To facilitate selection, Table 6 compares GiST, SP-GiST, and BRIN.

| Index Method | Strengths | Limitations | Best Use Cases |
|---|---|---|---|
| GiST | Versatile; supports kNN; broad predicate support | Larger index | General geometries; AOI intersects; nearest neighbor |
| SP-GiST | Good on clustered point distributions | No kNN; lossy behavior | Massive points with natural partitioning |
| BRIN | Tiny footprint; fast build | Inclusion ops only; no kNN | Huge, append-only, time-ordered tables |

Table 6. Index methods and recommended use cases.[^1][^4]

Predicate selection is crucial for performance. Table 7 provides a decision matrix for common tasks.

To ensure index-aware execution, Table 7 lists preferred predicates.

| Task | Prefer | Avoid | Reason |
|---|---|---|---|
| AOI intersect | && then ST_Intersects | Raw ST_Intersection | Exploit spatial index pruning[^2][^3] |
| Distance filter | ST_DWithin | ST_Distance in WHERE | Bounding-box expansion enables index[^2] |
| Nearest neighbor | ORDER BY <-> LIMIT N | ORDER BY ST_Distance | kNN operator leverages GiST[^2] |

Table 7. Predicate selection for efficient spatial queries.[^2][^3]

Subdividing large polygons (ST_Subdivide) can drastically improve pruning and CPU usage for complex footprints.[^17][^22]

## Time-Series Optimization (TimescaleDB)

The time_series table is converted to a Timescale hypertable, partitioning on ts (timestamptz). Chunk sizes are chosen based on write rates, query horizons, and data locality. For regional hotspots or skewed ingestion, a secondary partition dimension (e.g., watershed_id) can distribute write load and improve pruning. time_bucket simplifies temporal aggregations (e.g., monthly NDVI averages) and supports retention operations at chunk granularity.[^9][^16]

Table 8 outlines chunk sizing and index recommendations aligned to common workload profiles.

To guide implementation, Table 8 recommends chunk sizes and indices.

| Workload Profile | Hypertable Keys | Chunk Size | Additional Indexes |
|---|---|---|---|
| Uniform global ingestion | ts | 7–30 days | GiST(geom); BTREE(sensor, platform) |
| Regional hotspots | ts, watershed_id | 7–14 days | BTREE(watershed_id, ts); GiST(geom) |
| High-frequency per-pixel | ts | 1–7 days | Composite indices on qa_flags; GiST(geom) |

Table 8. Chunk sizing and index recommendations for time_series.[^9][^16]

Retention policies should balance cost and performance,归档ing cold chunks while keeping recent data hot for interactive queries. Hybrid sub-partitioning by region can further isolate workloads and simplify maintenance.[^16]

## Temporal History and Auditing with Range Types

Mutable entities (detections, baselines, users) maintain temporal validity with TSTZRANGE columns. A corresponding history table records ranges and operation types (INSERT, UPDATE, DELETE), with triggers ensuring ranges are created, closed, and reopened consistently. Queries use @> for time-travel and && for interval overlap, enabling audits and reproducible historical analysis.[^13][^14]

Table 9 codifies history operations and supported predicates.

To standardize auditing, Table 9 describes operations and indices.

| Operation | Trigger Action | Index | Query Predicate |
|---|---|---|---|
| INSERT | Open-ended range [now, NULL) | GiST(valid_range) | valid_range @> now() |
| UPDATE | Close old, open new range | GiST(valid_range), GiST(geom) | valid_range @> T; valid_range && tstzrange(T1,T2) |
| DELETE | Close current range | GiST(valid_range) | valid_range @> T |

Table 9. History operations and index coverage using TSTZRANGE.[^13][^14]

This design avoids application-only tracking and provides database-level guarantees for temporal consistency.

## Constraints, Data Quality, and Validation

QC thresholds (e.g., cloud cover ≤30%) and minimum clear observations (e.g., ≥3 per 90 days) are enforced through QC tables and CHECK constraints, with QA flags filtering observations (e.g., exclude "CLOUD", "SHADOW"). Confidence gating (alert threshold >0.8) and area thresholds (≥0.04 ha) prevent spurious alerts. Unique constraints on users’ identity fields avoid duplicates.

Table 10 lists key constraints per table and explains their purpose.

To ensure data quality, Table 10 enumerates constraints.

| Table | Constraint | Purpose |
|---|---|---|
| detections | CHECK (confidence BETWEEN 0 AND 1) | Valid confidence scores |
| detections | CHECK (area_ha ≥ 0) | Non-negative area |
| detections | CHECK (status IN (...)) | Lifecycle enforcement |
| alerts | CHECK (status IN (...)) | Delivery status consistency |
| quality_control | CHECK (cloud_cover_threshold BETWEEN 0 AND 100) | Valid cloud threshold |
| quality_control | CHECK (min_clear_obs ≥ 0) | Non-negative observation count |
| users | UNIQUE (username), UNIQUE (email) | Identity uniqueness |
| time_series | CHECK (sensor IN (...)) | Sensor enumeration |

Table 10. Key constraints per table aligned to QC protocols.[^2][^5]

These constraints ensure only valid, high-quality data flows into detection algorithms and alert workflows, reducing false positives and preserving operational trust.

## Migration Scripts and Versioning Strategy

The migration framework provides forward and rollback-safe scripts with transactional DDL where feasible and concurrency-safe index creation. It includes environment hooks for SRID policies, retention settings, and role seeding. Timescale migrations convert time_series into hypertables and add optional secondary partition dimensions. Statistics are refreshed via VACUUM ANALYZE after major changes.

Table 11 provides a migration checklist by script and change type.

To facilitate controlled evolution, Table 11 outlines each script’s scope.

| Script | Change Type | Forward Action | Rollback Action | Dependencies |
|---|---|---|---|---|
| 001_initial_schema.sql | Schema create | Create tables, PK/FK, CHECKs, GiST | DROP SCHEMA (non-prod) or reverse DDL | Extensions installed |
| 002_advanced_indexes.sql | Index add | CONCURRENTLY create SP-GiST/BRIN | DROP INDEX | Base schema present |
| 003_migrations_framework.sql | Triggers/history | Create TSTZRANGE triggers, history tables | DROP TRIGGERS/TABLES | Core tables exist |
| 004_sample_data.sql | Seed data | Insert enumerations/minimal rows | DELETE FROM ... | Schema created |
| 005_common_queries.sql | Views/templates | Create query templates | DROP VIEW/FUNCTION | N/A |

Table 11. Migration checklist by script and dependencies.

Guidance:
- Use CONCURRENTLY for index additions to avoid write locks.
- Parameterize SRIDs and retention windows per environment.
- Run EXPLAIN/ANALYZE and VACUUM ANALYZE after loads to maintain planner fidelity.[^5]

## Query Playbook and Performance Patterns

Canonical query patterns demonstrate how to exploit spatial pruning and hypertable aggregations:

AOI intersect (bounding-box pre-filter + precise overlap):

```
-- AOI intersect using bounding box and precise predicate
SELECT d.detection_id, d.detection_date, d.disturbance_type, d.confidence
FROM detections d
WHERE d.geom && ST_MakeEnvelope(xmin, ymin, xmax, ymax, SRID)
  AND ST_Intersects(d.geom, ST_MakeEnvelope(xmin, ymin, xmax, ymax, SRID));
```

Nearest neighbor (kNN via <->):

```
-- Nearest detections to a point
SELECT d.detection_id, d.detection_date, d.confidence
FROM detections d
ORDER BY d.geom <-> ST_MakePoint(x, y, SRID)
LIMIT 10;
```

Time bucketed aggregations (time_bucket):

```
-- Monthly NDVI averages per watershed
SELECT time_bucket('1 month', ts) AS month,
       watershed_id,
       AVG(ndvi) AS avg_ndvi
FROM time_series
WHERE ts >= NOW() - INTERVAL '24 months'
  AND ndvi IS NOT NULL
GROUP BY month, watershed_id
ORDER BY month DESC;
```

Time travel and interval overlap:

```
-- State at time T
SELECT detection_id, geom, status
FROM detections
WHERE valid_range @> TIMESTAMPTZ 'T';

-- Changes between T1 and T2
SELECT detection_id, status, valid_range
FROM detections
WHERE valid_range && tstzrange(TIMESTAMPTZ 'T1', TIMESTAMPTZ 'T2');
```

Index-aware predicates and explicit bounding-box filters are emphasized to minimize CPU and maximize index pruning.[^2][^3][^9][^23]

## Backup, Recovery, and DR Strategy

Barman provides physical backups, WAL archiving, and PITR. Continuous WAL streaming via pg_receivewal reduces RPO; retention policies balance redundancy with recovery windows. Recovery drills validate RTO/RPO targets and operational readiness.[^10][^11][^12]

Table 12 compares backup methods against RPO/RTO.

To align DR to SLAs, Table 12 summarizes backup strategies.

| Method | RPO | RTO | Notes |
|---|---|---|---|
| Periodic base backups | Hours–Days | Medium | Simple operations; larger recovery gap |
| Base + WAL archiving | Minutes | Medium | Archive coverage required |
| Base + WAL streaming | Near-zero | Low | Minimal data loss; streaming setup[^11][^12] |

Table 12. Backup methods and expected RPO/RTO.

Table 13 contrasts retention policies.

To govern cost and compliance, Table 13 presents retention models.

| Policy | Definition | Use Case |
|---|---|---|
| REDUNDANCY N | Keep N full backups | Predictable restore points |
| RECOVERY WINDOW D DAYS | Keep backups/WAL within last D days | Continuous audit windows[^10][^11] |

Table 13. Retention policy models.

### Operational Playbook

- Automate base backups; monitor WAL streaming and compression; enforce retention.
- Configure restore_command and PITR; rehearse restores in non-prod.
- Integrate monitoring and alerting for backup health and recovery outcomes.

## Risks, Trade-offs, and Decision Matrix

Key decisions include spatial type selection, raster storage strategy, indexing choices, partitioning approaches, and backup policy. Table 14 consolidates the decision criteria.

To support informed choices, Table 14 provides a decision matrix.

| Decision | Option | Criteria | When to Choose |
|---|---|---|---|
| Spatial type | geometry vs. geography vs. raster | Coverage, accuracy, function set, cost | Geometry for regional ops; geography for global distance/area; raster for imagery (COGs)[^1] |
| Raster storage | in-DB raster vs. out-of-db COG | Dataset size, cost, access | Prefer COGs for scale/cost; in-DB for small tightly coupled datasets[^6][^8][^18][^19] |
| Index | GiST vs. SP-GiST vs. BRIN | Data shape, kNN needs, update frequency | GiST for general + kNN; SP-GiST for clustered points; BRIN for huge append-only tables[^1][^4] |
| Partitioning | time vs. region vs. hybrid | Query shape, hotspots, retention | Time for time-series; region for global; hybrid for scale and hotspots[^9][^16] |
| Backup | redundancy vs. recovery window | Compliance, RPO/RTO targets | Redundancy for fixed restore points; recovery window for audit[^10][^11] |

Table 14. Decision matrix across core architecture choices.

Information gaps: exact SRIDs per region, detailed hypertable chunk sizing, full enumerations, retention durations, and operational SLAs for Barman in production. These must be closed through environment-specific testing and policy decisions.

## Appendix: Reference Queries and Functions

Index-aware predicates quick reference:
- && (bounding box operator)
- ST_Intersects / ST_Within / ST_Contains / ST_CoveredBy / ST_Overlaps / ST_Touches / ST_Equals / ST_Disjoint
- ST_DWithin (distance predicate)
- ORDER BY geom <-> point LIMIT N (nearest neighbor)[^2]

Temporal history operations:
- valid_range @> timestamp (time travel)
- valid_range && tstzrange(t1, t2) (interval overlap)
- Triggers: INSERT opens [now, NULL); UPDATE closes/opens; DELETE closes current range[^13][^14]

COG/raster references:
- Store imagery as out-of-db COGs; register metadata; index with ST_ConvexHull on raster tiles where applicable; access partial tiles via GDAL VFS and HTTP Range requests.[^6][^8][^18][^19]

Timescale patterns:
- create_hypertable('time_series', 'ts', '<optional_space_dim>', <partitions>);
- time_bucket('1 month', ts) with spatial predicates and GROUP BY for bucketed metrics.[^9]

## Reference Mapping and Configuration

PostGIS raster and COG configuration reminders:
- Enable out-of-database raster access and GDAL drivers per organizational policy.
- Load raster references aligned with COG tile sizes and index with ST_ConvexHull for spatial pruning.[^6][^8]
- Consult the raster function index as needed for sampling and tile operations.[^15]

Timescale configuration reminders:
- Convert time_series to a hypertable with appropriate chunk sizing; add secondary partition dimension if write hotspots exist.
- Create GiST indices on geometry columns and BTREE indices on metadata (sensor, platform).
- Combine time_bucket with spatial predicates for efficient bucketed aggregations.[^9]

## References

[^1]: PostGIS Documentation: Using PostGIS Data Management. https://postgis.net/docs/using_postgis_dbmanagement.html  
[^2]: PostGIS Documentation: Spatial Queries. https://postgis.net/docs/using_postgis_query.html  
[^3]: PostGIS Tip: Getting Intersections the Faster Way. https://postgis.net/documentation/tips/tip_intersection_faster/  
[^4]: PostGIS Workshop: Spatial Indexes. https://postgis.net/workshops/postgis-intro/indexing.html  
[^5]: Crunchy Data: PostGIS Performance and Postgres Tuning. https://www.crunchydata.com/blog/postgis-performance-postgres-tuning  
[^6]: Crunchy Data: Using Cloud Rasters with PostGIS. https://www.crunchydata.com/blog/using-cloud-rasters-with-postgis  
[^7]: mrzk.io: Building High-Performance Spatial Apps. https://mrzk.io/posts/building-high-performance-spatial-apps/  
[^8]: PostGIS Documentation: Raster Data Management, Queries, and Applications. https://postgis.net/docs/using_raster_dataman.html  
[^9]: TimescaleDB Docs: Architecture (Hypertables, Chunks). https://docs.timescale.com/latest/introduction/architecture  
[^10]: Barman Manual 3.10.0. https://docs.pgbarman.org/release/3.10.0/  
[^11]: Stormatics: PostgreSQL Backup and Recovery Management using Barman. https://stormatics.tech/blogs/postgresql-backup-and-recovery-management-using-barman  
[^12]: Barman 1.6.1 Tutorial. https://docs.pgbarman.org/release/1.6.1/  
[^13]: PostGIS Workshop: Tracking Edit History using Triggers. https://postgis.net/workshops/postgis-intro/history_tracking.html  
[^14]: PostgreSQL Documentation: Range Types. https://www.postgresql.org/docs/current/rangetypes.html  
[^15]: PostGIS Documentation: Raster Reference (Functions Index). https://postgis.net/docs/RT_reference.html  
[^16]: Tiger Data: When to Consider Postgres Partitioning. https://www.tigerdata.com/learn/when-to-consider-postgres-partitioning  
[^17]: Medium: 5 Principles for Writing High-Performance Queries in PostGIS. https://medium.com/@cfvandersluijs/5-principles-for-writing-high-performance-queries-in-postgis-bbea3ffb9830  
[^18]: Cloud Optimized GeoTIFF (COG) site. https://cogeo.org/  
[^19]: GDAL Documentation: COG Driver. https://gdal.org/en/stable/drivers/raster/cog.html  
[^20]: PostGIS Workshop: Introduction to Rasters. https://postgis.net/workshops/de/postgis-intro/rasters.html  
[^21]: PostGIS Workshop: Introduction. https://postgis.net/workshops/postgis-intro/introduction.html  
[^22]: GIS StackExchange: Fixing performance problem in PostGIS ST_Intersects. https://gis.stackexchange.com/questions/19832/fixing-performance-problem-in-postgis-st-intersects  
[^23]: Spatial SQL Cookbook: Common GIS Analyses. https://forrest.nyc/spatial-sql-cookbook/  
[^24]: Instaclustr: PostgreSQL Best Practices for 2025. https://www.instaclustr.com/education/postgresql/top-10-postgresql-best-practices-for-2025/