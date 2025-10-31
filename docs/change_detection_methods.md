# Local Change Detection Methods for Watershed Monitoring: Spectral Indices, Time Series, and CPU-based Machine Learning

## Executive Summary

Watershed monitoring programs increasingly rely on satellite time series to detect and attribute changes in vegetation condition, burn severity, wetness, and water extent. This report provides a practitioner-focused guide to local, CPU-first workflows that GIS analysts and hydrologists can implement without specialized hardware. It distills best practices for bi-temporal image differencing, spectral indices such as the Normalized Difference Vegetation Index (NDVI), the Normalized Burn Ratio (NBR), and Tasseled Cap Greenness (TCG); surveys pixel-wise time series methods, including trend tests (Mann–Kendall and Sen’s slope) and Bayesian change-point detection (BEAST); and outlines CPU-based machine learning (ML) strategies, including post-classification change detection and sequential feature stacks. Throughout, the emphasis is on robust preprocessing (cloud/shadow masking), reproducible pipelines using open-source libraries, and validation strategies suited to the noise and scale constraints of watershed time series.

Key recommendations include the following: start with seasonal median composites and strong cloud masking to control false positives; choose NDVI for vegetation condition, NBR for fire-affected slopes and riparian corridors, and TCG as a greenness companion to Tasseled Cap Wetness (TCW) for moisture-sensitive changes; use robust, non-parametric trend tests (Mann–Kendall/Sen’s slope) to quantify monotonic change and BEAST for abrupt disturbances in the presence of seasonality; deploy CPU-friendly ML models—especially Random Forest (RF) and Support Vector Machines (SVM)—via post-classification comparison or feature stacks; and use near real-time (NRT) methods (e.g., EWMA, CuSum, MoSum) for operational alerts. Finally, validate with region-specific thresholds, confusion matrices, and field or high-resolution references, and integrate outputs into standard GIS products (rasters and vector event layers).

Deliverables recommended for watershed programs include: (1) robust spectral index stacks (NDVI, NBR, TCG/TCW) derived from cloud-screened seasonal medians, (2) change maps using image differencing or thresholded ratios, (3) pixel-wise trend and change-point rasters (Sen’s slope, MK significance, BEAST breakpoints), (4) ML attribution maps (post-classification change or sequential feature stacks), and (5) near real-time disturbance alerts. The report consolidates reproducible workflows and implementation references to help teams build locally executable, CPU-first pipelines for operational watershed monitoring. The discussion is grounded in best-practice methods for image differencing and thresholding, NDVI computation, robust trend tests, Bayesian change-point detection, and CPU-friendly machine learning for change detection.[^1][^2][^3][^4][^5][^6][^7][^8][^9]

---

## Watershed Monitoring Context and Objectives

Watersheds encompass a mosaic of land covers and hydro-ecological gradients: forested uplands, riparian zones, wetlands, agriculture, urban interfaces, and sparse vegetation or alpine areas. Each presents a different spectral signature and phenological cycle. As a result, a change detection program must balance sensitivity to true disturbances (e.g., fire, flooding, bark beetle outbreaks, land cover conversion) against confounding variability from phenology, clouds and shadows, sensor noise, and registration errors.

Typical monitoring goals include: early detection of disturbance (e.g., fire scars, blowdowns, mass wasting), tracking recovery trajectories of vegetation and moisture, attribution to plausible drivers (fire vs. drought vs. management), and quantification of trends in vegetation condition and water presence. Landsat-scale data (e.g., 30 m) provide a pragmatic spatial resolution for catchment-scale analysis and multi-year monitoring, provided that cloud masking and compositing are carefully executed to minimize spurious detections. Open training resources demonstrate how to compute vegetation indices and produce change maps from seasonal halves of imagery using cloud-aware workflows, a pattern that is directly applicable to watershed contexts.[^2]

Two operational realities shape methods: (1) the need for cross-year comparability—often achieved via seasonal medians to dampen intra-seasonal variability—and (2) the need for robust QA/QC, especially consistent cloud and shadow masking that preserves hydrologically important features (e.g., wetness gradients, surface water extent) when using moisture-sensitive indices or water indices. These design choices underpin the methods presented in this guide.

---

## Preprocessing for Robust Change Detection

Robust change detection in watersheds begins with disciplined preprocessing. The main steps include cloud and shadow masking, compositing to seasonal medians, and careful co-registration and normalization to reduce artifacts that can masquerade as change.

