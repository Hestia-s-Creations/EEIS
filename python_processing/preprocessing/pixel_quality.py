"""Pixel quality assessment and cloud masking utilities."""

import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Tuple, Optional, Union
from scipy import ndimage
from sklearn.cluster import KMeans

from ..config import Settings


logger = logging.getLogger(__name__)


class PixelQuality:
    """Class for assessing pixel quality and applying masks."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
    
    def create_qa_mask(self, dataset: xr.Dataset, platform: str = "landsat") -> xr.DataArray:
        """Create quality assurance mask from available QA bands."""
        
        try:
            logger.info(f"Creating QA mask for {platform}")
            
            if platform.lower() == "landsat" and "BQA" in dataset:
                return self._create_landsat_qa_mask(dataset["BQA"])
            elif platform.lower() == "sentinel2":
                return self._create_sentinel2_qa_mask(dataset)
            else:
                logger.warning(f"No QA band available for {platform}")
                return xr.zeros_like(list(dataset.data_vars.values())[0], dtype=bool)
                
        except Exception as e:
            logger.error(f"Error creating QA mask: {e}")
            raise
    
    def _create_landsat_qa_mask(self, bqa: xr.DataArray) -> xr.DataArray:
        """Create mask from Landsat Pixel QA band."""
        
        # Bit interpretation for Landsat Pixel QA
        qa_values = bqa.values
        
        # Create individual masks
        water_mask = (qa_values & 1) == 1
        cloud_shadow_mask = (qa_values & 2) == 2
        snow_ice_mask = (qa_values & 4) == 4
        
        # Cloud confidence bits (bits 4-6)
        cloud_confidence_low = (qa_values & 8) == 8
        cloud_confidence_medium = (qa_values & 16) == 16
        cloud_confidence_high = (qa_values & 32) == 32
        
        # Cloud shadow confidence bits (bits 7-9)
        shadow_confidence_low = (qa_values & 64) == 64
        shadow_confidence_medium = (qa_values & 128) == 128
        shadow_confidence_high = (qa_values & 256) == 256
        
        # Combine cloud masks
        cloud_mask = cloud_confidence_high | (
            cloud_confidence_medium & cloud_confidence_low
        )
        shadow_mask = shadow_confidence_high | (
            shadow_confidence_medium & shadow_confidence_low
        )
        
        # Final quality mask (exclude low quality pixels)
        low_quality_mask = (
            cloud_mask | shadow_mask | cloud_shadow_mask | 
            snow_ice_mask | (qa_values == 1)  # Cloud, shadow, snow/ice, or water
        )
        
        # Convert to xarray with metadata
        mask = xr.DataArray(
            low_quality_mask,
            coords=bqa.coords,
            dims=bqa.dims,
            attrs={
                'description': 'Landsat Pixel QA mask',
                'masked_values': ['cloud', 'cloud_shadow', 'snow_ice', 'water']
            }
        )
        
        return mask
    
    def _create_sentinel2_qa_mask(self, dataset: xr.Dataset) -> xr.DataArray:
        """Create mask for Sentinel-2 data (simplified)."""
        
        # For Sentinel-2, we use cloud probability and scene classification
        cloud_prob_mask = xr.zeros_like(list(dataset.data_vars.values())[0], dtype=bool)
        
        # Check if cloud probability band exists (B10)
        if 'B10' in dataset:
            cloud_prob = dataset['B10']
            # High values in B10 (Cirrus) indicate cloud contamination
            cloud_prob_mask = cloud_prob > 0.01
        
        return cloud_prob_mask
    
    def create_spectral_cloud_mask(self, dataset: xr.Dataset) -> xr.DataArray:
        """Create cloud mask using spectral indices."""
        
        try:
            logger.info("Creating spectral cloud mask")
            
            # Normalized Difference Snow Index (NDSI) for snow/ice detection
            if 'B3' in dataset and 'B6' in dataset:  # Green and SWIR1
                ndsi = (dataset['B3'] - dataset['B6']) / (dataset['B3'] + dataset['B6'])
                snow_ice_mask = ndsi > 0.4
            else:
                snow_ice_mask = xr.zeros_like(list(dataset.data_vars.values())[0], dtype=bool)
            
            # Brightness threshold for clouds
            if all(band in dataset for band in ['B2', 'B3', 'B4']):  # RGB bands
                brightness = (dataset['B2'] + dataset['B3'] + dataset['B4']) / 3.0
                cloud_brightness_mask = brightness > 0.6
            else:
                cloud_brightness_mask = xr.zeros_like(list(dataset.data_vars.values())[0], dtype=bool)
            
            # NDVI for vegetation (low NDVI might indicate non-vegetated areas)
            if 'B4' in dataset and 'B5' in dataset:  # Red and NIR
                ndvi = (dataset['B5'] - dataset['B4']) / (dataset['B5'] + dataset['B4'])
                vegetation_mask = ndvi > 0.3
            else:
                vegetation_mask = xr.zeros_like(list(dataset.data_vars.values())[0], dtype=bool)
            
            # Combine masks
            combined_mask = snow_ice_mask | cloud_brightness_mask
            
            # Create mask array
            mask = xr.DataArray(
                combined_mask,
                coords=next(iter(dataset.data_vars.values())).coords,
                dims=next(iter(dataset.data_vars.values())).dims,
                attrs={
                    'description': 'Spectral cloud mask',
                    'method': 'spectral_indices',
                    'thresholds': {
                        'ndsi': 0.4,
                        'brightness': 0.6,
                        'ndvi': 0.3
                    }
                }
            )
            
            return mask
            
        except Exception as e:
            logger.error(f"Error creating spectral cloud mask: {e}")
            raise
    
    def apply_mask(self,
                  dataset: xr.Dataset,
                  mask: xr.DataArray,
                  mask_value: Union[float, int] = np.nan) -> xr.Dataset:
        """Apply mask to all bands in dataset."""
        
        try:
            logger.info("Applying pixel quality mask")
            
            # Ensure mask has same dimensions as data
            if mask.dims != next(iter(dataset.data_vars.values())).dims:
                mask = mask.transpose(*next(iter(dataset.data_vars.values())).dims)
            
            # Apply mask to each band
            masked_data = {}
            for var_name, data_var in dataset.data_vars.items():
                masked_data[var_name] = data_var.where(~mask, mask_value)
            
            # Create new dataset
            result = xr.Dataset(
                masked_data,
                coords=dataset.coords,
                attrs={**dataset.attrs, 'masked': True, 'mask_method': 'quality_assurance'}
            )
            
            # Calculate coverage statistics
            total_pixels = mask.size
            masked_pixels = mask.sum().item()
            mask_percentage = (masked_pixels / total_pixels) * 100
            
            result.attrs['mask_coverage_percent'] = mask_percentage
            logger.info(f"Applied mask to {mask_percentage:.1f}% of pixels")
            
            return result
            
        except Exception as e:
            logger.error(f"Error applying mask: {e}")
            raise
    
    def calculate_pixel_quality_score(self, dataset: xr.Dataset) -> xr.DataArray:
        """Calculate pixel quality score based on multiple criteria."""
        
        try:
            logger.info("Calculating pixel quality scores")
            
            # Initialize quality score (1.0 = perfect quality)
            ref_band = next(iter(dataset.data_vars.values()))
            quality_score = xr.ones_like(ref_band, dtype=float)
            
            # Criterion 1: Value range (reject extreme values)
            for var_name, data_var in dataset.data_vars.items():
                # Check for reasonable value ranges
                valid_range = (data_var >= 0) & (data_var <= 1)
                quality_score = quality_score.where(valid_range, quality_score * 0.8)
            
            # Criterion 2: NDVI (reject non-vegetated areas if they shouldn't be there)
            if 'B4' in dataset and 'B5' in dataset:
                ndvi = (dataset['B5'] - dataset['B4']) / (dataset['B5'] + dataset['B4'])
                # Penalize very low NDVI (bare soil) in areas expected to be vegetation
                quality_score = quality_score.where(ndvi > -0.5, quality_score * 0.9)
            
            # Criterion 3: Brightness (reject extremely bright pixels)
            if all(band in dataset for band in ['B2', 'B3', 'B4']):
                brightness = (dataset['B2'] + dataset['B3'] + dataset['B4']) / 3.0
                # Penalize extremely bright pixels (likely clouds or snow)
                quality_score = quality_score.where(brightness < 0.8, quality_score * 0.7)
            
            # Criterion 4: Band correlation (reject pixels with unrealistic correlations)
            if all(band in dataset for band in ['B3', 'B4', 'B5']):  # Green, Red, NIR
                # Green and Red should be correlated
                green_red_corr = dataset['B3'] / (dataset['B4'] + 1e-10)
                quality_score = quality_score.where(
                    (green_red_corr > 0.3) & (green_red_corr < 3.0),
                    quality_score * 0.8
                )
            
            # Ensure score is between 0 and 1
            quality_score = quality_score.clip(0, 1)
            
            # Add metadata
            quality_score.attrs = {
                'description': 'Pixel quality score (0-1)',
                'criteria': ['value_range', 'ndvi', 'brightness', 'band_correlation'],
                'thresholds': {
                    'ndvi_min': -0.5,
                    'brightness_max': 0.8,
                    'green_red_ratio_min': 0.3,
                    'green_red_ratio_max': 3.0
                }
            }
            
            return quality_score
            
        except Exception as e:
            logger.error(f"Error calculating pixel quality score: {e}")
            raise
    
    def identify_outliers(self, 
                         dataset: xr.Dataset,
                         method: str = "zscore",
                         threshold: float = 3.0) -> xr.DataArray:
        """Identify outlier pixels in the dataset."""
        
        try:
            logger.info(f"Identifying outliers using {method} method")
            
            outlier_masks = {}
            
            for var_name, data_var in dataset.data_vars.items():
                data = data_var.values
                
                if method == "zscore":
                    # Z-score based outlier detection
                    mean_val = np.nanmean(data)
                    std_val = np.nanstd(data)
                    
                    if std_val > 0:
                        z_scores = np.abs((data - mean_val) / std_val)
                        outlier_mask = z_scores > threshold
                    else:
                        outlier_mask = np.zeros_like(data, dtype=bool)
                
                elif method == "iqr":
                    # Interquartile Range based outlier detection
                    q1 = np.nanpercentile(data, 25)
                    q3 = np.nanpercentile(data, 75)
                    iqr = q3 - q1
                    
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    
                    outlier_mask = (data < lower_bound) | (data > upper_bound)
                
                elif method == "isolation_forest":
                    # Use sklearn Isolation Forest (simplified)
                    from sklearn.ensemble import IsolationForest
                    
                    # Flatten and remove NaN values
                    flat_data = data.reshape(-1, 1)
                    valid_mask = ~np.isnan(flat_data).any(axis=1)
                    
                    if valid_mask.sum() > 0:
                        iso_forest = IsolationForest(contamination=0.1, random_state=42)
                        outlier_labels = iso_forest.fit_predict(flat_data[valid_mask])
                        outlier_mask_flat = np.full(flat_data.shape[0], False)
                        outlier_mask_flat[valid_mask] = outlier_labels == -1
                        outlier_mask = outlier_mask_flat.reshape(data.shape)
                    else:
                        outlier_mask = np.zeros_like(data, dtype=bool)
                
                else:
                    raise ValueError(f"Unknown outlier detection method: {method}")
                
                outlier_masks[var_name] = outlier_mask
            
            # Combine outliers from all bands
            combined_outliers = np.logical_or.reduce(list(outlier_masks.values()))
            
            # Convert to xarray
            outlier_mask = xr.DataArray(
                combined_outliers,
                coords=ref_band.coords,
                dims=ref_band.dims,
                attrs={
                    'description': f'Outlier pixels detected using {method}',
                    'method': method,
                    'threshold': threshold
                }
            )
            
            return outlier_mask
            
        except Exception as e:
            logger.error(f"Error identifying outliers: {e}")
            raise
    
    def calculate_shadow_index(self, dataset: xr.Dataset) -> xr.DataArray:
        """Calculate shadow detection index."""
        
        try:
            logger.info("Calculating shadow index")
            
            if not all(band in dataset for band in ['B3', 'B4', 'B5']):
                raise ValueError("RGB+NIR bands required for shadow index calculation")
            
            # Simple shadow index based on NIR/Red ratio
            shadow_index = dataset['B5'] / (dataset['B4'] + 1e-10)
            
            # Invert so higher values indicate more shadow
            shadow_index = 1.0 / shadow_index
            
            # Normalize to 0-1 range
            shadow_index = (shadow_index - shadow_index.min()) / (shadow_index.max() - shadow_index.min())
            
            shadow_index.attrs = {
                'description': 'Shadow detection index (0=no shadow, 1=high shadow)',
                'calculation': 'inverted NIR/Red ratio'
            }
            
            return shadow_index
            
        except Exception as e:
            logger.error(f"Error calculating shadow index: {e}")
            raise
    
    def assess_data_quality(self, dataset: xr.Dataset) -> Dict[str, Union[float, Dict]]:
        """Comprehensive data quality assessment."""
        
        try:
            logger.info("Performing comprehensive data quality assessment")
            
            quality_report = {}
            
            # Basic statistics
            quality_report['total_pixels'] = int(next(iter(dataset.data_vars.values())).size)
            quality_report['total_bands'] = len(dataset.data_vars)
            
            # Cloud coverage
            if 'BQA' in dataset:
                qa_mask = self.create_qa_mask(dataset)
                cloud_pixels = qa_mask.sum().item()
                quality_report['cloud_coverage_percent'] = (cloud_pixels / qa_mask.size) * 100
            else:
                quality_report['cloud_coverage_percent'] = 0.0
            
            # Band-specific quality metrics
            band_stats = {}
            for var_name, data_var in dataset.data_vars.values:
                valid_data = data_var.values[~np.isnan(data_var.values)]
                
                if len(valid_data) > 0:
                    band_stats[var_name] = {
                        'valid_pixels': len(valid_data),
                        'valid_percent': (len(valid_data) / data_var.size) * 100,
                        'mean': float(np.mean(valid_data)),
                        'std': float(np.std(valid_data)),
                        'min': float(np.min(valid_data)),
                        'max': float(np.max(valid_data))
                    }
                else:
                    band_stats[var_name] = {
                        'valid_pixels': 0,
                        'valid_percent': 0.0,
                        'mean': np.nan,
                        'std': np.nan,
                        'min': np.nan,
                        'max': np.nan
                    }
            
            quality_report['band_statistics'] = band_stats
            
            # Overall quality score
            overall_score = 1.0
            overall_score *= (1.0 - quality_report['cloud_coverage_percent'] / 100.0)
            quality_report['overall_quality_score'] = overall_score
            
            # Recommendations
            recommendations = []
            if quality_report['cloud_coverage_percent'] > 30:
                recommendations.append("High cloud coverage - consider alternative acquisition dates")
            if any(stats['valid_percent'] < 90 for stats in band_stats.values()):
                recommendations.append("Some bands have low valid pixel coverage")
            
            quality_report['recommendations'] = recommendations
            
            logger.info(f"Quality assessment completed. Overall score: {overall_score:.2f}")
            return quality_report
            
        except Exception as e:
            logger.error(f"Error in data quality assessment: {e}")
            raise