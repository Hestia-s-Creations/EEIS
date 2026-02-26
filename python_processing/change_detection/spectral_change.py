"""Spectral change detection using vegetation indices and other spectral measures."""

import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime
import warnings
from scipy import ndimage
from sklearn.cluster import KMeans
from dataclasses import dataclass

from config import Settings


# ---- Burn severity thresholds (USGS/validated M3 method) ----
@dataclass
class SeverityBreaks:
    """Threshold breaks for classifying a delta-index into severity classes."""
    low: float
    moderate: float
    high: float


SEVERITY_BREAKS = {
    "dNBR": SeverityBreaks(0.10, 0.27, 0.66),
    "dNDVI": SeverityBreaks(0.10, 0.25, 0.50),
    "dEVI": SeverityBreaks(0.08, 0.20, 0.45),
    "dSAVI": SeverityBreaks(0.10, 0.25, 0.50),
}

SEVERITY_LABELS = {0: "unburned", 1: "low", 2: "moderate", 3: "high"}


logger = logging.getLogger(__name__)


class SpectralChangeDetector:
    """Change detection using spectral indices and spectral measures."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
    
    def detect_spectral_changes(self,
                              dataset1: xr.Dataset,
                              dataset2: xr.Dataset,
                              indices: List[str] = None) -> Dict:
        """Detect changes between two datasets using spectral indices."""
        
        try:
            logger.info("Detecting spectral changes between two datasets")
            
            # Default indices to calculate if not specified
            if indices is None:
                indices = ['NDVI', 'NBR', 'TCG', 'NDWI']
            
            # Calculate indices for both datasets
            indices1 = self._calculate_indices_for_dataset(dataset1, indices)
            indices2 = self._calculate_indices_for_dataset(dataset2, indices)
            
            # Detect changes for each index
            change_results = {}
            
            for index_name in indices:
                if index_name in indices1 and index_name in indices2:
                    change_result = self._detect_index_change(
                        indices1[index_name], indices2[index_name], index_name
                    )
                    change_results[index_name] = change_result
                else:
                    logger.warning(f"Index {index_name} not available in both datasets")
            
            # Combine results
            combined_changes = self._combine_change_results(change_results)
            
            return {
                'individual_changes': change_results,
                'combined_changes': combined_changes,
                'dataset1_info': {
                    'timestamp': dataset1.attrs.get('timestamp', 'Unknown'),
                    'source': dataset1.attrs.get('source', 'Unknown')
                },
                'dataset2_info': {
                    'timestamp': dataset2.attrs.get('timestamp', 'Unknown'),
                    'source': dataset2.attrs.get('source', 'Unknown')
                },
                'change_statistics': self._calculate_change_statistics(change_results)
            }
            
        except Exception as e:
            logger.error(f"Error in spectral change detection: {e}")
            raise
    
    def _calculate_indices_for_dataset(self, 
                                     dataset: xr.Dataset, 
                                     indices: List[str]) -> Dict:
        """Calculate specified indices for a dataset."""
        
        from preprocessing.spectral_indices import SpectralIndices
        spectral_calc = SpectralIndices(self.settings)
        
        calculated_indices = {}
        
        for index_name in indices:
            try:
                if index_name == 'NDVI':
                    calculated_indices['NDVI'] = spectral_calc.calculate_ndvi(dataset)
                elif index_name == 'NBR':
                    calculated_indices['NBR'] = spectral_calc.calculate_nbr(dataset)
                elif index_name == 'TCG':
                    calculated_indices['TCG'] = spectral_calc.calculate_tcg(dataset)
                elif index_name == 'TCW':
                    calculated_indices['TCW'] = spectral_calc.calculate_tcw(dataset)
                elif index_name == 'TCB':
                    calculated_indices['TCB'] = spectral_calc.calculate_tcb(dataset)
                elif index_name == 'EVI':
                    calculated_indices['EVI'] = spectral_calc.calculate_evi(dataset)
                elif index_name == 'NDWI':
                    calculated_indices['NDWI'] = spectral_calc.calculate_ndwi(dataset)
                elif index_name == 'NDSI':
                    calculated_indices['NDSI'] = spectral_calc.calculate_ndsi(dataset)
                elif index_name == 'SAVI':
                    calculated_indices['SAVI'] = spectral_calc.calculate_savi(dataset)
                else:
                    logger.warning(f"Unknown index: {index_name}")
                    
            except Exception as e:
                logger.warning(f"Could not calculate {index_name}: {e}")
        
        return calculated_indices
    
    def _detect_index_change(self,
                           index1: xr.DataArray,
                           index2: xr.DataArray,
                           index_name: str) -> Dict:
        """Detect changes for a specific index."""
        
        try:
            # Calculate change magnitude
            change_magnitude = index2 - index1
            
            # Calculate absolute change
            absolute_change = np.abs(change_magnitude)
            
            # Determine threshold based on index type
            threshold = self._get_change_threshold(index_name)
            
            # Identify significant changes
            significant_changes = absolute_change > threshold
            
            # Classify change direction
            positive_changes = (change_magnitude > threshold)
            negative_changes = (change_magnitude < -threshold)
            
            # Calculate change statistics
            change_stats = {
                'mean_change': float(change_magnitude.mean()),
                'std_change': float(change_magnitude.std()),
                'max_change': float(change_magnitude.max()),
                'min_change': float(change_magnitude.min()),
                'significant_pixels': int(significant_changes.sum()),
                'positive_changes': int(positive_changes.sum()),
                'negative_changes': int(negative_changes.sum()),
                'change_percentage': float(significant_changes.mean() * 100),
                'threshold': threshold
            }
            
            return {
                'index_name': index_name,
                'change_magnitude': change_magnitude,
                'absolute_change': absolute_change,
                'significant_changes': significant_changes,
                'positive_changes': positive_changes,
                'negative_changes': negative_changes,
                'change_statistics': change_stats
            }
            
        except Exception as e:
            logger.error(f"Error detecting changes for index {index_name}: {e}")
            raise
    
    def _get_change_threshold(self, index_name: str) -> float:
        """Get appropriate change threshold for different indices."""
        
        thresholds = {
            'NDVI': self.settings.NDVI_THRESHOLD,
            'NBR': self.settings.NBR_THRESHOLD,
            'TCG': self.settings.TCG_THRESHOLD,
            'TCW': 0.1,  # Default for wetness
            'TCB': 0.2,  # Default for brightness
            'EVI': 0.15,  # Default for EVI
            'NDWI': 0.2,  # Default for water index
            'NDSI': 0.3,  # Default for snow index
            'SAVI': 0.15   # Default for SAVI
        }
        
        return thresholds.get(index_name, 0.1)  # Default threshold
    
    def _combine_change_results(self, change_results: Dict) -> Dict:
        """Combine change results from multiple indices."""
        
        try:
            if not change_results:
                return {}
            
            # Get reference data from first index
            first_index = list(change_results.keys())[0]
            ref_data = change_results[first_index]['significant_changes']
            
            # Initialize combined masks
            combined_positive = ref_data.copy() * 0
            combined_negative = ref_data.copy() * 0
            combined_total = ref_data.copy() * 0
            
            # Aggregate changes from all indices
            total_changes = 0
            for index_name, result in change_results.items():
                combined_positive = combined_positive | result['positive_changes']
                combined_negative = combined_negative | result['negative_changes']
                total_changes = total_changes + result['significant_changes'].astype(int)
            
            # Calculate confidence based on number of indices detecting change
            confidence_map = total_changes / len(change_results)
            
            # Create final classification
            combined_classification = xr.zeros_like(ref_data, dtype=int)
            combined_classification = xr.where(combined_positive, 1, combined_classification)  # Improvement
            combined_classification = xr.where(combined_negative, -1, combined_classification)  # Degradation
            
            # Confidence scoring
            high_confidence = confidence_map > 0.7
            medium_confidence = (confidence_map > 0.4) & (confidence_map <= 0.7)
            
            # Final combined result
            combined_result = {
                'positive_changes': combined_positive,
                'negative_changes': combined_negative,
                'confidence_map': confidence_map,
                'combined_classification': combined_classification,
                'high_confidence_changes': high_confidence,
                'medium_confidence_changes': medium_confidence,
                'statistics': {
                    'total_positive_pixels': int(combined_positive.sum()),
                    'total_negative_pixels': int(combined_negative.sum()),
                    'total_changed_pixels': int((combined_positive | combined_negative).sum()),
                    'high_confidence_pixels': int(high_confidence.sum()),
                    'medium_confidence_pixels': int(medium_confidence.sum()),
                    'change_percentage': float(((combined_positive | combined_negative).mean() * 100)),
                    'high_confidence_percentage': float((high_confidence.mean() * 100)),
                    'indices_used': list(change_results.keys())
                }
            }
            
            return combined_result
            
        except Exception as e:
            logger.error(f"Error combining change results: {e}")
            raise
    
    def _calculate_change_statistics(self, change_results: Dict) -> Dict:
        """Calculate overall change statistics."""
        
        try:
            stats = {
                'indices_analyzed': len(change_results),
                'indices_with_changes': 0,
                'total_significant_changes': 0,
                'average_change_percentage': 0,
                'most_significant_change_index': None,
                'max_change_percentage': 0,
                'change_distribution': {}
            }
            
            change_percentages = []
            
            for index_name, result in change_results.items():
                change_percentage = result['change_statistics']['change_percentage']
                change_percentages.append(change_percentage)
                
                if change_percentage > 0:
                    stats['indices_with_changes'] += 1
                    stats['total_significant_changes'] += result['change_statistics']['significant_pixels']
                
                if change_percentage > stats['max_change_percentage']:
                    stats['max_change_percentage'] = change_percentage
                    stats['most_significant_change_index'] = index_name
                
                stats['change_distribution'][index_name] = {
                    'change_percentage': change_percentage,
                    'significant_pixels': result['change_statistics']['significant_pixels'],
                    'positive_changes': result['change_statistics']['positive_changes'],
                    'negative_changes': result['change_statistics']['negative_changes']
                }
            
            if change_percentages:
                stats['average_change_percentage'] = np.mean(change_percentages)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error calculating change statistics: {e}")
            return {}
    
    def detect_disturbance(self, 
                          dataset1: xr.Dataset,
                          dataset2: xr.Dataset,
                          disturbance_types: List[str] = None) -> Dict:
        """Detect specific types of disturbances."""
        
        try:
            logger.info("Detecting disturbances between datasets")
            
            if disturbance_types is None:
                disturbance_types = ['deforestation', 'burn', 'flood', 'urban_expansion']
            
            disturbance_results = {}
            
            for disturbance_type in disturbance_types:
                try:
                    result = self._detect_specific_disturbance(
                        dataset1, dataset2, disturbance_type
                    )
                    if result is not None:
                        disturbance_results[disturbance_type] = result
                except Exception as e:
                    logger.warning(f"Could not detect {disturbance_type}: {e}")
            
            return {
                'disturbances_detected': disturbance_results,
                'total_disturbances': len(disturbance_results),
                'confidence_summary': self._summarize_disturbance_confidence(disturbance_results)
            }
            
        except Exception as e:
            logger.error(f"Error in disturbance detection: {e}")
            raise
    
    def _detect_specific_disturbance(self,
                                   dataset1: xr.Dataset,
                                   dataset2: xr.Dataset,
                                   disturbance_type: str) -> Optional[Dict]:
        """Detect specific type of disturbance."""
        
        try:
            if disturbance_type == 'deforestation':
                return self._detect_deforestation(dataset1, dataset2)
            elif disturbance_type == 'burn':
                return self._detect_burn(dataset1, dataset2)
            elif disturbance_type == 'flood':
                return self._detect_flood(dataset1, dataset2)
            elif disturbance_type == 'urban_expansion':
                return self._detect_urban_expansion(dataset1, dataset2)
            else:
                logger.warning(f"Unknown disturbance type: {disturbance_type}")
                return None
                
        except Exception as e:
            logger.error(f"Error detecting {disturbance_type}: {e}")
            return None
    
    def _detect_deforestation(self, dataset1: xr.Dataset, dataset2: xr.Dataset) -> Dict:
        """Detect deforestation using NDVI and NBR changes."""
        
        from preprocessing.spectral_indices import SpectralIndices
        spectral_calc = SpectralIndices(self.settings)
        
        # Calculate NDVI and NBR for both datasets
        ndvi1 = spectral_calc.calculate_ndvi(dataset1) if 'B4' in dataset1 and 'B5' in dataset1 else None
        ndvi2 = spectral_calc.calculate_ndvi(dataset2) if 'B4' in dataset2 and 'B5' in dataset2 else None
        
        nbr1 = spectral_calc.calculate_nbr(dataset1) if 'B5' in dataset1 and 'B7' in dataset1 else None
        nbr2 = spectral_calc.calculate_nbr(dataset2) if 'B5' in dataset2 and 'B7' in dataset2 else None
        
        deforestation_mask = None
        
        if ndvi1 is not None and ndvi2 is not None:
            ndvi_change = ndvi2 - ndvi1
            # Deforestation: significant NDVI decrease in vegetated areas
            deforestation_mask = (ndvi_change < -0.3) & (ndvi1 > 0.5)
            
            if nbr1 is not None and nbr2 is not None:
                nbr_change = nbr2 - nbr1
                # Additional NBR criteria for burns
                deforestation_mask = deforestation_mask | ((ndvi_change < -0.2) & (nbr_change < -0.1))
        
        if deforestation_mask is not None:
            return {
                'disturbance_type': 'deforestation',
                'mask': deforestation_mask,
                'confidence': self._calculate_disturbance_confidence(deforestation_mask, 'deforestation'),
                'area_pixels': int(deforestation_mask.sum()),
                'area_percentage': float(deforestation_mask.mean() * 100)
            }
        
        return None
    
    def _detect_burn(self, dataset1: xr.Dataset, dataset2: xr.Dataset) -> Dict:
        """Detect burn scars using NBR and NDSI changes, with severity classification."""

        from preprocessing.spectral_indices import SpectralIndices
        spectral_calc = SpectralIndices(self.settings)

        # Calculate NBR and NDSI for both datasets
        nbr1 = spectral_calc.calculate_nbr(dataset1) if 'B5' in dataset1 and 'B7' in dataset1 else None
        nbr2 = spectral_calc.calculate_nbr(dataset2) if 'B5' in dataset2 and 'B7' in dataset2 else None

        ndsi1 = spectral_calc.calculate_ndsi(dataset1) if 'B3' in dataset1 and 'B6' in dataset1 else None
        ndsi2 = spectral_calc.calculate_ndsi(dataset2) if 'B3' in dataset2 and 'B6' in dataset2 else None

        burn_mask = None

        if nbr1 is not None and nbr2 is not None:
            nbr_change = nbr2 - nbr1
            # Burn: significant NBR decrease
            burn_mask = nbr_change < -0.2

            # Additional criteria
            if ndsi1 is not None and ndsi2 is not None:
                ndsi_change = ndsi2 - ndsi1
                # Burns often show increased snow index temporarily
                burn_mask = burn_mask & (ndsi_change < 0.3)

        if burn_mask is not None:
            result = {
                'disturbance_type': 'burn',
                'mask': burn_mask,
                'confidence': self._calculate_disturbance_confidence(burn_mask, 'burn'),
                'area_pixels': int(burn_mask.sum()),
                'area_percentage': float(burn_mask.mean() * 100)
            }

            # Run severity classification when burn is detected
            if int(burn_mask.sum()) > 0:
                try:
                    severity_result = self.classify_burn_severity(dataset1, dataset2)
                    # Store only JSON-serializable statistics; rasters are kept
                    # in-memory for GeoJSON export but not in the result dict
                    result['burn_severity'] = severity_result['statistics']
                    # Keep rasters available as private attrs for callers that need them
                    result['_severity_map'] = severity_result['severity_map']
                    result['_confidence_map'] = severity_result['confidence_map']
                except Exception as e:
                    logger.warning(f"Severity classification failed, returning binary only: {e}")

            return result

        return None

    def classify_burn_severity(
        self,
        pre_dataset: xr.Dataset,
        post_dataset: xr.Dataset,
        indices: List[str] = None,
        threshold: float = 0.5,
    ) -> Dict:
        """Classify burn severity using M3 majority vote across multiple indices.

        Uses the validated Veg-4 index set (dNBR, dNDVI, dEVI, dSAVI) with
        USGS-standard severity breaks. Each index votes for a severity class
        per pixel; the majority vote wins.

        Args:
            pre_dataset: Pre-fire satellite data (xr.Dataset with bands B2-B7).
            post_dataset: Post-fire satellite data.
            indices: Delta index names to use. Defaults to ["dNBR", "dNDVI", "dEVI", "dSAVI"].
            threshold: Fraction of indices that must agree (0.5 = simple majority).

        Returns:
            Dict with:
                severity_map: xr.DataArray (0=Unburned, 1=Low, 2=Moderate, 3=High)
                confidence_map: xr.DataArray (0.0-1.0, fraction of indices that agreed)
                statistics: Dict with per-class pixel counts and percentages
        """
        from preprocessing.spectral_indices import SpectralIndices
        spectral_calc = SpectralIndices(self.settings)

        if indices is None:
            indices = ["dNBR", "dNDVI", "dEVI", "dSAVI"]

        # Map delta names to calculator methods
        calc_map = {
            "dNBR": spectral_calc.calculate_nbr,
            "dNDVI": spectral_calc.calculate_ndvi,
            "dEVI": spectral_calc.calculate_evi,
            "dSAVI": spectral_calc.calculate_savi,
        }

        # Compute delta images (pre - post: positive = vegetation loss)
        # NOTE: Existing pipeline uses post - pre, so we negate here
        deltas = {}
        for delta_name in indices:
            if delta_name not in calc_map:
                logger.warning(f"Unknown severity index: {delta_name}, skipping")
                continue
            if delta_name not in SEVERITY_BREAKS:
                logger.warning(f"No severity breaks for {delta_name}, skipping")
                continue
            try:
                pre_idx = calc_map[delta_name](pre_dataset)
                post_idx = calc_map[delta_name](post_dataset)
                # pre - post: positive = loss (fire severity convention)
                deltas[delta_name] = pre_idx - post_idx
                logger.info(f"Computed {delta_name}: mean={float(deltas[delta_name].mean()):.4f}")
            except Exception as e:
                logger.warning(f"Could not compute {delta_name}: {e}")

        if not deltas:
            raise ValueError("No delta indices could be computed for severity classification")

        n_indices = len(deltas)
        ref = next(iter(deltas.values()))

        # Count votes for each class (0-3) from each index
        votes = np.zeros((4,) + ref.shape, dtype=np.float32)

        for idx_name, delta in deltas.items():
            breaks = SEVERITY_BREAKS[idx_name]
            # Classify single index
            classified = xr.full_like(delta, fill_value=0, dtype=np.float32)
            classified = xr.where(delta < breaks.low, 0, classified)  # Unburned
            classified = xr.where(
                (delta >= breaks.low) & (delta < breaks.moderate), 1, classified
            )  # Low
            classified = xr.where(
                (delta >= breaks.moderate) & (delta < breaks.high), 2, classified
            )  # Moderate
            classified = xr.where(delta >= breaks.high, 3, classified)  # High

            for cls in range(4):
                votes[cls] += (classified.values == cls).astype(np.float32)

        # Calculate vote fractions
        vote_fractions = votes / n_indices

        # Find winning class per pixel (ties broken toward higher severity)
        max_fraction = np.nanmax(vote_fractions, axis=0)
        meets_threshold = max_fraction >= threshold

        # Flip to break ties toward higher severity
        flipped = vote_fractions[::-1]  # classes 3,2,1,0
        winner_flipped = np.argmax(flipped, axis=0)
        winner_class = 3 - winner_flipped

        severity_values = np.where(meets_threshold, winner_class, 0).astype(np.float32)

        severity_map = xr.DataArray(
            severity_values,
            coords=ref.coords,
            dims=ref.dims,
            attrs={"method": "M3_majority_vote", "threshold": threshold,
                   "indices": list(deltas.keys())},
        )

        confidence_map = xr.DataArray(
            max_fraction.astype(np.float32),
            coords=ref.coords,
            dims=ref.dims,
            attrs={"description": "Fraction of indices agreeing on winning class"},
        )

        # Calculate statistics
        total_pixels = int(np.prod(severity_values.shape))
        valid_pixels = int(np.isfinite(severity_values).sum())

        class_counts = {}
        class_percentages = {}
        for cls in range(4):
            label = SEVERITY_LABELS[cls]
            count = int((severity_values == cls).sum())
            class_counts[label] = count
            class_percentages[label] = (count / valid_pixels * 100) if valid_pixels > 0 else 0.0

        statistics = {
            'total_pixels': total_pixels,
            'valid_pixels': valid_pixels,
            'class_counts': class_counts,
            'class_percentages': class_percentages,
            'high_severity_percentage': class_percentages.get('high', 0.0),
            'moderate_severity_percentage': class_percentages.get('moderate', 0.0),
            'low_severity_percentage': class_percentages.get('low', 0.0),
            'unburned_percentage': class_percentages.get('unburned', 0.0),
            'indices_used': list(deltas.keys()),
            'n_indices': n_indices,
            'vote_threshold': threshold,
            'mean_confidence': float(np.nanmean(max_fraction)),
        }

        logger.info(
            f"Burn severity classification complete: "
            f"High={class_percentages.get('high', 0):.1f}%, "
            f"Moderate={class_percentages.get('moderate', 0):.1f}%, "
            f"Low={class_percentages.get('low', 0):.1f}%, "
            f"Unburned={class_percentages.get('unburned', 0):.1f}%"
        )

        return {
            'severity_map': severity_map,
            'confidence_map': confidence_map,
            'statistics': statistics,
        }

    def severity_to_geojson(
        self,
        severity_map: xr.DataArray,
        confidence_map: xr.DataArray,
        transform=None,
        crs=None,
        simplify_tolerance: float = 0.0001,
    ) -> Dict:
        """Convert severity raster to GeoJSON FeatureCollection.

        Args:
            severity_map: Integer severity classes (0-3).
            confidence_map: Confidence values (0.0-1.0).
            transform: Affine transform from rasterio (for georeferencing).
            crs: Coordinate reference system.
            simplify_tolerance: Geometry simplification tolerance.

        Returns:
            GeoJSON FeatureCollection with severity polygons.
        """
        try:
            from rasterio.features import shapes
            from shapely.geometry import shape, mapping
            from shapely.ops import unary_union
        except ImportError:
            logger.warning("rasterio/shapely not available, returning empty GeoJSON")
            return {"type": "FeatureCollection", "features": []}

        features = []
        severity_arr = severity_map.values.astype(np.int32)
        confidence_arr = confidence_map.values.astype(np.float32)

        # Vectorize each severity class separately (skip unburned=0)
        for cls in [1, 2, 3]:
            class_mask = (severity_arr == cls).astype(np.uint8)
            if class_mask.sum() == 0:
                continue

            try:
                for geom, val in shapes(class_mask, transform=transform):
                    if val == 0:
                        continue

                    poly = shape(geom)
                    if simplify_tolerance > 0:
                        poly = poly.simplify(simplify_tolerance, preserve_topology=True)

                    if poly.is_empty:
                        continue

                    # Calculate mean confidence for this polygon's area
                    area_hectares = poly.area * 1e4 if crs and 'degree' not in str(crs) else poly.area * 12321  # rough deg->ha

                    features.append({
                        "type": "Feature",
                        "properties": {
                            "severity": SEVERITY_LABELS[cls],
                            "severity_class": cls,
                            "confidence": float(np.nanmean(confidence_arr[class_mask == 1])),
                            "area_hectares": round(area_hectares, 2),
                        },
                        "geometry": mapping(poly),
                    })
            except Exception as e:
                logger.warning(f"Error vectorizing severity class {cls}: {e}")

        logger.info(f"Generated {len(features)} severity polygons")
        return {"type": "FeatureCollection", "features": features}
    
    def _detect_flood(self, dataset1: xr.Dataset, dataset2: xr.Dataset) -> Dict:
        """Detect flooding using NDWI changes."""
        
        from preprocessing.spectral_indices import SpectralIndices
        spectral_calc = SpectralIndices(self.settings)
        
        # Calculate NDWI for both datasets
        ndwi1 = spectral_calc.calculate_ndwi(dataset1) if 'B3' in dataset1 and 'B5' in dataset1 else None
        ndwi2 = spectral_calc.calculate_ndwi(dataset2) if 'B3' in dataset2 and 'B5' in dataset2 else None
        
        flood_mask = None
        
        if ndwi1 is not None and ndwi2 is not None:
            ndwi_change = ndwi2 - ndwi1
            # Flooding: significant NDWI increase
            flood_mask = ndwi_change > 0.2
        
        if flood_mask is not None:
            return {
                'disturbance_type': 'flood',
                'mask': flood_mask,
                'confidence': self._calculate_disturbance_confidence(flood_mask, 'flood'),
                'area_pixels': int(flood_mask.sum()),
                'area_percentage': float(flood_mask.mean() * 100)
            }
        
        return None
    
    def _detect_urban_expansion(self, dataset1: xr.Dataset, dataset2: xr.Dataset) -> Dict:
        """Detect urban expansion using TCB and spectral changes."""
        
        from preprocessing.spectral_indices import SpectralIndices
        spectral_calc = SpectralIndices(self.settings)
        
        # Calculate TCB for both datasets
        tcb1 = spectral_calc.calculate_tcb(dataset1) if len(dataset1.data_vars) >= 3 else None
        tcb2 = spectral_calc.calculate_tcb(dataset2) if len(dataset2.data_vars) >= 3 else None
        
        urban_mask = None
        
        if tcb1 is not None and tcb2 is not None:
            tcb_change = tcb2 - tcb1
            # Urban expansion: TCB increase and other urban indicators
            urban_mask = (tcb_change > 0.1) & (tcb2 > tcb1.quantile(0.8))
            
            # Add brightness criteria
            if all(band in dataset2 for band in ['B2', 'B3', 'B4']):
                brightness2 = (dataset2['B2'] + dataset2['B3'] + dataset2['B4']) / 3.0
                brightness1 = (dataset1['B2'] + dataset1['B3'] + dataset1['B4']) / 3.0
                brightness_change = brightness2 - brightness1
                urban_mask = urban_mask & (brightness_change > 0.1)
        
        if urban_mask is not None:
            return {
                'disturbance_type': 'urban_expansion',
                'mask': urban_mask,
                'confidence': self._calculate_disturbance_confidence(urban_mask, 'urban_expansion'),
                'area_pixels': int(urban_mask.sum()),
                'area_percentage': float(urban_mask.mean() * 100)
            }
        
        return None
    
    def _calculate_disturbance_confidence(self, mask: xr.DataArray, disturbance_type: str) -> Dict:
        """Calculate confidence metrics for disturbance detection."""
        
        try:
            # Basic confidence based on area
            area_percentage = mask.mean().item() * 100
            
            # Confidence levels based on area
            if area_percentage > 5.0:
                confidence_level = 'high'
            elif area_percentage > 1.0:
                confidence_level = 'medium'
            else:
                confidence_level = 'low'
            
            return {
                'confidence_level': confidence_level,
                'area_percentage': area_percentage,
                'confidence_score': min(1.0, area_percentage / 10.0)  # Normalize to 0-1
            }
            
        except Exception as e:
            logger.error(f"Error calculating disturbance confidence: {e}")
            return {'confidence_level': 'low', 'confidence_score': 0.1}
    
    def _summarize_disturbance_confidence(self, disturbance_results: Dict) -> Dict:
        """Summarize confidence across all detected disturbances."""
        
        try:
            if not disturbance_results:
                return {}
            
            confidence_levels = []
            confidence_scores = []
            
            for disturbance_type, result in disturbance_results.items():
                confidence = result['confidence']
                confidence_levels.append(confidence['confidence_level'])
                confidence_scores.append(confidence['confidence_score'])
            
            return {
                'average_confidence_score': np.mean(confidence_scores),
                'highest_confidence_disturbance': max(disturbance_results.keys(), 
                                                    key=lambda x: disturbance_results[x]['confidence']['confidence_score']),
                'confidence_distribution': {
                    level: confidence_levels.count(level) for level in set(confidence_levels)
                }
            }
            
        except Exception as e:
            logger.error(f"Error summarizing disturbance confidence: {e}")
            return {}