Cloud and shadow masking. For Landsat, pixel quality (QA) layers provide efficient, extensible masks that can be applied programmatically to remove clouds, cloud shadows, and related artifacts before analysis. Practical Python workflows demonstrate how to read QA bands, encode bit-packed flags, and mask clouds/shadows with minimal code, improving downstream analysis and visual interpretation.[^3] This step is non-negotiable: undetected clouds and shadows produce striking false positives in index-based change maps and time series analyses.

Seasonal medians and co-registration. Change detection should leverage compositing strategies that increase signal-to-noise while preserving seasonal context. One pragmatic approach is to compute seasonal median composites (e.g., pre- and post-season medians) after applying cloud masks. Seasonal medians reduce the influence of outliers and phenology, especially when paired with the same season across years (e.g., mid-summer vs. mid-summer). Training materials using Digital Earth Africa workflows showcase the creation of mean composites split into earlier and later periods to derive robust difference maps for vegetation change, a pattern directly transferable to watershed monitoring.[^2]

Normalization and sensor consistency. While indices and seasonal medians reduce sensitivity to absolute radiometric calibration, careful attention to map projections, pixel size, and co-registration remains critical. In general, ensure data are in a common projection and grid before differencing, resampling to the coarsest resolution in the stack, and validating co-registration on stable features. Index computation benefits from explicit handling of no-data, division by zero, and saturated bands—simple safeguards that prevent spurious edges and artifacts in difference rasters.[^2]

---

## Spectral Indices for Watershed Change Detection

Spectral indices are computationally efficient and effective for highlighting particular aspects of land surface change. Three indices are especially useful in watershed monitoring:

- NDVI (Normalized Difference Vegetation Index) emphasizes vegetation vigor and is widely used to detect disturbances, stress, and recovery. The standard formula uses near-infrared (NIR) and red bands: NDVI = (NIR − Red) / (NIR + Red). Landsat 8 band selection typically uses Band 5 (NIR) and Band 4 (Red). NDVI is straightforward to compute locally with NumPy and rasterio.[^2]

- NBR (Normalized Burn Ratio) is designed to highlight burn severity and vegetation loss by using NIR and SWIR: NBR = (NIR − SWIR) / (NIR + SWIR). In Landsat 8, this typically corresponds to Band 5 (NIR) and Band 6 or 7 (SWIR), depending on product availability. NBR can be applied to pre-/post-fire stacks or annual composites to map burn scars and recovery along hillslopes and riparian corridors, and to track greenness recovery after disturbance.[^2]

- TCG (Tasseled Cap Greenness) captures spectral variability related to vegetation greenness and is often paired with TCW (Tasseled Cap Wetness) for moisture-sensitive analyses. Tasseled Cap transformations are sensor-specific and not always consolidated in public documentation; in practice, TCG and TCW are treated as separate indices in processing toolchains and are used in combination with NDVI and NBR to disentangle greenness vs. moisture signals in watersheds.[^2][^2]

Workflow design. Compute indices per image or seasonal composite, then derive change via differencing or ratios between two epochs (e.g., pre- vs. post-fire, or wet vs. dry season). Analysts often threshold absolute differences or z-scored differences to define change masks. Training resources provide practical steps for computing NDVI, splitting time series into baseline and monitoring periods, deriving mean composites for each half, and visualizing change with diverging colormaps—patterns that translate directly into operational watershed workflows.[^2]

Interpretation and limitations. NDVI is sensitive to vegetation vigor but can be confounded by soil background, atmospheric conditions, and phenology; compositing by season mitigates many of these effects. NBR is sensitive to burn signatures but depends on the availability and quality of SWIR bands and cloud-free coverage. TCG adds nuance for greenness dynamics but requires sensor-specific transform coefficients and careful calibration; it should be used alongside NDVI and TCW for moisture context rather than in isolation.[^2]

To support practitioner implementation, the following table consolidates key details for the core indices.

Table 1. Spectral indices quick reference for watershed change detection

| Index | Required bands ( Landsat 8 ) | Formula | Typical watershed use-cases | Pros | Cons |
|---|---|---|---|---|---|
| NDVI | Band 5 (NIR), Band 4 (Red) | (NIR − Red) / (NIR + Red) | Vegetation disturbance and recovery; stress detection | Simple, robust, widely validated | Sensitive to phenology, soil background, and atmosphere if not masked/composited |
| NBR | Band 5 (NIR), Band 6 or 7 (SWIR) | (NIR − SWIR) / (NIR + SWIR) | Burn severity mapping; post-fire recovery on slopes and riparians | Strong signal for burn scars; tracks recovery trajectories | Requires SWIR; can be confounded by moisture and shadows |
| TCG | Sensor-specific transform | Tasseled Cap Greenness | Greenness dynamics; complements NDVI and TCW | Captures greenness distinct from brightness/wetness | Transform coefficients vary; less consolidated documentation |

