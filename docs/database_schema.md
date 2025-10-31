# Watershed Disturbance Mapping System: Database Schema, Spatial Indexing, and Time-Series Optimization

## Executive Summary and Scope

This report presents a standards-aligned, implementation-ready relational schema and migration plan for the Watershed Disturbance Mapping System. The design prioritizes correct spatial semantics, predictable performance at scale, and operational resilience, while enabling near-real-time detection workflows and robust historical analysis. The solution combines PostgreSQL, PostGIS, and TimescaleDB to deliver:

- A normalized relational model that cleanly separates spatial entities (watersheds), event data (detections), temporal measurements (time_series), reference baselines, users/roles, alerts, and quality-control artifacts.
- PostGIS spatial indexing (GiST, SP-GiST, BRIN) optimized for AOI intersect filters, nearest-neighbor retrieval, and range scans on large append-only tables.
- TimescaleDB hypertables with time-based partitioning and optional secondary partitioning (e.g., by watershed_id) to scale spectral time-series ingestion and queries.
- Temporal history tracking using PostgreSQL range types (TSTZRANGE) and triggers to provide consistent time-travel auditing across mutable tables.
- Comprehensive constraints (FKs, uniqueness, CHECKs, NOT NULL), enumerations, and status constraints to enforce data quality and alert logic.
- Migration scripts with forward- and rollback-safe patterns to evolve the schema predictably across environments.

Deliverables include schema definitions, DDL migrations, index design and partitioning strategies, and example query templates. The report concludes with risk, trade-offs, and a reference mapping of requirements to design choices.

### Scope of This Report

This document provides:

- A formal schema blueprint for the core domain: watersheds, detections, time_series (as a hypertable), baselines, users, alerts, quality_control, plus supporting enumerations.
- Spatial indexing choices and tuning guidelines aligned with PostGIS and TimescaleDB best practices.
- Temporal history management using TSTZRANGE and triggers for time-travel queries and auditability.
- Constraints and referential integrity design, including alert gating rules and quality flags.
- Migration and operational guidance for ongoing evolution with safe rollbacks and environment-specific policies.

Out of scope: application-layer business logic and front-end visualization (e.g., specific dashboard implementations), and non-database components such as external alert channels or infrastructure automation.

### Deliverables and File Locations

The following artifacts comprise the technical reference set:

- 001_initial_schema.sql — Core tables, columns, constraints, indexes (including GiST on geometry), and enumerations.
- 002_advanced_indexes.sql — Additional indexes (e.g., SP-GiST for clustered points, BRIN for large append-only tables), partial/targeting indexes, and partitioned/table-specific optimizations.
- 003_migrations_framework.sql — Triggers for temporal history (TSTZRANGE), forward/rollback migration scaffolds, and environment-specific parameter hooks.
- 004_sample_data.sql — Seeds for development: enumerations and minimal rows to validate constraints and query templates.
- 005_common_queries.sql — Canonical patterns: AOI intersect, nearest neighbor, time_bucket aggregations, and time-travel predicates.

