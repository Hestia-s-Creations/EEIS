"""Confidence scoring system for satellite data processing results."""

import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Optional, Tuple, Union, Any
from datetime import datetime
import warnings
from scipy import stats
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from ..config import Settings


logger = logging.getLogger(__name__)


class ConfidenceScorer:
    """Confidence scoring for satellite data processing results."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
    
    def calculate_confidence_scores(self, 
                                  result_data: Union[xr.Dataset, Dict, List],
                                  confidence_type: str = "composite") -> Union[xr.DataArray, Dict]:
        """Calculate confidence scores for processing results."""
        
        try:
            logger.info(f"Calculating confidence scores for type: {confidence_type}")
            
            if confidence_type == "composite":
                return self._calculate_composite_confidence(result_data)
            elif confidence_type == "change_detection":
                return self._calculate_change_confidence(result_data)
            elif confidence_type == "time_series":
                return self._calculate_time_series_confidence(result_data)
            elif confidence_type == "spectral_indices":
                return self._calculate_spectral_confidence(result_data)
            else:
                raise ValueError(f"Unknown confidence type: {confidence_type}")
                
        except Exception as e:
            logger.error(f"Error calculating confidence scores: {e}")
            raise
    
    def _calculate_composite_confidence(self, result_data: Union[xr.Dataset, Dict]) -> Dict[str, xr.DataArray]:
        """Calculate composite confidence scores from multiple sources."""
        
        try:
            if isinstance(result_data, xr.Dataset):
                return self._calculate_composite_from_dataset(result_data)
            elif isinstance(result_data, dict):
                return self._calculate_composite_from_dict(result_data)
            else:
                raise ValueError("Unsupported data type for composite confidence")
                
        except Exception as e:
            logger.error(f"Error in composite confidence calculation: {e}")
            raise
    
    def _calculate_composite_from_dataset(self, dataset: xr.Dataset) -> Dict[str, xr.DataArray]:
        """Calculate confidence scores from xarray dataset."""
        
        try:
            confidence_maps = {}
            
            # Extract reference data
            ref_var = next(iter(dataset.data_vars.values()))
            shape = ref_var.shape
            coords = ref_var.coords
            
            # Initialize confidence components
            data_quality_confidence = xr.ones_like(ref_var, dtype=float)
            spectral_consistency_confidence = xr.ones_like(ref_var, dtype=float)
            temporal_consistency_confidence = xr.ones_like(ref_var, dtype=float)
            statistical_confidence = xr.ones_like(ref_var, dtype=float)
            
            # 1. Data Quality Confidence
            if 'BQA' in dataset:
                qa_confidence = self._assess_qa_confidence(dataset['BQA'])
                data_quality_confidence = xr.where(qa_confidence, data_quality_confidence, 0.5)
            
            # 2. Spectral Consistency Confidence
            if len(dataset.data_vars) >= 3:
                spectral_conf = self._assess_spectral_consistency(dataset)
                spectral_consistency_confidence = spectral_conf
            
            # 3. Statistical Confidence
            for var_name, data_var in dataset.data_vars.items():
                if var_name not in ['BQA']:
                    # Check for reasonable value ranges
                    valid_range_confidence = self._assess_value_ranges(data_var)
                    statistical_confidence = xr.where(
                        valid_range_confidence < 0.5,
                        valid_range_confidence,
                        statistical_confidence * valid_range_confidence
                    )
            
            # 4. Temporal Consistency (if time dimension exists)
            if 'time' in coords:
                temporal_conf = self._assess_temporal_consistency(dataset)
                temporal_consistency_confidence = temporal_conf
            
            # Combine confidence components
            composite_confidence = (
                data_quality_confidence * 0.3 +
                spectral_consistency_confidence * 0.25 +
                statistical_confidence * 0.25 +
                temporal_consistency_confidence * 0.2
            )
            
            # Calculate confidence categories
            high_confidence = composite_confidence >= 0.8
            medium_confidence = (composite_confidence >= 0.6) & (composite_confidence < 0.8)
            low_confidence = composite_confidence < 0.6
            
            confidence_maps = {
                'composite_confidence': composite_confidence,
                'data_quality_confidence': data_quality_confidence,
                'spectral_consistency_confidence': spectral_consistency_confidence,
                'statistical_confidence': statistical_confidence,
                'temporal_consistency_confidence': temporal_consistency_confidence,
                'high_confidence_mask': high_confidence,
                'medium_confidence_mask': medium_confidence,
                'low_confidence_mask': low_confidence
            }
            
            # Add metadata
            for name, data in confidence_maps.items():
                data.attrs = {
                    'description': f'{name.replace("_", " ").title()}',
                    'calculation_method': 'composite_scoring',
                    'components': ['data_quality', 'spectral_consistency', 'statistical', 'temporal'] if name == 'composite_confidence' else None
                }
            
            return confidence_maps
            
        except Exception as e:
            logger.error(f"Error calculating composite confidence from dataset: {e}")
            raise
    
    def _calculate_composite_from_dict(self, data_dict: Dict) -> Dict[str, Any]:
        """Calculate confidence scores from dictionary data."""
        
        try:
            # For dictionary data, calculate overall confidence
            confidence_scores = []
            weights = []
            
            for key, value in data_dict.items():
                if isinstance(value, (int, float)):
                    confidence_scores.append(value)
                    weights.append(1.0)
                elif isinstance(value, dict) and 'confidence' in value:
                    confidence_scores.append(value['confidence'])
                    weights.append(value.get('weight', 1.0))
            
            if confidence_scores:
                # Weighted average confidence
                weights_array = np.array(weights)
                weights_normalized = weights_array / weights_array.sum()
                overall_confidence = np.average(confidence_scores, weights=weights_normalized)
                
                return {
                    'overall_confidence': overall_confidence,
                    'individual_confidences': confidence_scores,
                    'component_weights': weights_normalized.tolist(),
                    'confidence_breakdown': data_dict
                }
            else:
                return {
                    'overall_confidence': 0.5,
                    'error': 'No confidence data found in input'
                }
                
        except Exception as e:
            logger.error(f"Error calculating composite confidence from dict: {e}")
            raise
    
    def _calculate_change_confidence(self, change_results: Dict) -> Dict[str, xr.DataArray]:
        """Calculate confidence scores for change detection results."""
        
        try:
            confidence_maps = {}
            
            # Extract change data
            if 'individual_changes' in change_results:
                for index_name, change_data in change_results['individual_changes'].items():
                    if 'change_magnitude' in change_data:
                        # Calculate confidence based on change magnitude
                        change_magnitude = change_data['change_magnitude']
                        change_stats = change_data['change_statistics']
                        
                        # Confidence based on magnitude relative to threshold
                        threshold = change_stats['threshold']
                        magnitude_confidence = xr.where(
                            np.abs(change_magnitude) > threshold * 2,
                            1.0,
                            np.abs(change_magnitude) / (threshold * 2)
                        )
                        
                        # Confidence based on change persistence (if available)
                        persistence_confidence = self._calculate_change_persistence(change_data)
                        
                        # Combine confidences
                        index_confidence = magnitude_confidence * 0.7 + persistence_confidence * 0.3
                        
                        confidence_maps[f'{index_name}_change_confidence'] = index_confidence
                        confidence_maps[f'{index_name}_magnitude_confidence'] = magnitude_confidence
                        confidence_maps[f'{index_name}_persistence_confidence'] = persistence_confidence
            
            # Combined change confidence
            if confidence_maps:
                all_confidences = [v for v in confidence_maps.values() if 'magnitude_confidence' in v.name]
                if all_confidences:
                    combined_change_confidence = xr.concat(all_confidences, dim='variable').mean('variable')
                    confidence_maps['combined_change_confidence'] = combined_change_confidence
            
            return confidence_maps
            
        except Exception as e:
            logger.error(f"Error calculating change confidence: {e}")
            raise
    
    def _calculate_time_series_confidence(self, time_series_results: Dict) -> Dict[str, Any]:
        """Calculate confidence scores for time series analysis."""
        
        try:
            confidence_summary = {
                'overall_time_series_confidence': 0.5,
                'component_confidences': {},
                'quality_indicators': {}
            }
            
            # Analyze different methods
            if 'change_analysis' in time_series_results:
                change_analysis = time_series_results['change_analysis']
                
                # Trend analysis confidence
                if 'trend_analysis' in change_analysis:
                    trends = change_analysis['trend_analysis'].get('trends', {})
                    trend_confidence = self._assess_trend_confidence(trends)
                    confidence_summary['component_confidences']['trend_analysis'] = trend_confidence
                
                # Anomaly detection confidence
                if 'anomaly_detection' in change_analysis:
                    anomalies = change_analysis['anomaly_detection'].get('anomalies', {})
                    anomaly_confidence = self._assess_anomaly_confidence(anomalies)
                    confidence_summary['component_confidences']['anomaly_detection'] = anomaly_confidence
                
                # Regime shift confidence
                if 'regime_shift' in change_analysis:
                    shifts = change_analysis['regime_shift'].get('regime_shifts', {})
                    shift_confidence = self._assess_regime_shift_confidence(shifts)
                    confidence_summary['component_confidences']['regime_shift'] = shift_confidence
            
            # Calculate overall time series confidence
            component_confidences = list(confidence_summary['component_confidences'].values())
            if component_confidences:
                confidence_summary['overall_time_series_confidence'] = np.mean(component_confidences)
            
            # Add quality indicators
            if 'time_period' in time_series_results:
                time_info = time_series_results['time_period']
                confidence_summary['quality_indicators'] = {
                    'temporal_coverage': self._assess_temporal_coverage(time_info),
                    'data_density': self._assess_data_density(time_info)
                }
            
            return confidence_summary
            
        except Exception as e:
            logger.error(f"Error calculating time series confidence: {e}")
            raise
    
    def _calculate_spectral_confidence(self, spectral_results: Union[xr.Dataset, Dict]) -> Dict[str, Any]:
        """Calculate confidence scores for spectral analysis."""
        
        try:
            if isinstance(spectral_results, xr.Dataset):
                return self._assess_spectral_dataset_confidence(spectral_results)
            elif isinstance(spectral_results, dict):
                return self._assess_spectral_dict_confidence(spectral_results)
            else:
                return {'spectral_confidence': 0.5, 'error': 'Unsupported data type'}
                
        except Exception as e:
            logger.error(f"Error calculating spectral confidence: {e}")
            raise
    
    def _assess_qa_confidence(self, qa_data: xr.DataArray) -> xr.DataArray:
        """Assess confidence based on quality assurance bands."""
        
        try:
            qa_values = qa_data.values
            
            # Initialize confidence map
            confidence = np.ones_like(qa_values, dtype=float)
            
            # High quality pixels (no clouds, shadows, snow/ice)
            high_quality = (qa_values & 0b11110000) == 0
            confidence = xr.where(high_quality, 1.0, confidence)
            
            # Medium quality pixels (low confidence clouds/shadows)
            medium_quality = ((qa_values & 0b00001100) > 0) & ((qa_values & 0b00110000) == 0)
            confidence = xr.where(medium_quality, 0.7, confidence)
            
            # Low quality pixels (high confidence clouds/shadows)
            low_quality = (qa_values & 0b00110000) > 0
            confidence = xr.where(low_quality, 0.3, confidence)
            
            return xr.DataArray(
                confidence,
                coords=qa_data.coords,
                dims=qa_data.dims,
                attrs={'description': 'QA-based confidence assessment'}
            )
            
        except Exception as e:
            logger.error(f"Error assessing QA confidence: {e}")
            return xr.ones_like(qa_data)
    
    def _assess_spectral_consistency(self, dataset: xr.Dataset) -> xr.DataArray:
        """Assess spectral consistency across bands."""
        
        try:
            ref_band = next(iter(dataset.data_vars.values()))
            consistency = xr.ones_like(ref_band, dtype=float)
            
            # Check if we have RGB bands
            rgb_bands = ['B2', 'B3', 'B4']  # Blue, Green, Red for Landsat 8
            available_rgb = [band for band in rgb_bands if band in dataset.data_vars]
            
            if len(available_rgb) >= 2:
                # Check spectral order consistency (Green < Red in vegetation)
                if 'B3' in available_rgb and 'B4' in available_rgb:
                    green_red_ratio = dataset['B3'] / (dataset['B4'] + 1e-10)
                    # In vegetation, Green < Red, so ratio should be < 1
                    ratio_consistency = xr.where(
                        (green_red_ratio > 0.3) & (green_red_ratio < 1.2),
                        1.0,
                        0.7
                    )
                    consistency = consistency * ratio_consistency
            
            # Check NIR-Red relationship (NIR should be higher than Red in vegetation)
            if 'B4' in dataset and 'B5' in dataset:
                nir_red_ratio = dataset['B5'] / (dataset['B4'] + 1e-10)
                nir_consistency = xr.where(
                    nir_red_ratio > 0.8,  # NIR should be higher than Red
                    1.0,
                    0.6
                )
                consistency = consistency * nir_consistency
            
            return consistency
            
        except Exception as e:
            logger.warning(f"Error assessing spectral consistency: {e}")
            return xr.ones_like(ref_band)
    
    def _assess_value_ranges(self, data: xr.DataArray) -> xr.DataArray:
        """Assess confidence based on value ranges."""
        
        try:
            values = data.values
            confidence = np.ones_like(values, dtype=float)
            
            # Remove NaN values for statistics
            valid_values = values[~np.isnan(values)]
            
            if len(valid_values) > 0:
                q1, q99 = np.percentile(valid_values, [1, 99])
                
                # Penalize extreme values
                extreme_low = values < q1
                extreme_high = values > q99
                
                confidence = xr.where(extreme_low, 0.6, confidence)
                confidence = xr.where(extreme_high, 0.6, confidence)
                
                # Penalize values outside expected reflectance ranges
                if data.attrs.get('units') == 'reflectance' or 'reflectance' in data.attrs.get('description', ''):
                    reflectance_low = values < 0
                    reflectance_high = values > 1
                    confidence = xr.where(reflectance_low, 0.4, confidence)
                    confidence = xr.where(reflectance_high, 0.4, confidence)
            
            return xr.DataArray(
                confidence,
                coords=data.coords,
                dims=data.dims,
                attrs={'description': 'Value range-based confidence'}
            )
            
        except Exception as e:
            logger.warning(f"Error assessing value ranges: {e}")
            return xr.ones_like(data)
    
    def _assess_temporal_consistency(self, dataset: xr.Dataset) -> xr.DataArray:
        """Assess temporal consistency in time series data."""
        
        try:
            if 'time' not in dataset.coords:
                return xr.ones_like(next(iter(dataset.data_vars.values())))
            
            # Simple consistency check - variance should not be too high
            temporal_var = dataset.var('time')
            
            # Normalize by mean to get coefficient of variation
            temporal_mean = dataset.mean('time')
            cv = temporal_var / (temporal_mean + 1e-10)
            
            # High CV indicates low consistency
            consistency = xr.where(
                cv > 1.0,  # CV > 1 indicates high variability
                0.5,
                xr.where(cv > 0.5, 0.7, 0.9)
            )
            
            return consistency
            
        except Exception as e:
            logger.warning(f"Error assessing temporal consistency: {e}")
            return xr.ones_like(next(iter(dataset.data_vars.values())))
    
    def _calculate_change_persistence(self, change_data: Dict) -> xr.DataArray:
        """Calculate confidence based on change persistence."""
        
        try:
            # This would need additional context about temporal changes
            # For now, return high confidence
            ref_data = change_data['change_magnitude']
            return xr.ones_like(ref_data)
            
        except Exception as e:
            logger.warning(f"Error calculating change persistence: {e}")
            return xr.ones_like(ref_data)
    
    def _assess_trend_confidence(self, trends: Dict) -> float:
        """Assess confidence in trend analysis results."""
        
        try:
            if not trends:
                return 0.5
            
            # Consider the number of indices with significant trends
            significant_trend_count = 0
            total_pixels = 0
            
            for index_name, trend_results in trends.items():
                stats = trend_results['statistics']
                if 'significant_trend_pixels' in stats:
                    significant_trend_count += stats['significant_trend_pixels']
                    total_pixels += stats['total_pixels']
            
            if total_pixels > 0:
                trend_ratio = significant_trend_count / total_pixels
                # Reasonable trend ratio is 0.1 to 0.5
                if 0.1 <= trend_ratio <= 0.5:
                    return 0.8
                elif trend_ratio < 0.1:
                    return 0.6  # Very few trends detected
                else:
                    return 0.7  # Many trends detected, may indicate noise
            
            return 0.5
            
        except Exception as e:
            logger.warning(f"Error assessing trend confidence: {e}")
            return 0.5
    
    def _assess_anomaly_confidence(self, anomalies: Dict) -> float:
        """Assess confidence in anomaly detection results."""
        
        try:
            if not anomalies:
                return 0.5
            
            # Consider the number of persistent anomalies
            total_persistent = 0
            total_pixels = 0
            
            for index_name, anomaly_results in anomalies.items():
                stats = anomaly_results['statistics']
                if 'persistent_anomaly_pixels' in stats:
                    total_persistent += stats['persistent_anomaly_pixels']
                    total_pixels += stats['total_pixels']
            
            if total_pixels > 0:
                anomaly_ratio = total_persistent / total_pixels
                # Reasonable anomaly ratio is 0.02 to 0.15
                if 0.02 <= anomaly_ratio <= 0.15:
                    return 0.8
                elif anomaly_ratio < 0.02:
                    return 0.6  # Very few anomalies
                else:
                    return 0.7  # Many anomalies, may indicate poor data quality
            
            return 0.5
            
        except Exception as e:
            logger.warning(f"Error assessing anomaly confidence: {e}")
            return 0.5
    
    def _assess_regime_shift_confidence(self, shifts: Dict) -> float:
        """Assess confidence in regime shift detection results."""
        
        try:
            if not shifts:
                return 0.5
            
            # Consider the number of pixels with regime shifts
            total_shifted = 0
            total_pixels = 0
            
            for index_name, shift_results in shifts.items():
                stats = shift_results['statistics']
                if 'total_pixels_with_shifts' in stats:
                    total_shifted += stats['total_pixels_with_shifts']
                    total_pixels += stats['total_pixels']
            
            if total_pixels > 0:
                shift_ratio = total_shifted / total_pixels
                # Reasonable shift ratio is 0.05 to 0.25
                if 0.05 <= shift_ratio <= 0.25:
                    return 0.8
                elif shift_ratio < 0.05:
                    return 0.6  # Very few shifts
                else:
                    return 0.7  # Many shifts detected
            
            return 0.5
            
        except Exception as e:
            logger.warning(f"Error assessing regime shift confidence: {e}")
            return 0.5
    
    def _assess_temporal_coverage(self, time_info: Dict) -> float:
        """Assess quality based on temporal coverage."""
        
        try:
            if 'timespan_days' in time_info and 'total_scenes' in time_info:
                timespan = time_info['timespan_days']
                scenes = time_info['total_scenes']
                
                # Ideal: at least 5 years with regular coverage
                ideal_years = 5 * 365
                ideal_scenes_per_year = 12  # Monthly coverage
                ideal_scenes = ideal_years * ideal_scenes_per_year / 365
                
                # Score based on coverage density
                coverage_density = scenes / (timespan / 365) if timespan > 0 else 0
                density_score = min(1.0, coverage_density / ideal_scenes)
                
                # Score based on timespan
                timespan_score = min(1.0, timespan / ideal_years)
                
                # Overall score
                overall_score = (density_score * 0.6 + timespan_score * 0.4)
                return overall_score
            
            return 0.5
            
        except Exception as e:
            logger.warning(f"Error assessing temporal coverage: {e}")
            return 0.5
    
    def _assess_data_density(self, time_info: Dict) -> float:
        """Assess quality based on data density."""
        
        try:
            if 'total_scenes' in time_info:
                scenes = time_info['total_scenes']
                
                # Ideal density depends on sensor
                # Landsat: ~12-16 scenes per year
                # Sentinel-2: ~50-100 scenes per year
                
                if scenes >= 100:  # Likely Sentinel-2
                    return 0.9
                elif scenes >= 50:  # Good coverage
                    return 0.8
                elif scenes >= 20:  # Moderate coverage
                    return 0.7
                elif scenes >= 10:  # Minimal coverage
                    return 0.6
                else:
                    return 0.4  # Poor coverage
            
            return 0.5
            
        except Exception as e:
            logger.warning(f"Error assessing data density: {e}")
            return 0.5
    
    def _assess_spectral_dataset_confidence(self, dataset: xr.Dataset) -> Dict[str, Any]:
        """Assess confidence of spectral dataset."""
        
        try:
            confidence_scores = {}
            
            for var_name, data_var in dataset.data_vars.items():
                # Check data completeness
                valid_ratio = (~np.isnan(data_var.values)).mean()
                
                # Check value ranges
                valid_values = data_var.values[~np.isnan(data_var.values)]
                if len(valid_values) > 0:
                    value_range_score = 1.0 if 0 <= np.min(valid_values) <= np.max(valid_values) <= 1 else 0.7
                else:
                    value_range_score = 0.0
                
                # Overall score for this variable
                var_confidence = valid_ratio * value_range_score
                confidence_scores[var_name] = var_confidence
            
            # Overall dataset confidence
            if confidence_scores:
                overall_confidence = np.mean(list(confidence_scores.values()))
            else:
                overall_confidence = 0.0
            
            return {
                'overall_spectral_confidence': overall_confidence,
                'variable_confidences': confidence_scores,
                'quality_assessment': {
                    'data_completeness': np.mean([v for v in confidence_scores.values()]),
                    'spectral_consistency': self._calculate_spectral_dataset_consistency(dataset)
                }
            }
            
        except Exception as e:
            logger.error(f"Error assessing spectral dataset confidence: {e}")
            raise
    
    def _calculate_spectral_dataset_consistency(self, dataset: xr.Dataset) -> float:
        """Calculate overall spectral consistency of dataset."""
        
        try:
            if len(dataset.data_vars) < 3:
                return 0.5
            
            # Check basic spectral relationships
            consistency_checks = 0
            total_checks = 0
            
            # Check Red < NIR (vegetated pixels)
            if 'B4' in dataset and 'B5' in dataset:
                nir_red_ratio = (dataset['B5'] / (dataset['B4'] + 1e-10)).mean().item()
                if nir_red_ratio > 1.0:  # NIR should generally be higher than Red
                    consistency_checks += 1
                total_checks += 1
            
            # Check Green < Red (typical for vegetation)
            if 'B3' in dataset and 'B4' in dataset:
                green_red_ratio = (dataset['B3'] / (dataset['B4'] + 1e-10)).mean().item()
                if 0.3 <= green_red_ratio <= 1.0:  # Reasonable ratio
                    consistency_checks += 1
                total_checks += 1
            
            if total_checks > 0:
                return consistency_checks / total_checks
            else:
                return 0.5
            
        except Exception as e:
            logger.warning(f"Error calculating spectral consistency: {e}")
            return 0.5
    
    def _assess_spectral_dict_confidence(self, spectral_dict: Dict) -> Dict[str, Any]:
        """Assess confidence of spectral analysis results in dictionary format."""
        
        try:
            confidence_summary = {
                'overall_confidence': 0.5,
                'analysis_quality': {},
                'recommendations': []
            }
            
            # Assess each index
            index_confidences = {}
            for index_name, index_data in spectral_dict.items():
                if isinstance(index_data, xr.DataArray):
                    valid_ratio = (~np.isnan(index_data.values)).mean()
                    index_confidences[index_name] = valid_ratio
                elif isinstance(index_data, (int, float)):
                    index_confidences[index_name] = index_data
            
            if index_confidences:
                confidence_summary['overall_confidence'] = np.mean(list(index_confidences.values()))
                confidence_summary['index_confidences'] = index_confidences
            
            # Add quality assessment
            if any(conf < 0.7 for conf in index_confidences.values()):
                confidence_summary['recommendations'].append("Some indices have low confidence - consider data quality review")
            
            if len(index_confidences) < 3:
                confidence_summary['recommendations'].append("Limited number of indices - consider adding more spectral measures")
            
            return confidence_summary
            
        except Exception as e:
            logger.error(f"Error assessing spectral dict confidence: {e}")
            raise