Practical implementation notes:
- Handle no-data and zero denominators explicitly in index arithmetic to avoid edge artifacts; seasonal medians after cloud masking improve robustness.[^2]
- Use diverging colormaps (e.g., red–blue) to visualize signed differences and support interpretation by stakeholders; red often indicates negative change (e.g., vegetation loss), and blue positive change (e.g., greening), consistent with training examples.[^2]

---

## Bi-temporal Image Differencing and Ratios

Image differencing and ratio methods remain workhorses for watershed change detection because they are intuitive, fast, and effective when preprocessing is disciplined. The workflow is conceptually simple: compute the same index or band ratio for two epochs (e.g., pre- and post-event), then subtract (differencing) or divide (ratio) to produce a change image. Thresholds convert continuous change scores into binary or ordinal change classes. The Landscape Toolbox provides canonical guidance on method steps, interpretation, and pitfalls.[^1]

Key steps and considerations:
- Preprocessing. Apply cloud/shadow masks, standardize projections and pixel sizes, and ensure sub-pixel co-registration. Even small misregistrations can produce pseudo-changes along sharp edges (e.g., roads, riverbanks). Atmospheric correction is less critical for ratios than for absolute reflectance use-cases but still improves comparability.[^1]
- Epoch selection. Use anniversary dates or, more robustly, seasonal medians for the same season to reduce phenology-driven differences. For event-based analyses (e.g., fire), align pre- and post-event windows to comparable phenological stages where possible.[^1]
- Thresholding. Choose thresholds via empirical histograms, z-score cutoffs, or region-specific calibration; thresholds should be iteratively refined with reference data or high-resolution imagery.[^1]
- Interpretation. Positive values in NDVI differencing often indicate vegetation gain; negative values indicate loss. For NBR, strong negative differences align with burn severity. Ratio images accentuate relative changes; differencing highlights absolute magnitude. Both benefit from masking stable areas (e.g., water bodies, agriculture) when the objective is focused disturbance detection.[^1]

To aid method selection and configuration, the following tables summarize difference vs. ratio behaviors and a checklist for robust implementation.

Table 2. Image differencing vs. ratio comparison

| Aspect | Image differencing | Ratio (e.g., post/pre) |
|---|---|---|
| Sensitivity | Highlights absolute magnitude of change | Highlights relative change; compresses large magnitudes |
| Directionality | Preserves sign (gain vs. loss) | Always positive; direction inferred from companion layers or logs |
| Noise characteristics | Additive noise; edge artifacts if misregistered | Multiplicative noise; more stable for certain signals |
| Baseline requirements | Requires comparable radiometry (seasonal medians help) | Same as differencing; log-ratio can stabilize variance |
| Typical thresholds | Empirical histogram or z-score of difference | Histogram-based or log-normal thresholds |
| Use when | Comparing similar phenology and radiometry | High dynamic range, percent change is meaningful |

Table 3. Preprocessing checklist for bi-temporal change detection

| Step | Description | Notes |
|---|---|---|
| Co-registration | Align epochs to sub-pixel tolerance | Validate on stable features |
| Cloud/shadow masking | Apply QA masks or cloud/shadow layers | Prevent false positives in change maps[^3] |
| Compositing | Build seasonal medians per epoch | Dampens intra-seasonal noise[^2] |
| Normalization | Harmonize radiometry/projection | Common grid and pixel size |
| Index calculation | NDVI/NBR/TCG per epoch | Handle no-data/zero denominators[^2] |
| Thresholding | Empirical/histogram- or z-score-based | Validate against references |
| AOIs/masking | Mask irrelevant classes (e.g., agriculture) | Focus on disturbance detection |
| QA/QC | Visual checks; stable-area tests | Iterate as needed |

The strengths of these methods are simplicity, speed, and interpretability. Limitations include the inability to attribute change and sensitivity to threshold choice and residual noise; classification or time series methods can complement them when attribution or timing is essential.[^1]

---

## Pixel-based Time Series Analysis

