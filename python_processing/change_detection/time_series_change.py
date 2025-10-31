"""Time series change detection for analyzing changes over time."""

import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
import warnings
from scipy import signal, stats
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

from ..config import Settings


logger = logging.getLogger(__name__)


class TimeSeriesChangeDetector:
    """Time series based change detection methods."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
    
    def analyze_time_series_changes(self, 
                                  time_series_dataset: xr.Dataset,
                                  indices: List[str] = None,
                                  change_methods: List[str] = None) -> Dict:
        """Comprehensive time series change analysis."""
        
        try:
            logger.info("Analyzing time series changes")
            
            if 'time' not in time_series_dataset.coords:
                raise ValueError("Time coordinate not found in dataset")
            
            if indices is None:
                indices = ['NDVI', 'NBR', 'TCG']
            
            if change_methods is None:
                change_methods = ['trend_analysis', 'anomaly_detection', 'regime_shift']
            
            results = {
                'time_period': {
                    'start': str(time_series_dataset.time.values[0]),
                    'end': str(time_series_dataset.time.values[-1]),
                    'total_scenes': len(time_series_dataset.time),
                    'timespan_days': self._calculate_timespan_days(time_series_dataset.time.values)
                },
                'change_analysis': {}
            }
            
            for method in change_methods:
                try:
                    if method == 'trend_analysis':
                        method_results = self._analyze_trends(time_series_dataset, indices)
                    elif method == 'anomaly_detection':
                        method_results = self._detect_anomalies(time_series_dataset, indices)
                    elif method == 'regime_shift':
                        method_results = self._detect_regime_shifts(time_series_dataset, indices)
                    else:
                        logger.warning(f"Unknown change method: {method}")
                        continue
                    
                    results['change_analysis'][method] = method_results
                    
                except Exception as e:
                    logger.warning(f"Error in {method}: {e}")
                    results['change_analysis'][method] = {'error': str(e)}
            
            # Overall summary
            results['summary'] = self._create_time_series_summary(results['change_analysis'])
            
            return results
            
        except Exception as e:
            logger.error(f"Error in time series change analysis: {e}")
            raise
    
    def _analyze_trends(self, time_series_dataset: xr.Dataset, indices: List[str]) -> Dict:
        """Analyze long-term trends in time series data."""
        
        try:
            logger.info("Analyzing long-term trends")
            
            trend_results = {}
            time_numeric = np.arange(len(time_series_dataset.time))
            
            for index_name in indices:
                if index_name not in time_series_dataset.data_vars:
                    continue
                
                try:
                    index_data = time_series_dataset[index_name]
                    trend_slope = np.full(index_data.shape[1:], np.nan)
                    trend_intercept = np.full(index_data.shape[1:], np.nan)
                    trend_r_value = np.full(index_data.shape[1:], np.nan)
                    trend_p_value = np.full(index_data.shape[1:], np.nan)
                    trend_std_err = np.full(index_data.shape[1:], np.nan)
                    
                    # Process each pixel
                    for i in range(index_data.shape[1]):
                        for j in range(index_data.shape[2]):
                            pixel_series = index_data[:, i, j].values
                            valid_mask = ~np.isnan(pixel_series)
                            
                            if valid_mask.sum() >= 3:  # Need at least 3 points
                                try:
                                    slope, intercept, r_value, p_value, std_err = stats.linregress(
                                        time_numeric[valid_mask], pixel_series[valid_mask]
                                    )
                                    
                                    trend_slope[i, j] = slope
                                    trend_intercept[i, j] = intercept
                                    trend_r_value[i, j] = r_value
                                    trend_p_value[i, j] = p_value
                                    trend_std_err[i, j] = std_err
                                    
                                except Exception:
                                    continue
                    
                    # Create trend datasets
                    trend_data_vars = {
                        f'{index_name}_slope': (['y', 'x'], trend_slope),
                        f'{index_name}_intercept': (['y', 'x'], trend_intercept),
                        f'{index_name}_r_value': (['y', 'x'], trend_r_value),
                        f'{index_name}_p_value': (['y', 'x'], trend_p_value),
                        f'{index_name}_std_err': (['y', 'x'], trend_std_err)
                    }
                    
                    # Create trend classification
                    significant_trend = (np.abs(trend_p_value) < 0.05) & (np.abs(trend_slope) > 0.001)
                    positive_trend = significant_trend & (trend_slope > 0)
                    negative_trend = significant_trend & (trend_slope < 0)
                    
                    trend_classification = xr.DataArray(
                        np.zeros_like(trend_slope, dtype=int),
                        dims=['y', 'x'],
                        coords={'y': index_data.y, 'x': index_data.x}
                    )
                    trend_classification = xr.where(positive_trend, 1, trend_classification)  # Increasing
                    trend_classification = xr.where(negative_trend, -1, trend_classification)  # Decreasing
                    
                    trend_results[index_name] = {
                        'trend_datasets': xr.Dataset(trend_data_vars, 
                                                   coords=index_data.coords),
                        'trend_classification': trend_classification,
                        'statistics': {
                            'total_pixels': int((~np.isnan(trend_slope)).sum()),
                            'significant_trend_pixels': int(significant_trend.sum()),
                            'positive_trend_pixels': int(positive_trend.sum()),
                            'negative_trend_pixels': int(negative_trend.sum()),
                            'significant_trend_percentage': float(significant_trend.mean() * 100),
                            'mean_slope': float(np.nanmean(trend_slope)),
                            'median_r_value': float(np.nanmedian(np.abs(trend_r_value)))
                        }
                    }
                    
                except Exception as e:
                    logger.warning(f"Error analyzing trend for {index_name}: {e}")
                    continue
            
            return {
                'trends': trend_results,
                'summary': self._summarize_trends(trend_results)
            }
            
        except Exception as e:
            logger.error(f"Error in trend analysis: {e}")
            raise
    
    def _detect_anomalies(self, time_series_dataset: xr.Dataset, indices: List[str]) -> Dict:
        """Detect anomalies in time series data."""
        
        try:
            logger.info("Detecting anomalies in time series")
            
            anomaly_results = {}
            
            for index_name in indices:
                if index_name not in time_series_dataset.data_vars:
                    continue
                
                try:
                    index_data = time_series_dataset[index_name]
                    
                    # Calculate baseline statistics (excluding recent years)
                    baseline_period = slice(None, -5)  # Last 5 years for comparison
                    baseline_data = index_data.isel(time=baseline_period)
                    
                    # Calculate baseline mean and std
                    baseline_mean = baseline_data.mean('time')
                    baseline_std = baseline_data.std('time')
                    
                    # Detect anomalies for each time step
                    anomaly_maps = {}
                    anomaly_scores = {}
                    
                    for t_idx in range(len(index_data.time)):
                        current_data = index_data.isel(time=t_idx)
                        
                        # Z-score based anomaly detection
                        z_scores = (current_data - baseline_mean) / (baseline_std + 1e-10)
                        
                        # Threshold for anomalies
                        anomaly_threshold = 2.0  # 2 standard deviations
                        anomalies = np.abs(z_scores) > anomaly_threshold
                        
                        anomaly_maps[f'time_{t_idx}'] = anomalies
                        anomaly_scores[f'time_{t_idx}'] = np.abs(z_scores)
                    
                    # Calculate anomaly frequency per pixel
                    all_anomaly_maps = [anomaly_maps[key] for key in sorted(anomaly_maps.keys())]
                    anomaly_frequency = xr.concat(all_anomaly_maps, dim='time').sum('time')
                    
                    # Identify persistent anomaly pixels
                    max_anomalies = len(anomaly_maps)
                    persistent_threshold = max(0.3 * max_anomalies, 1)  # At least 30% or 1 anomaly
                    persistent_anomalies = anomaly_frequency >= persistent_threshold
                    
                    anomaly_results[index_name] = {
                        'anomaly_maps': anomaly_maps,
                        'anomaly_scores': anomaly_scores,
                        'anomaly_frequency': anomaly_frequency,
                        'persistent_anomalies': persistent_anomalies,
                        'baseline_statistics': {
                            'baseline_mean': baseline_mean,
                            'baseline_std': baseline_std
                        },
                        'statistics': {
                            'max_anomaly_count': max_anomalies,
                            'persistent_anomaly_pixels': int(persistent_anomalies.sum()),
                            'persistent_anomaly_percentage': float(persistent_anomalies.mean() * 100),
                            'avg_anomaly_count_per_pixel': float(anomaly_frequency.mean()),
                            'anomaly_threshold': anomaly_threshold
                        }
                    }
                    
                except Exception as e:
                    logger.warning(f"Error detecting anomalies for {index_name}: {e}")
                    continue
            
            return {
                'anomalies': anomaly_results,
                'summary': self._summarize_anomalies(anomaly_results)
            }
            
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")
            raise
    
    def _detect_regime_shifts(self, time_series_dataset: xr.Dataset, indices: List[str]) -> Dict:
        """Detect regime shifts in time series data."""
        
        try:
            logger.info("Detecting regime shifts")
            
            regime_shift_results = {}
            
            for index_name in indices:
                if index_name not in time_series_dataset.data_vars:
                    continue
                
                try:
                    index_data = time_series_dataset[index_name]
                    
                    # Use cumulative sum (CUSUM) method for regime shift detection
                    regime_shifts = []
                    
                    for i in range(index_data.shape[1]):
                        for j in range(index_data.shape[2]):
                            pixel_series = index_data[:, i, j].values
                            valid_mask = ~np.isnan(pixel_series)
                            
                            if valid_mask.sum() >= 10:  # Need enough data points
                                try:
                                    shifts = self._detect_cusum_shifts(pixel_series[valid_mask])
                                    if shifts:
                                        regime_shifts.append({
                                            'y_idx': i,
                                            'x_idx': j,
                                            'shift_times': shifts,
                                            'original_series': pixel_series
                                        })
                                except Exception:
                                    continue
                    
                    # Create regime shift maps
                    shift_frequency_map = np.zeros((index_data.shape[1], index_data.shape[2]))
                    major_shift_map = np.zeros((index_data.shape[1], index_data.shape[2]))
                    
                    for shift_info in regime_shifts:
                        i, j = shift_info['y_idx'], shift_info['x_idx']
                        shift_count = len(shift_info['shift_times'])
                        shift_frequency_map[i, j] = shift_count
                        
                        # Mark major shifts (>1 standard deviation change)
                        if shift_count > 0:
                            major_shift_map[i, j] = 1
                    
                    regime_shift_results[index_name] = {
                        'regime_shifts': regime_shifts,
                        'shift_frequency_map': xr.DataArray(
                            shift_frequency_map,
                            dims=['y', 'x'],
                            coords={'y': index_data.y, 'x': index_data.x}
                        ),
                        'major_shift_map': xr.DataArray(
                            major_shift_map,
                            dims=['y', 'x'],
                            coords={'y': index_data.y, 'x': index_data.x}
                        ),
                        'statistics': {
                            'total_pixels_with_shifts': len(regime_shifts),
                            'total_pixels': index_data.shape[1] * index_data.shape[2],
                            'shift_percentage': len(regime_shifts) / (index_data.shape[1] * index_data.shape[2]) * 100,
                            'average_shifts_per_pixel': np.mean(shift_frequency_map[shift_frequency_map > 0]) if np.any(shift_frequency_map > 0) else 0
                        }
                    }
                    
                except Exception as e:
                    logger.warning(f"Error detecting regime shifts for {index_name}: {e}")
                    continue
            
            return {
                'regime_shifts': regime_shift_results,
                'summary': self._summarize_regime_shifts(regime_shift_results)
            }
            
        except Exception as e:
            logger.error(f"Error in regime shift detection: {e}")
            raise
    
    def _detect_cusum_shifts(self, time_series: np.ndarray, threshold: float = 2.0) -> List[int]:
        """Detect regime shifts using cumulative sum (CUSUM) method."""
        
        try:
            if len(time_series) < 10:
                return []
            
            # Standardize the time series
            mean_val = np.mean(time_series)
            std_val = np.std(time_series)
            
            if std_val == 0:
                return []
            
            standardized_series = (time_series - mean_val) / std_val
            
            # Calculate cumulative sum
            cusum_pos = np.zeros(len(standardized_series))
            cusum_neg = np.zeros(len(standardized_series))
            
            for i in range(1, len(standardized_series)):
                cusum_pos[i] = max(0, cusum_pos[i-1] + standardized_series[i] - 0.5)
                cusum_neg[i] = max(0, cusum_neg[i-1] - standardized_series[i] - 0.5)
            
            # Detect shifts
            shifts = []
            
            # Positive shifts
            for i in range(1, len(cusum_pos)):
                if cusum_pos[i] > threshold:
                    shifts.append(i)
                    cusum_pos[i:] = 0  # Reset after detected shift
            
            # Negative shifts
            for i in range(1, len(cusum_neg)):
                if cusum_neg[i] > threshold:
                    shifts.append(i)
                    cusum_neg[i:] = 0  # Reset after detected shift
            
            return sorted(shifts)
            
        except Exception as e:
            logger.warning(f"Error in CUSUM shift detection: {e}")
            return []
    
    def _calculate_timespan_days(self, time_values: np.ndarray) -> int:
        """Calculate total timespan in days."""
        
        try:
            start_time = datetime.fromisoformat(str(time_values[0]).replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(str(time_values[-1]).replace('Z', '+00:00'))
            return (end_time - start_time).days
            
        except Exception:
            return 0
    
    def _summarize_trends(self, trend_results: Dict) -> Dict:
        """Summarize trend analysis results."""
        
        try:
            summary = {
                'indices_analyzed': len(trend_results),
                'total_significant_trends': 0,
                'positive_vs_negative': {'positive': 0, 'negative': 0},
                'strongest_trend': None,
                'strongest_trend_magnitude': 0
            }
            
            max_slope = 0
            strongest_index = None
            
            for index_name, results in trend_results.items():
                stats = results['statistics']
                summary['total_significant_trends'] += stats['significant_trend_pixels']
                summary['positive_vs_negative']['positive'] += stats['positive_trend_pixels']
                summary['positive_vs_negative']['negative'] += stats['negative_trend_pixels']
                
                if abs(stats['mean_slope']) > abs(max_slope):
                    max_slope = stats['mean_slope']
                    strongest_index = index_name
            
            summary['strongest_trend'] = strongest_index
            summary['strongest_trend_magnitude'] = max_slope
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing trends: {e}")
            return {}
    
    def _summarize_anomalies(self, anomaly_results: Dict) -> Dict:
        """Summarize anomaly detection results."""
        
        try:
            summary = {
                'indices_analyzed': len(anomaly_results),
                'total_persistent_anomalies': 0,
                'most_anomalous_index': None,
                'highest_anomaly_percentage': 0
            }
            
            max_anomalies = 0
            most_anomalous = None
            
            for index_name, results in anomaly_results.items():
                stats = results['statistics']
                summary['total_persistent_anomalies'] += stats['persistent_anomaly_pixels']
                
                if stats['persistent_anomaly_percentage'] > summary['highest_anomaly_percentage']:
                    summary['highest_anomaly_percentage'] = stats['persistent_anomaly_percentage']
                    most_anomalous = index_name
            
            summary['most_anomalous_index'] = most_anomalous
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing anomalies: {e}")
            return {}
    
    def _summarize_regime_shifts(self, regime_shift_results: Dict) -> Dict:
        """Summarize regime shift detection results."""
        
        try:
            summary = {
                'indices_analyzed': len(regime_shift_results),
                'total_shifted_pixels': 0,
                'total_pixels': 0,
                'most_unstable_index': None,
                'highest_shift_percentage': 0
            }
            
            max_shifts = 0
            most_unstable = None
            
            for index_name, results in regime_shift_results.items():
                stats = results['statistics']
                summary['total_shifted_pixels'] += stats['total_pixels_with_shifts']
                summary['total_pixels'] += stats['total_pixels']
                
                if stats['shift_percentage'] > summary['highest_shift_percentage']:
                    summary['highest_shift_percentage'] = stats['shift_percentage']
                    most_unstable = index_name
            
            summary['most_unstable_index'] = most_unstable
            
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing regime shifts: {e}")
            return {}
    
    def _create_time_series_summary(self, change_analysis: Dict) -> Dict:
        """Create overall summary of time series analysis."""
        
        try:
            summary = {
                'methods_applied': list(change_analysis.keys()),
                'key_findings': [],
                'overall_change_indicators': {}
            }
            
            # Analyze trends
            if 'trend_analysis' in change_analysis:
                trends = change_analysis['trend_analysis'].get('summary', {})
                if trends.get('total_significant_trends', 0) > 0:
                    summary['key_findings'].append(
                        f"Detected {trends['total_significant_trends']} pixels with significant trends"
                    )
            
            # Analyze anomalies
            if 'anomaly_detection' in change_analysis:
                anomalies = change_analysis['anomaly_detection'].get('summary', {})
                if anomalies.get('total_persistent_anomalies', 0) > 0:
                    summary['key_findings'].append(
                        f"Found {anomalies['total_persistent_anomalies']} pixels with persistent anomalies"
                    )
            
            # Analyze regime shifts
            if 'regime_shift' in change_analysis:
                shifts = change_analysis['regime_shift'].get('summary', {})
                if shifts.get('total_shifted_pixels', 0) > 0:
                    summary['key_findings'].append(
                        f"Detected regime shifts in {shifts['total_shifted_pixels']} pixels"
                    )
            
            return summary
            
        except Exception as e:
            logger.error(f"Error creating time series summary: {e}")
            return {}