Expected file path convention: code/database/*.sql for DDL and scripts; docs/database_schema.md for the written schema documentation. Reference: the system specification emphasizes Landsat/Sentinel processing with LandTrendr and FNRT algorithms, alert thresholds, and quality-control protocols.

## Requirements Baseline and Data Sources

The system ingests Landsat (8/9) and Sentinel-2 (A/B) data to detect disturbances such as logging, clearing, fire, flooding, and infrastructure development. Spectral indices (NDVI, NBR, TCG) underpin detection and baseline computation. Processing is monthly, driven by a 5-day revisit cadence, with cloud masking and atmospheric correction. Change detection compares recent observations against multi-year baselines (e.g., rolling 3-year medians) to flag deviations exceeding statistical thresholds. High-confidence detections (e.g., > 0.8) generate alerts. Spatial precision supports minimum patch sizes on the order of 0.04 hectares. The architecture references PostgreSQL 14 + PostGIS 3.2, with TimescaleDB for time-series optimization.

To anchor design decisions, Table 1 summarizes a requirement-to-design matrix.

To illustrate how functional and non-functional requirements translate into concrete schema elements, Table 1 maps each requirement to a data model decision.

| Requirement | Design Decision | Rationale |
|---|---|---|
| Multi-sensor data (Landsat 8/9, Sentinel-2 A/B) | Table time_series with sensor/platform identifiers; enumerations for sensor | Enables time-series normalization across sensors while preserving provenance and harmonization fields |
| Spectral indices (NDVI, NBR, TCG) | Numeric columns in time_series; baseline summaries in baselines | Supports per-observation metrics and baseline-derived deltas for detection logic |
| Monthly processing cadence (5-day revisit) | Hypertable partitioning by time with time_bucket-ready schema | TimescaleDB accelerates time-range queries, aggregations, and retention management |
| Spatial footprint and AOI filtering | PostGIS geometry with GiST index; ST_Intersects/&& predicates | Index-aware spatial pruning for map overlays, AOI intersects, and nearest neighbor |
| Minimum patch size (~0.04 ha) | CHECK constraints and/or computed area checks | Prevents spurious one-pixel noise and enforces minimum detection sizes |
| High-confidence alerts (>0.8) | alerts tied to detections; status/ack workflow; NOT NULL defaults | Implements gating logic and lifecycle tracking for notifications |
| Cloud masking and QA flags | quality_control table; QC flags in time_series | Captures quality thresholds and flags to suppress low-quality observations |
| Baselines (rolling 3-year median) | baselines table with per-index summary statistics and validity windows | Supports historical comparison and temporal audits |
| RBAC (admin, analyst, viewer) | users table with role enumerations | Enforces least privilege and API access control |
| Time-travel and auditability | TSTZRANGE + triggers on mutable tables; history views | Provides consistent state-at-time queries and complete audit trail |

### Functional Requirements

- Maintain watersheds and detection footprints as geometries with spatial indices for fast AOI operations and map overlays.
- Store spectral time-series with per-observation metadata and quality flags; convert to hypertables for scalable time-range queries and aggregations.
- Model baselines as rolling multi-year medians of indices, keyed to ecosystem or region, with validity windows for temporal audits.
- Gate alert generation by detection confidence thresholds and area constraints; integrate channels (email/SMS/webhook) through an alerts workflow and status tracking.
- Record quality-control events and thresholds (cloud cover, minimum observations) to suppress or annotate unreliable data.

### Non-Functional Requirements

- Spatial query performance: index-aware predicates for AOI intersects and nearest neighbor; plan-time pruning via GiST and judicious predicate ordering.[^2][^4]
- Time-series scalability: hypertable partitioning, chunk sizing, and optional secondary partitioning by region/watershed to balance write load and query performance.[^9]
- Availability and DR: adopt tested backup and recovery patterns with Barman, including WAL streaming to minimize RPO; rehearse PITR in non-prod.[^10][^11][^12]
- Observability and tuning: pg_stat_statements for heavy query analysis; work_mem and parallelism configuration; shared_buffers to sustain cache hit ratios; regular VACUUM ANALYZE.[^5]

## Conceptual Data Model and Domain Relationships

The domain centers on geospatial entities, observations, detections, and the people and processes that validate and act upon them.

- watersheds defines administrative or hydrological boundaries as geometries, with metadata such as SRID and name.
- detections records change events with polygon/multipolygon geometries, detection dates, disturbance types, confidence scores, areas, and statuses to support lifecycle management and QA.
- time_series stores per-pixel or per-tile observations of spectral indices (NDVI, NBR, TCG), acquisition metadata (sensor, platform), QA flags, and spatial locations (point or raster tile reference).
- baselines captures rolling reference conditions, including per-index medians, standard deviations, and validity windows tied to ecosystem/region and optionally to spatial footprints.
- users and roles underpin RBAC for operations and API access.
- alerts associates detections with notification channels and tracks delivery status and acknowledgments.
- quality_control logs cloud cover thresholds, minimum observation counts, QA flags, and outcomes.

Table 2 summarizes relationships and cardinalities.

| Entity | Related Entity | Cardinality | Relationship Notes |
|---|---|---|---|
| watersheds | detections | 1:N | Detections occur within watershed boundaries; optional FK to detect spatial containment |
| detections | alerts | 1:N | A detection can generate multiple alerts (channels) and retries |
| watersheds | time_series | 1:N | Observations belong to watersheds spatially or via FK; optional for tile-based data |
| watersheds | baselines | 1:N | Baselines per watershed (and ecosystem) with validity windows |
| users | alerts | 1:N | Users may be recipients or assignees; status and ack tracking |
| detections | quality_control | 1:N | QC applies to detections or batches; also QC table references time_series |
| time_series | quality_control | 1:N | QC flags per observation window (e.g., cloud cover) |

### Entity Descriptions and Event Semantics

watersheds carry geometry and SRS metadata to support index-aware spatial predicates. Detections represent state changes and are subject to lifecycle transitions (e.g., new → confirmed → resolved). time_series anchors all temporal analytics, with each row capturing spectral values at an acquisition time and location, along with QA metrics and flags. baselines define reference conditions and their validity intervals. users encode roles for RBAC. alerts handle delivery status (pending, sent, delivered, failed, canceled, acknowledged) and reference recipients or webhooks. quality_control records processing-level QA decisions and thresholds.

Temporal semantics are modeled with explicit timestamps (timestamptz) and range columns (TSTZRANGE) where appropriate to support time-travel queries and historical reconstruction across mutable tables.[^13][^14]

## Logical Schema Design and Table Definitions

The schema adopts spatial types, enumerations, and constraints to ensure correctness and performance. The baseline targets PostgreSQL 14 + PostGIS 3.2 and TimescaleDB for time-series optimization.

To provide a comprehensive reference, Table 3 catalogs the core columns and constraints per table. This serves as the canonical mapping for DDL and validation.

Before presenting the details, note that the schema uses explicit geometry types and GiST indices to support index-aware spatial queries. The design employs enumerations for disturbance types, roles, and alert statuses to enforce data quality at the database layer.

| Table | Column | Type | Constraints/Default | Notes |
|---|---|---|---|---|
| watersheds | watershed_id | UUID | PK | Identifier |
|  | name | text | NOT NULL | Human-readable name |
|  | geom | geometry(Polygon/MultiPolygon, SRID) | NOT NULL, GiST index | AOI boundary |
|  | srid | int | NOT NULL | SRS identifier |
|  | created_at | timestamptz | DEFAULT now() | Audit |
| detections | detection_id | UUID | PK | Identifier |
|  | watershed_id | UUID | FK → watersheds.watershed_id | Optional spatial containment check |
|  | geom | geometry(Polygon/MultiPolygon, SRID) | NOT NULL, GiST index | Detection footprint |
|  | detection_date | date | NOT NULL | Event date |
|  | disturbance_type | text | CHECK in (...) | Logging, clearing, fire, flooding, infrastructure, other |
|  | confidence | numeric(5,4) | CHECK 0 ≤ x ≤ 1 | Alert gating |
|  | area_ha | numeric | CHECK x ≥ 0 | Area in hectares |
|  | status | text | CHECK in (new, confirmed, false_positive, resolved) | Lifecycle |
|  | created_at | timestamptz | DEFAULT now() | Audit |
| time_series | series_id | UUID | PK | Identifier |
|  | watershed_id | UUID | FK → watersheds.watershed_id | Optional |
|  | ts | timestamptz | NOT NULL | Observation time (partition key) |
|  | geom | geometry(Point/Polygon, SRID) | NOT NULL, GiST index | Pixel center or tile footprint |
|  | sensor | text | NOT NULL | Landsat-8/9, Sentinel-2A/2B |
|  | platform | text | NOT NULL | Landsat/Sentinel |
|  | ndvi | numeric | NULL allowed | Index value |
|  | nbr | numeric | NULL allowed | Index value |
|  | tcg | numeric | NULL allowed | Index value |
|  | qa_flags | text[] | NULL | Cloud mask, QA artifacts |
| baselines | baseline_id | UUID | PK | Identifier |
|  | ecosystem_type | text | NOT NULL | Forest, riparian, etc. |
|  | index_name | text | NOT NULL | NDVI, NBR, TCG |
|  | median | numeric | NOT NULL | Rolling median |
|  | mad | numeric | NULL | Robust spread |
|  | stddev | numeric | NULL | Optional |
|  | sample_size | int | CHECK x ≥ 0 | Supporting stats |
|  | valid_start | timestamptz | NOT NULL | Validity window |
|  | valid_end | timestamptz | NULL | Open-ended allowed |
|  | geom | geometry(Polygon/MultiPolygon, SRID) | NULL, GiST index | Optional spatial scoping |
| users | user_id | UUID | PK | Identifier |
|  | username | text | UNIQUE, NOT NULL | Login name |
|  | email | text | UNIQUE, NOT NULL | Contact |
|  | role | text | CHECK in (admin, analyst, viewer) | RBAC |
|  | created_at | timestamptz | DEFAULT now() | Audit |
| alerts | alert_id | UUID | PK | Identifier |
|  | detection_id | UUID | FK → detections.detection_id | Notifies linked to detections |
|  | recipient | text | NOT NULL | Email/phone/webhook |
|  | channel | text | CHECK in (email, sms, webhook) | Delivery channel |
|  | status | text | CHECK in (pending, sent, delivered, failed, canceled, acknowledged) | Lifecycle |
|  | sent_at | timestamptz | NULL | Delivery timestamp |
| quality_control | qc_id | UUID | PK | Identifier |
|  | cloud_cover_threshold | numeric | CHECK 0 ≤ x ≤ 100 | Threshold used |
|  | min_clear_obs | int | CHECK x ≥ 0 | Minimum valid observations |
|  | outcome | text | CHECK in (passed, failed, warnings) | QC outcome |
|  | notes | text | NULL | Freeform |

Table 3. Column and constraint catalog per table (core fields).

### Enumerations and Domain Constraints

To eliminate ambiguity and reduce application-side validation, enumerations are enforced via CHECK constraints:

- disturbance_type ∈ {logging, clearing, fire, flooding, infrastructure, other}
- severity ∈ {low, medium, high}
- detection_status ∈ {new, confirmed, false_positive, resolved}
- role ∈ {admin, analyst, viewer}
- alert_status ∈ {pending, sent, delivered, failed, canceled, acknowledged}
- sensor ∈ {landsat-8, landsat-9, sentinel-2a, sentinel-2b}
- qa_flags ⊆ {"CLOUD", "SHADOW", "SNOW", "AOT_HIGH", "WVP_HIGH", "SATURATED", "DEMOID"}

These enumerations align with the spec’s Landsat/Sentinel data sources, alert thresholds, and operational roles. In PostgreSQL, CHECK constraints are the canonical pattern to enforce such membership.[^20][^21]

### Spatial Types and SRID Strategy

Geometry is preferred for regional operations (fast planar computations), while geography is reserved for global distance/area calculations. Raster is intentionally avoided for pixel storage; imagery is handled as out-of-database Cloud Optimized GeoTIFFs (COGs) referenced by metadata and accessed via GDAL virtual file systems.[^1] The SRS selection must be documented per watershed (e.g., a suitable projected SRID in meters) and applied consistently at query boundaries to preserve index awareness. Given regional variability, the specific SRIDs remain an information gap to be finalized during deployment.

## Relationships and Referential Integrity

Foreign keys establish consistency across the domain, with cascading policies tailored to avoid unintended data loss and to preserve historical records.

Table 4 summarizes the FK matrix.

| Parent | Child | Foreign Key | On Delete | Notes |
|---|---|---|---|---|
| watersheds | detections | detections.watershed_id → watersheds.watershed_id | RESTRICT | Preserve detection history; containment validated by geometry |
| detections | alerts | alerts.detection_id → detections.detection_id | CASCADE (or RESTRICT) | Choose CASCADE if alerts are strictly dependent on detections |
| watersheds | time_series | time_series.watershed_id → watersheds.watershed_id | RESTRICT | Maintain observation provenance |
| watersheds | baselines | baselines.watershed_id → watersheds.watershed_id | RESTRICT | Baselines remain historical |
| users | alerts | alerts.created_by → users.user_id | SET NULL | Keep alerts even if user record changes |
| detections | quality_control (optional) | qc.detection_id → detections.detection_id | CASCADE | QC tied to detection lifecycle |

Cascade policies favor RESTRICT on domain roots (watersheds, baselines) to prevent accidental cascading deletions. CASCADE may be used when child records are purely derivative (e.g., alerts tied to a specific detection).

### Constraint Strategy

- NOT NULL on core identifiers and foreign keys to enforce existence of relationships.
- CHECK constraints for numeric ranges (confidence ∈ [0,1], cloud cover ∈ [0,100], area_ha ≥ 0) and enumerations (role, channel, alert_status).
- Uniqueness (e.g., users.username, users.email) to prevent duplicates.
- Status transitions are application-mediated but can be guarded by triggers if stricter workflows are required.

## Spatial Indexing and Query Patterns

Performance hinges on using the right index for the right data shape and ensuring predicates are index-aware. GiST is the default for general geometries, supporting bounding-box operators and nearest neighbor via <->. SP-GiST applies to space-partitioned, clustered point datasets. BRIN is a fit for very large, append-only tables where data is physically ordered by time or space.[^1][^4]

Table 5 maps index types to use cases.

| Index Type | Strengths | Limitations | Best Use Cases |
|---|---|---|---|
| GiST | Versatile; supports kNN and common spatial predicates | Larger index footprint | Polygons and multipolygons; general-purpose spatial joins |
| SP-GiST | Efficient on clustered distributions | No kNN; lossy behavior on some data | Massive point clouds with natural partitioning |
| BRIN | Tiny; extremely fast to build | Inclusion operators only; no kNN | Append-only, time-ordered large tables (e.g., hypertable chunks) |

Table 5. Index method selection for spatial workloads.[^1][^4]

Predicate choice matters. Use && to force a bounding-box pre-filter and ST_Intersects for precise overlap. For distance filters, use ST_DWithin rather than ST_Distance in WHERE clauses; for nearest neighbor, ORDER BY geom <-> point LIMIT N with a GiST index.[^2][^3] Table 6 provides a decision matrix.

| Task | Prefer | Avoid | Reason |
|---|---|---|---|
| AOI intersect | && then ST_Intersects | Raw ST_Intersection | && exploits the spatial index for pruning before exact tests[^2][^3] |
| Distance search | ST_DWithin | ST_Distance in WHERE | ST_DWithin is index-aware via expanded bbox[^2] |
| Nearest neighbor | ORDER BY <-> LIMIT N | ORDER BY ST_Distance | <-> operator is index-aware and efficient[^2] |

Table 6. Predicate selection to minimize CPU and maximize index usage.

Subdividing high-vertex polygons (ST_Subdivide) can dramatically improve pruning and CPU usage for heavy geometries, especially when intersecting large AOIs with complex footprints.[^22]

## Time-Series Optimization (TimescaleDB)

The time_series table is converted to a Timescale hypertable, with ts (timestamptz) as the primary partitioning dimension. When write hotspots emerge (e.g., one watershed dominates writes), a secondary partition dimension such as watershed_id can distribute chunks and reduce write amplification.[^9] time_bucket enables windowed aggregations (e.g., monthly NDVI/NBR/TCG) without manual date truncation, and the hypertable architecture provides automatic indexes on the partitioning keys.

Table 7 suggests chunk sizing and index strategies by workload profile.

| Workload Characteristic | Hypertable Keys | Suggested Chunk Time | Secondary Partition | Additional Indexes |
|---|---|---|---|---|
| Uniform ingestion (global) | ts | 7–30 days | None | GiST(geom); BTREE(sensor), BTREE(platform) |
| Write hotspots by watershed | ts, watershed_id | 7–14 days | watershed_id | GiST(geom); BTREE(watershed_id, ts) |
| High-frequency per-pixel | ts | 1–7 days | geom (via hash or region grouping) | Composite indexes on qa_flags if frequently filtered |

Table 7. Chunking guidance aligned to query shapes and write patterns.[^9]

Retention can be managed per chunk, allowing cold data to be moved to archival storage while keeping recent partitions hot for interactive use. Hybrid sub-partitioning (time × region) is recommended when both throughput and global coverage are required.[^16]

## Temporal History and Auditing with Range Types

For mutable tables (e.g., detections, baselines, users), temporal history is implemented via a valid_range column of type TSTZRANGE. A parallel history table stores closed ranges with operation metadata (e.g., “INSERT”, “UPDATE”, “DELETE”), ensuring a complete, queryable audit trail. Triggers run on insert/update/delete to create, close, and reopen ranges consistently.[^13][^14] Queries use @> to retrieve state at a given timestamp and && to find changes during an interval.

Table 8 codifies trigger actions and supported predicates.

| Operation | Trigger Action | Index | Query Predicate |
|---|---|---|---|
| INSERT | Create open-ended range [now, NULL) | GiST(valid_range) | valid_range @> now() |
| UPDATE | Close old range; open new | GiST(valid_range), GiST(geom) | valid_range @> t; valid_range && tstzrange(t1,t2) |
| DELETE | Close current range | GiST(valid_range) | valid_range @> t |

Table 8. History operations and index coverage using TSTZRANGE.[^13][^14]

This approach supports time-travel for audits and reproducible analysis without relying on external systems.

## Constraints, Data Quality, and Validation

Quality gates are enforced at the database level to ensure reliable downstream analytics and alert logic. Key constraints include:

- Confidence scores between 0 and 1; alerts gated by thresholds (e.g., >0.8).
- Area thresholds to enforce minimum patch size (~0.04 ha), preventing single-pixel noise from triggering alerts.
- Cloud cover thresholds (≤30%), minimum clear observations per window (e.g., ≥3 per 90 days), and QA flags ("CLOUD", "SHADOW", etc.) to filter suspect observations.
- Unique constraints on users (username, email) to prevent duplicates.

Table 9 lists key constraints per table.

| Table | Constraint | Purpose |
|---|---|---|
| detections | CHECK (confidence BETWEEN 0 AND 1) | Valid score range |
| detections | CHECK (area_ha ≥ 0) | Non-negative area |
| detections | CHECK (status IN (...)) | Lifecycle enforcement |
| alerts | CHECK (status IN (...)) | Delivery status |
| quality_control | CHECK (cloud_cover_threshold BETWEEN 0 AND 100) | Valid threshold |
| quality_control | CHECK (min_clear_obs ≥ 0) | Non-negative |
| users | UNIQUE (username), UNIQUE (email) | Identity uniqueness |
| time_series | CHECK (sensor IN (...)) | Controlled vocabulary |

Table 9. Key constraints per table for data quality and correctness.

These constraints align with the system’s processing thresholds and guard against degraded data flowing into detection and alert pipelines.[^2][^5]

## Migration Scripts and Versioning Strategy

Migrations follow a forward-only, transactional pattern with explicit rollbacks. Each script is idempotent where feasible and scoped to minimal changes (e.g., adding an index concurrently to avoid blocking writes). Timescale migration commands include creating hypertables and, if necessary, adding a secondary partition dimension (e.g., watershed_id). Role-based seed data and environment parameters (SRID policies, retention days) are included for consistent bootstrapping across dev, test, and prod.

Table 10 outlines a migration checklist.

| Script | Change Type | Forward Action | Rollback Action | Dependencies |
|---|---|---|---|---|
| 001_initial_schema.sql | Schema create | Create tables, enums, PK/FK, GiST | DROP SCHEMA/CASCADE (non-prod only) | Extensions present |
| 002_advanced_indexes.sql | Index add | CREATE INDEX CONCURRENTLY | DROP INDEX | Base schema present |
| 003_migrations_framework.sql | Triggers/history | Create triggers, history tables | DROP TRIGGERS/TABLES | Tables exist |
| 004_sample_data.sql | Seed data | Insert enums and minimal seeds | DELETE FROM ... | Schema present |
| 005_common_queries.sql | Views/templates | Create views/queries | DROP VIEW | N/A |

Table 10. Migration checklist by script.

Operational safeguards:

- Use transactions for DDL when supported, but perform blocking index creations with CONCURRENTLY.
- Parameterize environment-specific settings (SRID per watershed; retention policies).
- Run VACUUM ANALYZE after significant loads to maintain planner statistics.[^5]

## Query Playbook and Performance Patterns

Canonical query patterns demonstrate index-aware predicates and hypertable capabilities. The following templates emphasize AOI intersects, nearest-neighbor, bucketed time-series, and time-travel. Each example is aligned with PostGIS and TimescaleDB best practices.[^2][^3][^9][^23]

Example 1 — Detections within an AOI polygon (bounding box pre-filter + precise overlap):

```
-- $1: AOI polygon geometry (same SRID as detections)
SELECT d.detection_id, d.detection_date, d.disturbance_type, d.confidence, d.area_ha
FROM detections d
WHERE d.geom && $1
  AND ST_Intersects(d.geom, $1)
ORDER BY d.detection_date DESC
LIMIT 100;
```

Example 2 — Nearest detections to a point (index-aware kNN):

```
-- $1: Point geometry (same SRID)
SELECT d.detection_id, d.detection_date, d.confidence, d.area_ha
FROM detections d
ORDER BY d.geom <-> $1
LIMIT 10;
```

Example 3 — Monthly bucketed averages of NDVI per watershed (time_bucket):

```
-- Assumes hypertable time_series with ts as time column
SELECT time_bucket('1 month', ts) AS month,
       watershed_id,
       AVG(ndvi) AS avg_ndvi
FROM time_series
WHERE ts >= NOW() - INTERVAL '24 months'
  AND ndvi IS NOT NULL
GROUP BY month, watershed_id
ORDER BY month DESC, watershed_id;
```

Example 4 — Time-travel query on detections (state at T):

```
-- $1: timestamp
SELECT detection_id, geom, detection_date, status
FROM detections
WHERE valid_range @> $1
ORDER BY detection_date DESC;
```

Example 5 — Time-range overlap for audit (changes between T1 and T2):

```
-- $1, $2: timestamptz
SELECT detection_id, status, valid_range
FROM detections
WHERE valid_range && tstzrange($1, $2)
ORDER BY lower(valid_range);
```

Observability and tuning reminders:

- Enable pg_stat_statements to identify top offenders; inspect plans and ensure spatial indexes are used.[^5]
- Increase work_mem for heavy sorts/aggregations; align parallelism to CPU budgets; maintain shared_buffers to keep hot pages in cache.[^5]
- VACUUM ANALYZE after bulk operations to refresh statistics.[^5]

## Backup, Recovery, and DR Strategy

Backup and recovery adopt Barman with base backups, continuous WAL streaming (near-zero RPO), and PITR for point-in-time restores. Retention policies balance cost and compliance (redundancy vs. recovery window), and periodic recovery drills validate procedures.[^10][^11][^12]

Table 11 compares methods against RPO/RTO.

| Method | RPO | RTO | Operational Notes |
|---|---|---|---|
| Periodic base backups | Hours–days | Medium | Simple ops; larger recovery gaps |
| Base + WAL archiving | Minutes | Medium | Archive coverage required |
| Base + WAL streaming | Near-zero | Low | Streaming via pg_receivewal; minimal data loss[^11][^12] |

Table 11. Backup methods and expected RPO/RTO.

Table 12 summarizes retention models.

| Policy | Definition | Use Case |
|---|---|---|
| REDUNDANCY N | Keep N full backups | Predictable restore points |
| RECOVERY WINDOW D DAYS | Keep backups/WAL to any time within D days | Continuous audit windows[^10][^11] |

Table 12. Retention policy models.

### Operational Playbook

- Schedule regular base backups; verify WAL streaming and compression; enforce retention.
- Document restore steps including remote-host recovery; ensure version compatibility and clock sync.
- Integrate monitoring and alerting for backup status and recovery drills.

## Risks, Trade-offs, and Decision Matrix

Key decisions include geometry vs. geography, raster storage (in-DB vs. out-of-db COGs), index methods, partitioning strategy, and backup policy. The matrix below consolidates criteria and guidance.[^1][^4][^6][^8][^10][^16][^18][^19]

| Decision | Option | Criteria | When to Choose |
|---|---|---|---|
| Spatial type | geometry vs. geography vs. raster | Function coverage, accuracy, size, cost | Geometry for regional ops; geography for global distance/area; raster for imagery (prefer COGs)[^1] |
| Index | GiST vs. SP-GiST vs. BRIN | Data shape, kNN needs, update frequency | GiST for general + kNN; SP-GiST for clustered points; BRIN for huge append-only sets[^1][^4] |
| Partitioning | time vs. region vs. hybrid | Query shape, hotspots, retention | Time for time-series; region for global datasets; hybrid for scale and hotspots[^9][^16] |
| Raster storage | in-DB vs. out-of-db COG | Size, cost, access patterns | Prefer COGs for scale and cost; in-DB only for small/medium tightly coupled datasets[^6][^8][^18][^19] |
| Backup | redundancy vs. recovery window | Compliance, RPO/RTO | Redundancy for fixed restore points; recovery window for rolling audit[^10][^11] |

Table 13. Decision matrix across core architecture choices.

Information gaps that require environment-specific evaluation include: final SRIDs per region; precise Timescale chunk sizes and secondary partition keys; the full enumeration lists for disturbance types and QC flags; retention durations and archival policy; and the operational SLAs for Barman (RPO/RTO) in production. These should be validated during deployment planning.

## Appendix: Reference Queries and Functions

This appendix consolidates index-aware patterns and temporal operations for quick reference.[^2][^13][^23]

Spatial predicates quick reference:

- && (bounding box operator)
- ST_Intersects / ST_Within / ST_Contains / ST_Covers / ST_CoveredBy / ST_Overlaps / ST_Touches / ST_Equals / ST_Disjoint / ST_ContainsProperly
- ST_DWithin / ST_3DDWithin (distance)
- ORDER BY geom <-> point LIMIT N (nearest neighbor)
- ST_Relate with ST_RelateMatch (DE-9IM patterns)[^2]

Example — AOI intersect with envelope pre-filter:

```
-- $1: envelope polygon
SELECT id, geom FROM layer
WHERE geom && $1 AND ST_Intersects(geom, $1);
```

Example — Distance filter (index-aware):

```
-- $1: point; $2: radius in meters (geography) or meters in projected geometry context
SELECT id, geom FROM layer
WHERE ST_DWithin(geom, $1, $2);
```

Temporal history operations:

- Time travel: WHERE valid_range @> timestamp
- Interval overlap: WHERE valid_range && tstzrange(t1, t2)
- Trigger actions: INSERT opens [now, NULL); UPDATE closes and opens; DELETE closes current range[^13][^14]

Timescale examples:

- time_bucket usage shown earlier; combine with spatial predicates:

```
SELECT time_bucket('5 minutes', ts) AS bucket,
       COUNT(*) AS cnt,
       AVG(ndvi) AS avg_ndvi
FROM time_series
WHERE geom && ST_MakeEnvelope(xmin, ymin, xmax, ymax, SRID)
  AND ts BETWEEN $1 AND $2
GROUP BY bucket
ORDER BY bucket;
```

COG/raster references (conceptual):

- Store imagery as out-of-db COGs; register metadata; index with ST_ConvexHull on raster tiles for spatial pruning; access partial tiles via GDAL VFS and HTTP Range requests.[^6][^8][^18][^19]

## Appendix: Reference Mappings and Configuration

Configuration reminders for PostGIS rasters and COGs (conceptual, align with environment policies):

- Enable out-of-database rasters and GDAL drivers.
- Load raster references aligned with COG tile sizes; index by ST_ConvexHull for pruning.[^6][^8]
- Raster functions follow PostGIS raster references; consult function index as needed.[^15]

TimescaleDB configuration reminders:

- create_hypertable('time_series', 'ts', '<optional_space_dim>', <num_partitions>);
- Ensure GiST index on geometry columns; BTREE on frequently filtered metadata.
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