Time series methods add temporal structure to change detection, enabling detection of abrupt disturbances, quantification of gradual trends, and separation of seasonality from signal. Watershed analysts benefit from three complementary families of methods: robust trend tests, change-point detection via Bayesian decomposition, and continuous monitoring frameworks for near real-time operations.

Mann–Kendall (MK) and Sen’s slope. The MK test is a non-parametric procedure that tests for monotonic trend without assuming normality or a specific distribution. It is widely applied to environmental and hydrologic time series. Sen’s slope estimates the magnitude of trend as the median of pairwise slopes, providing a robust rate estimate. Python implementations in pyMannKendall support a spectrum of tests (original, variance-corrected for autocorrelation, seasonal, regional) and return a rich set of statistics, including Kendall’s tau, p-values, and slope/intercept, enabling both per-pixel and zonal assessments.[^6][^7] In practice, MK/Sen’s slope can be computed over per-pixel time series of NDVI or NBR to map long-term vegetation degradation or recovery, and over TCW for moisture trends. The test variants are valuable when seasonality or serial correlation is pronounced.

BEAST (Bayesian Estimator of Abrupt change, Seasonality, and Trend). BEAST decomposes time series into abrupt changes, seasonality, and trend via Bayesian model averaging, and is available through the Rbeast package with bindings for R, Python, MATLAB, and Octave.[^4] It is particularly suited to detecting abrupt disturbances (e.g., fire, blowdown) within noisy seasonal cycles and provides probability estimates for changepoints. When applied per pixel to indices like NDVI or NBR, BEAST maps where and when a disturbance occurred, the magnitude of the shift, and the underlying seasonal/trend components—products that are immediately interpretable for watershed alerting and recovery tracking. BEAST is designed to run on CPUs and can be parallelized across pixels and scenes.

Near real-time monitoring (NRT). Operational programs often require alerts as new images arrive (e.g., every 5–8 days for Sentinel-2/Landsat). The nrt Python package implements standardized monitoring frameworks—Exponentially Weighted Moving Average (EWMA), CuSum, MoSum, and partial CCDC variants—under a common API optimized for CPU computation with dependencies such as NumPy, SciPy, XArray, Numba, Rasterio, and NetCDF4.[^5][^8] The design pattern is to fit a stable “history” period, then monitor new acquisitions for departures from expected behavior; confirmation rules reduce false alarms by requiring successive anomalies. nrt is well-suited for watershed teams needing fast, scalable detection on commodity hardware.

The following table consolidates the time series toolbox for local, CPU-first use.

Table 4. Time series methods overview

| Method | Purpose | Input | CPU/local feasibility | Outputs | Key parameters |
|---|---|---|---|---|---|
| Mann–Kendall (MK) | Monotonic trend detection | Per-pixel time series of an index | Pure Python (pyMannKendall) | Trend direction, significance (p), tau, slope, intercept | Test variant (original, modified), alpha, seasonal/regional settings[^6][^7] |
| Sen’s slope | Trend magnitude estimation | Same as MK | Pure Python | Slope (rate per time step) | Seasonal variant available[^6] |
| BEAST | Change-point, seasonality, trend decomposition | Time series with seasonality | R/Python APIs; CPU | Breakpoints, component trends, probabilities | Seasonality, model options; parallelizable[^4] |
| EWMA / CuSum / MoSum | Near real-time disturbance alerts | History vs. monitoring windows | Python (nrt), CPU | Alerts, anomaly scores | History length, thresholds, confirmation windows[^5][^8] |
| Partial CCDC | Continuous change detection classification | Dense time series | Python (nrt), CPU | Change segments and classes | Fitting/monitoring windows, segmentation[^5] |

Practical guidance:
- Apply MK/Sen’s slope to annual or seasonal time series to quantify long-term trends; correct for autocorrelation using variance-corrected MK variants when necessary.[^6]
- Use BEAST to locate abrupt changes and separate seasonality from trend in watersheds with strong phenology; probability-of-change rasters support conservative alerting.[^4]
- Implement NRT monitoring to alert on new disturbances (e.g., fire scars, clearing) with confirmation rules tuned to local noise levels and revisit cadence.[^5][^8]

### Robust Trend Tests (MK and Sen’s slope) for Watersheds

Implementation strategy. Compute per-pixel time series for a spectral index or moisture metric across years, then run MK tests locally (e.g., using pyMannKendall) to obtain trend direction and significance, with Sen’s slope providing a robust rate estimate. Seasonal variants account for within-year patterns, while regional tests aggregate trends across spatial units relevant to watershed reporting.[^6][^7] Results can be exported as slope and p-value rasters and summarized by watershed sub-units.

Use cases. NDVI trend rasters identify gradual vegetation degradation or greening; NBR trends highlight multi-year burn recovery; TCW trends capture moisture regime shifts in riparian zones. A practical approach is to mask water or agriculture when the objective is disturbance detection, and to focus on upland vegetation or riparian buffers.

### BEAST for Change-Point and Trend/Seasonality Decomposition

BEAST provides a probabilistic framework to decompose a pixel’s time series into trend, seasonality, and abrupt change components, robust to noise and applicable across disciplines.[^4] In watersheds, BEAST can:
- Detect the year or season of disturbance (e.g., fire) within a longer record.
- Separate post-disturbance recovery (gentle upward trend) from seasonal cycles.
- Quantify the magnitude and timing of shifts, supporting recovery planning and attribution.

Outputs include posterior probabilities of change and decomposed components; these can be thresholded to produce change maps and filmstrips for stakeholder communication.

### Near Real-Time Monitoring with nrt

Operational monitoring benefits from continuous ingestion of new imagery and standardized change frameworks. The nrt package’s design—history fitting plus monitoring with confirmation rules—maps cleanly onto watershed operations, where alerts should be timely yet conservative. EWMA, CuSum, and MoSum methods are well-documented in the literature and implemented under a CPU-optimized API, supporting large areas with frequent acquisitions.[^5][^8] Analysts should calibrate thresholds and confirmation windows using historical events to minimize false positives during cloudy periods or high phenological variability.

---

## Machine Learning Approaches for Change Detection (CPU-first)

Machine learning (ML) can extend change detection by assigning attributions (e.g., fire, harvest, flooding) and improving robustness to mixed pixels and noise. For CPU-only environments and large watershed areas, the evidence favors two strategies: post-classification comparison and sequential feature stacks using coefficients or raw temporal features with less intensive models.[^9]

Post-classification comparison. Classify two epochs independently (e.g., RF or SVM classifiers on spectral indices and tasseled cap bands), then compare class maps to produce change layers. This approach is computationally efficient, interpretable, and well-suited to CPU-only implementations at regional scales. It is robust to cross-sensor or cross-year radiometric differences because each epoch is classified independently.[^9]

Sequential feature stacks. Stack temporal features across epochs—either coefficients from segmentation models (e.g., LandTrendr, CCDC) or time series features (seasonal amplitudes, trend slopes)—and train models (RF, SVM, boosted trees, MLPs) to detect change and attribute cause. This approach improves temporal accuracy but requires more storage and computation than post-classification comparison. It remains feasible on CPUs for manageable AOIs and carefully curated features.[^9]

Model choices and feasibility. A recent review underscores that less intensive models—RF, SVM, decision trees, boosted trees, and MLPs—are more feasible for large areas on CPUs and widely used in land use/land cover (LULC) change mapping, forest disturbance attribution, and wetland mapping. Conversely, convolutional and recurrent neural networks (CNNs/RNNs) are computationally intensive and typically constrained to smaller AOIs or GPU-enabled settings.[^9] For watershed programs, starting with RF/SVM is pragmatic; these models handle mixed pixels, leverage spectral indices and tasseled cap bands, and integrate smoothly with GIS workflows.

Table 5. ML models and CPU feasibility

| Model | CPU suitability | Typical use | Pros | Cons |
|---|---|---|---|---|
| Random Forest (RF) | High | LULC classification; change attribution | Handles mixed features; robust to noise | Requires feature curation; can overfit if labels noisy[^9] |
| Support Vector Machines (SVM) | High | LULC classification | Strong generalization; fewer hyperparameters | Sensitive to kernel and scaling; less interpretable[^9] |
| Decision Trees (DT) | High | Baseline classification | Simple; interpretable | Instability; lower accuracy than ensembles[^9] |
| Boosted Trees (e.g., XGBoost, AdaBoost) | High | Change detection and attribution | High accuracy; flexible loss functions | Tuning complexity; sensitive to noise[^9] |
| MLP (Dense NN) | Moderate | Spectral feature classification | Captures non-linearities | Data-hungry; interpretability challenges[^9] |
| CNN / U-Net / LSTM | Low (CPU) | Object or sequence-centric change detection | Rich spatial/temporal representations | Computationally intensive; GPU recommended[^9] |

Feature engineering. Combine indices (NDVI, NBR, TCG), tasseled cap components (TCG/TCW), temporal statistics (seasonal means), and, where available, model coefficients (e.g., segmentation slopes or magnitudes) to feed ML classifiers. Keep features consistent across epochs and normalize where necessary. For post-classification change, ensure class legends are harmonized and align to hydrologically relevant categories (e.g., forest, shrubland, riparian, water, agriculture, urban).

### Post-classification Comparison

Classify each epoch independently, then cross-tabulate classes to produce change matrices and change layers. Aggregate per watershed sub-unit to report class-specific area changes and trends. This approach is computationally efficient and interpretable for managers, and it isolates errors to the classification step rather than the change step.[^9]

### Sequential Feature Stacks and Change Coefficients

For temporally dense stacks, create feature matrices that include segmentation coefficients (e.g., slope, duration, magnitude from LandTrendr-like fits) or time series features, then train RF/SVM/boosted models to predict change and driver. While more accurate temporally, this approach entails greater storage and computational load and benefits from careful QA/QC to prevent overfitting. It is feasible on CPUs for AOIs aligned with watershed management needs.[^9]

---

## Simplified LandTrendr Approaches (Local Options)

LandTrendr (Landsat-based Detection of Trends in Disturbance and Recovery) models a pixel’s spectral trajectory as a series of linear segments, with vertices marking changes. Disturbance appears as a short, steep segment; recovery as a longer, gentle segment returning toward baseline.[^2] Two implementation pathways are common:

- ArcGIS Pro. The Analyze Changes Using LandTrendr tool fits yearly time series to extract segment models, with outputs such as fitted value slices and change analysis rasters from which dates and magnitudes of change can be extracted. The tool requires a multidimensional raster with yearly slices (e.g., one per year), cloud/shadow screening, and appropriate index selection (e.g., NIR for vegetation, MNDWI for open water) to target the phenomenon of interest.[^2]

- Google Earth Engine (GEE). The LandTrendr algorithm is implemented in GEE, with the Python package lt-gee-py acting as a convenience wrapper to build collections, run segmentation, and export change maps, including year of change, spectral delta, duration, and pre-event values. lt-gee-py examples and API design are oriented toward cloud execution, not local CPU processing.[^10][^11]

Local alternatives. When local CPU execution is required, analysts can emulate key LandTrendr outputs by:
- Segmenting trajectories with BEAST, which provides change-point probabilities, seasonality, and trend decomposition per pixel. This yields similar interpretability (timing and magnitude) to LandTrendr, with the added benefit of uncertainty quantification.[^4]
- Using seasonal index stacks and robust differencing, followed by MK/Sen’s slope to map trend directions and magnitudes over time. While not a segmentation algorithm per se, this approach delivers robust, interpretable trend maps suited to disturbance/recovery monitoring at watershed scale.

Table 6. LandTrendr outputs and alternatives

| Output | Description | Local alternatives |
|---|---|---|
| Fitted value slices | Modeled spectral values per year | BEAST fitted trend; seasonal median composites |
| Vertex years | Timing of segment breaks | BEAST breakpoint probabilities; MK trend changepoints (approximate) |
| Magnitude/duration | Spectral delta and time to recovery | BEAST magnitude; Sen’s slope over recovery windows |
| Loss/growth segmentation | Disturbance vs. recovery | Thresholded NDVI/NBR differences with confirmatory rules |

In practice, watershed teams can align outputs by mapping LandTrendr’s conceptual products—fitted trajectories, vertices, and segment metrics—onto BEAST’s decomposed components and MK/Sen’s slope trend rasters for local CPU analyses.

---

## Implementation Stack and Workflow Recipes (Local CPU)

Local CPU-first implementations can be built from a concise set of open-source libraries and toolchains. The stack below emphasizes reproducibility, scalability to large AOIs, and compatibility with existing GIS data stores.

Python libraries. Use rasterio and numpy for array-based raster I/O and index computation; xarray and rioxarray for multidimensional handling; scipy and scikit-learn for processing and ML; pyMannKendall for MK tests; and the nrt package for near real-time monitoring. BEAST provides R/Python interfaces for change-point detection.[^2][^4][^5][^6] Workflows should leverage chunked processing and out-of-core techniques for large rasters.

Workflow recipes.

Recipe 1: NDVI/NBR seasonal composites and change map
1) Acquire Landsat scenes for two seasonal windows (e.g., pre- and post-event or two years), apply cloud/shadow masks using QA layers, and compute seasonal median composites for NDVI and NBR.[^2][^3]
2) Compute per-pixel differences (post − pre) and threshold using empirical histograms or z-scores. Produce signed change rasters and binary masks for “significant change.” Visualize with diverging colormaps.[^1][^2]
3) Optionally mask agriculture/water to focus on disturbance in natural vegetation.

Recipe 2: Pixel-wise MK/Sen’s slope on a time series stack
1) Build a time series stack of an index (e.g., NDVI) as seasonal medians per year. 
2) For each pixel, run MK and compute Sen’s slope using pyMannKendall; export slope and p-value rasters. Use variance-corrected MK variants if autocorrelation is strong.[^6][^7]
3) Summarize trends by watershed sub-units and produce significance masks for stakeholder maps.

Recipe 3: BEAST decomposition per pixel
1) For each pixel’s seasonal index time series, run BEAST to estimate change-points, trend, and seasonality.[^4]
2) Export breakpoint probabilities and magnitudes; threshold to produce change maps; create “filmstrips” to visualize recovery.

Recipe 4: nrt monitoring (EWMA/CuSum/MoSum)
1) Split data into a stable history window and a monitoring window. Fit baseline models in the history period.[^5][^8]
2) Apply EWMA, CuSum, or MoSum monitoring with confirmation rules; save state for continuity across new acquisitions; export alerts as rasters with confidence levels.

File I/O and portability. Write outputs as Cloud-optimized GeoTIFFs or conventional GeoTIFFs with STAC metadata where feasible; maintain clear naming conventions that embed index, season, and year (e.g., ndvi_2023_jja_median.tif). Use portable Python environments (conda/pip) and containerization if workflows are shared across teams.

Table 7. Workflow-to-tool mapping

| Step | Python libraries / packages | Notes |
|---|---|---|
| Index calculation | rasterio, numpy | Handle NaNs and zero denominators |
| Cloud masking | QA layers via rasterio/xarray | Landsat QA bit flags; earthpy.mask patterns[^3] |
| Seasonal compositing | xarray, numpy | Median across masked pixels |
| Trend tests | pyMannKendall | Original/modified MK; Sen’s slope[^6][^7] |
| Change-point detection | BEAST (R/Python) | Probabilistic breakpoints; CPU[^4] |
| NRT monitoring | nrt (ewma, cusum, mosum) | CPU-optimized; xarray/rasterio I/O[^5][^8] |
| ML classification | scikit-learn | RF/SVM; feature stacks[^9] |
| Visualization | matplotlib, earthpy.plot | Diverging colormaps; QA plots |

---

## Validation, Accuracy Assessment, and Uncertainty

Validation underpins credible change detection. The approach depends on the method used but shares common elements.

Bi-temporal differencing/ratios. Use thresholded change masks against independent references: field data, high-resolution imagery, or digitized polygons of known disturbances. For burn severity, compare against normalized burn ratio differences and ground-based severity plots; for vegetation loss, compare against fixed-area plots or aerial photography. Report overall accuracy, omission/commission error by class, and area estimates with confidence intervals, mindful of pixel-scale uncertainty. The Landscape Toolbox emphasizes the interpretive nature of differencing and the importance of threshold refinement.[^1]

Time series methods. For MK/Sen’s slope, report the proportion of pixels with significant trends (p < alpha) and the distribution of Sen’s slope magnitudes; mask areas with insufficient observations or high noise. For BEAST, assess the timing and magnitude of detected change against independent event logs (e.g., fire perimeters), and quantify uncertainty via posterior probabilities. Use conservative thresholds to reduce false positives and confirm with multi-index evidence (e.g., NDVI loss plus NBR signal).[^4][^6]

ML classification. Build confusion matrices from validation samples, compute per-class accuracies, and report area-adjusted estimates. Conduct sensitivity analyses on threshold choices and feature sets, and maintain separate test sets for model selection and final assessment. Post-classification comparison inherits classification uncertainty; ensure consistent labeling and legend alignment to reduce spurious changes.[^9]

The table below summarizes common validation outputs.

Table 8. Validation outputs by method

| Method | Primary metrics | Uncertainty products |
|---|---|---|
| Image differencing/ratios | Overall accuracy, omission/commission, area estimates | Threshold sensitivity; confidence intervals on area[^1] |
| MK/Sen’s slope | Proportion significant (p < alpha), slope distribution | P-value rasters; masks for low-observation pixels[^6] |
| BEAST | Event detection accuracy vs. references | Posterior probabilities of change; magnitude uncertainty[^4] |
| Post-classification | Confusion matrix; kappa-like metrics | Error-adjusted class areas; per-class CIs[^9] |

---

## Practical Recommendations for Watershed Monitoring

- Start simple, then iterate. Begin with cloud-masked seasonal medians and index differencing to produce robust baseline change maps. Use MK/Sen’s slope to quantify monotonic changes and BEAST to pinpoint abrupt disturbances.[^1][^2][^4][^6]
- Focus indices by objective. Use NDVI for vegetation condition and recovery, NBR for burn severity and post-fire recovery, and TCG with TCW to contextualize greenness vs. moisture dynamics. In riparian corridors and wetlands, pair greenness with wetness indices to separate inundation from vegetation signals.[^2]
- Choose methods by need. For quick, interpretable signals, use differencing/ratios. For monotonic trends, use MK/Sen’s slope. For abrupt events with seasonality, use BEAST. For operational alerts, use NRT methods (EWMA, CuSum, MoSum) with confirmation rules.[^4][^5][^6][^8]
- Stay CPU-first. Favor RF/SVM/boosted trees and MLPs for change attribution at watershed scale; reserve CNN/LSTM for small AOIs or GPU-enabled settings.[^9]
- Attribute change conservatively. Combine evidence across indices and methods, incorporate ancillary data (e.g., precipitation anomalies, fire Weather Index), and use temporal profiles to corroborate disturbance narratives.

---

## Limitations and Information Gaps

- Tasseled Cap Greenness (TCG) transform coefficients vary by sensor and are not comprehensively consolidated across Landsat sensors in the public materials referenced here. Practitioners should consult sensor-specific documentation when applying TCG.[^2]
- Fully local, open-source LandTrendr re-implementations are limited; lt-gee-py is designed to run in the cloud on GEE. Teams requiring local CPU execution should emulate LandTrendr-like segmentation with BEAST and seasonal trend methods.[^10][^11]
- Direct, watershed-specific case studies are limited in the collected references; the guide extrapolates from general vegetation change detection and time series analysis practice to the watershed context.
- Performance benchmarks (throughput, memory) for CPU-only processing at scale are not provided; teams should pilot and profile workflows on representative AOIs before full deployment.

---

## References

[^1]: Landscape Toolbox. Change Detection – Landscape Toolbox. https://landscapetoolbox.org/remote-sensing-methods/change-detection/

[^2]: Digital Earth Africa Training. Exercise: Vegetation change detection. https://training.digitalearthafrica.org/en/latest/session_5/02_vegetation_exercise.html

[^3]: Earth Data Science. Clean Remote Sensing Data in Python – Clouds, Shadows & Cloud Masks (Landsat). https://earthdatascience.org/courses/use-data-open-source-python/multispectral-remote-sensing/landsat-in-Python/remove-clouds-from-landsat-data/

[^4]: Zhao K. et al. Rbeast: Bayesian Change-Point Detection and Time Series Decomposition (BEAST). https://github.com/zhaokg/Rbeast

[^5]: Dutrieux L., Viehweger J. ec-jrc/nrt: Near Real Time monitoring of satellite image time-series (Python). https://github.com/ec-jrc/nrt

[^6]: Hussain M.M. et al. pyMannKendall: A Python package for non-parametric Mann–Kendall family of trend tests. https://github.com/mmhs013/pyMannKendall

[^7]: Dharpure J.K. Exploring Temporal Trends: Analyzing Time Series and Gridded Data with Python. https://medium.com/@jaydharpure2007/exploring-temporal-trends-analyzing-time-series-and-gridded-data-with-python-50eac2a13354

[^8]: Dutrieux L., Viehweger J. nrt: operational monitoring of satellite image time-series in Python. Journal of Open Source Software, 2024. https://doi.org/10.21105/joss.06815

[^9]: Machine learning approaches to Landsat change detection analysis. 2024. https://www.tandfonline.com/doi/full/10.1080/07038992.2024.2448169

[^10]: Kennedy R.E. et al. Implementation of the LandTrendr Algorithm on Google Earth Engine. Remote Sensing, 2018. http://www.mdpi.com/2072-4292/10/5/691

[^11]: eMapR. lt-gee-py: Python interface to the Google Earth Engine LandTrendr implementation. https://github.com/eMapR/lt-gee-py

---