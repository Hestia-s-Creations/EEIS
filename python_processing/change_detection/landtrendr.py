"""Simplified LandTrendr change detection algorithm."""

import logging
import numpy as np
import xarray as xr
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime
import warnings
from scipy import signal
from sklearn.preprocessing import StandardScaler

from ..config import Settings


logger = logging.getLogger(__name__)


class LandTrendrProcessor:
    """Simplified LandTrendr implementation for change detection."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.min_segments = settings.LANDTRENDR_MIN_SEGMENTS
        self.max_segments = settings.LANDTRENDR_MAX_SEGMENTS
    
    def fit_landtrendr(self,
                      time_series_data: xr.Dataset,
                      index_name: str = "NDVI",
                      max_segments: Optional[int] = None,
                      min_segments: Optional[int] = None) -> Dict:
        """Fit LandTrendr model to time series data."""
        
        try:
            logger.info(f"Fitting LandTrendr model for {index_name}")
            
            max_segments = max_segments or self.max_segments
            min_segments = min_segments or self.min_segments
            
            # Extract time series for the specified index
            if index_name not in time_series_data.data_vars:
                raise ValueError(f"Index {index_name} not found in time series data")
            
            index_data = time_series_data[index_name]
            
            # Get time coordinates
            if 'time' not in index_data.coords:
                raise ValueError("Time coordinate not found in data")
            
            time_coords = index_data.time.values
            time_numeric = np.array([self._datetime_to_numeric(t) for t in time_coords])
            
            # Prepare results
            fitted_model = {
                'index_name': index_name,
                'time_coords': time_coords,
                'time_numeric': time_numeric,
                'fitted_values': np.full(index_data.shape, np.nan),
                'segment_info': [],
                'fitted_dataset': None,
                'model_quality': {},
                'parameters': {
                    'max_segments': max_segments,
                    'min_segments': min_segments
                }
            }
            
            # Process each pixel location independently
            data_shape = index_data.shape
            fitted_values = np.full(data_shape, np.nan)
            
            # Flatten spatial dimensions for processing
            original_shape = data_shape[1:]  # Remove time dimension
            flat_data = index_data.values.reshape(len(time_coords), -1)
            
            valid_pixels = 0
            processed_pixels = 0
            
            for pixel_idx in range(flat_data.shape[1]):
                pixel_series = flat_data[:, pixel_idx]
                
                # Skip pixels with too many missing values
                valid_ratio = (~np.isnan(pixel_series)).sum() / len(pixel_series)
                if valid_ratio < 0.5:  # Less than 50% valid data
                    continue
                
                try:
                    # Fit piecewise linear model
                    segment_result = self._fit_piecewise_linear(
                        time_numeric, pixel_series, max_segments, min_segments
                    )
                    
                    if segment_result is not None:
                        fitted_values[:, pixel_idx] = segment_result['fitted']
                        fitted_model['segment_info'].append({
                            'pixel_index': pixel_idx,
                            'segments': segment_result['segments'],
                            'rmse': segment_result['rmse']
                        })
                        valid_pixels += 1
                    
                    processed_pixels += 1
                    
                    if processed_pixels % 1000 == 0:
                        logger.info(f"Processed {processed_pixels} pixels, {valid_pixels} valid")
                        
                except Exception as e:
                    logger.warning(f"Error processing pixel {pixel_idx}: {e}")
                    continue
            
            # Reshape fitted values back to spatial dimensions
            fitted_values = fitted_values.reshape(len(time_coords), *original_shape)
            
            # Create fitted dataset
            fitted_dataset = xr.Dataset({
                f'{index_name}_fitted': (['time', 'y', 'x'], fitted_values),
                f'{index_name}_residual': (['time', 'y', 'x'], 
                                         index_data.values - fitted_values)
            }, coords=index_data.coords)
            
            fitted_model['fitted_values'] = fitted_values
            fitted_model['fitted_dataset'] = fitted_dataset
            
            # Calculate model quality metrics
            fitted_model['model_quality'] = self._calculate_model_quality(
                index_data.values, fitted_values, valid_pixels, processed_pixels
            )
            
            logger.info(f"LandTrendr fitting completed. Valid pixels: {valid_pixels}/{processed_pixels}")
            return fitted_model
            
        except Exception as e:
            logger.error(f"Error in LandTrendr fitting: {e}")
            raise
    
    def _fit_piecewise_linear(self,
                            time_coords: np.ndarray,
                            values: np.ndarray,
                            max_segments: int,
                            min_segments: int) -> Optional[Dict]:
        """Fit piecewise linear segments to time series."""
        
        try:
            # Remove NaN values
            valid_mask = ~np.isnan(values)
            if valid_mask.sum() < 3:  # Need at least 3 points
                return None
            
            time_valid = time_coords[valid_mask]
            values_valid = values[valid_mask]
            
            # Sort by time
            sort_idx = np.argsort(time_valid)
            time_sorted = time_valid[sort_idx]
            values_sorted = values_valid[sort_idx]
            
            # Simple iterative segmentation approach
            segments = []
            current_time = time_sorted.copy()
            current_values = values_sorted.copy()
            
            while len(segments) < max_segments and len(current_time) >= 3:
                # Fit linear regression to current segment
                coefficients = np.polyfit(current_time, current_values, 1)
                
                # Calculate residuals
                predicted = np.polyval(coefficients, current_time)
                residuals = np.abs(current_values - predicted)
                rmse = np.sqrt(np.mean(residuals**2))
                
                # Store segment information
                segments.append({
                    'start_time': current_time[0],
                    'end_time': current_time[-1],
                    'start_value': current_values[0],
                    'end_value': current_values[-1],
                    'slope': coefficients[0],
                    'intercept': coefficients[1],
                    'rmse': rmse,
                    'n_points': len(current_time)
                })
                
                # Find point with largest residual as potential breakpoint
                if len(residuals) > 3:
                    breakpoint_idx = np.argmax(residuals)
                    
                    # Split at breakpoint if it significantly improves fit
                    if residuals[breakpoint_idx] > rmse * 1.5:
                        # Split into two segments
                        time_left = current_time[:breakpoint_idx+1]
                        values_left = current_values[:breakpoint_idx+1]
                        time_right = current_time[breakpoint_idx:]
                        values_right = current_values[breakpoint_idx:]
                        
                        # Process left segment
                        if len(time_left) >= 3:
                            left_coeffs = np.polyfit(time_left, values_left, 1)
                            left_predicted = np.polyval(left_coeffs, time_left)
                            left_rmse = np.sqrt(np.mean((values_left - left_predicted)**2))
                            
                            segments[-1] = {
                                'start_time': time_left[0],
                                'end_time': time_left[-1],
                                'start_value': values_left[0],
                                'end_value': values_left[-1],
                                'slope': left_coeffs[0],
                                'intercept': left_coeffs[1],
                                'rmse': left_rmse,
                                'n_points': len(time_left)
                            }
                            
                            # Add right segment
                            right_coeffs = np.polyfit(time_right, values_right, 1)
                            right_predicted = np.polyval(right_coeffs, time_right)
                            right_rmse = np.sqrt(np.mean((values_right - right_predicted)**2))
                            
                            segments.append({
                                'start_time': time_right[0],
                                'end_time': time_right[-1],
                                'start_value': values_right[0],
                                'end_value': values_right[-1],
                                'slope': right_coeffs[0],
                                'intercept': right_coeffs[1],
                                'rmse': right_rmse,
                                'n_points': len(time_right)
                            })
                        
                        break
                    else:
                        break
                else:
                    break
            
            # Generate fitted values
            fitted = np.full(len(time_coords), np.nan)
            fitted[valid_mask] = self._generate_fitted_values(
                time_coords, segments, time_sorted, values_sorted, valid_mask
            )
            
            # Calculate overall RMSE
            valid_fitted = fitted[valid_mask]
            overall_rmse = np.sqrt(np.mean((values_sorted - valid_fitted)**2))
            
            return {
                'fitted': fitted,
                'segments': segments,
                'rmse': overall_rmse,
                'n_segments': len(segments)
            }
            
        except Exception as e:
            logger.warning(f"Error in piecewise linear fitting: {e}")
            return None
    
    def _generate_fitted_values(self,
                               time_coords: np.ndarray,
                               segments: List[Dict],
                               original_time: np.ndarray,
                               original_values: np.ndarray,
                               valid_mask: np.ndarray) -> np.ndarray:
        """Generate fitted values using segments."""
        
        fitted = np.full(len(time_coords), np.nan)
        
        for segment in segments:
            # Find points within this segment
            in_segment = (time_coords >= segment['start_time']) & \
                        (time_coords <= segment['end_time'])
            
            # Calculate fitted values for points in segment
            if in_segment.sum() > 0:
                segment_time = time_coords[in_segment]
                fitted[in_segment] = segment['slope'] * segment_time + segment['intercept']
        
        return fitted
    
    def _calculate_model_quality(self,
                                original_values: np.ndarray,
                                fitted_values: np.ndarray,
                                valid_pixels: int,
                                total_pixels: int) -> Dict:
        """Calculate model quality metrics."""
        
        try:
            # Calculate global RMSE and other metrics
            mask = ~(np.isnan(original_values) | np.isnan(fitted_values))
            
            if mask.sum() > 0:
                global_rmse = np.sqrt(np.mean((original_values[mask] - fitted_values[mask])**2))
                global_mae = np.mean(np.abs(original_values[mask] - fitted_values[mask]))
                global_r2 = self._calculate_r_squared(original_values[mask], fitted_values[mask])
            else:
                global_rmse = np.nan
                global_mae = np.nan
                global_r2 = np.nan
            
            return {
                'global_rmse': global_rmse,
                'global_mae': global_mae,
                'global_r2': global_r2,
                'valid_pixels_ratio': valid_pixels / total_pixels if total_pixels > 0 else 0,
                'total_pixels': total_pixels,
                'valid_pixels': valid_pixels
            }
            
        except Exception as e:
            logger.warning(f"Error calculating model quality: {e}")
            return {}
    
    def _calculate_r_squared(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate R-squared coefficient of determination."""
        
        try:
            ss_res = np.sum((y_true - y_pred) ** 2)
            ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
            
            if ss_tot == 0:
                return 1.0 if ss_res == 0 else 0.0
            
            return 1 - (ss_res / ss_tot)
            
        except Exception:
            return 0.0
    
    def _datetime_to_numeric(self, dt: datetime) -> float:
        """Convert datetime to numeric value (years since epoch)."""
        
        try:
            if isinstance(dt, str):
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            
            epoch = datetime(1970, 1, 1)
            return (dt - epoch).days / 365.25
            
        except Exception:
            return 0.0
    
    def detect_changes(self, fitted_model: Dict, change_threshold: float = 0.1) -> Dict:
        """Detect changes using the fitted LandTrendr model."""
        
        try:
            logger.info("Detecting changes using LandTrendr model")
            
            index_name = fitted_model['index_name']
            fitted_dataset = fitted_model['fitted_dataset']
            segment_info = fitted_model['segment_info']
            
            if fitted_dataset is None:
                raise ValueError("No fitted dataset available")
            
            # Get time coordinates
            time_coords = fitted_dataset.time.values
            
            # Calculate change magnitude for each time step
            changes_detected = []
            
            for i in range(1, len(time_coords)):
                current_data = fitted_dataset[f'{index_name}_fitted'].isel(time=i)
                previous_data = fitted_dataset[f'{index_name}_fitted'].isel(time=i-1)
                
                # Calculate change magnitude
                change_magnitude = current_data - previous_data
                change_significance = np.abs(change_magnitude)
                
                # Identify significant changes
                significant_changes = change_significance > change_threshold
                
                changes_detected.append({
                    'time_index': i,
                    'time_value': time_coords[i],
                    'change_magnitude': change_magnitude,
                    'change_significance': change_significance,
                    'significant_changes': significant_changes,
                    'change_count': int(significant_changes.sum().item()),
                    'change_percentage': float(significant_changes.mean().item() * 100)
                })
            
            # Compile results
            change_results = {
                'index_name': index_name,
                'time_coords': time_coords,
                'changes_detected': changes_detected,
                'total_time_steps': len(time_coords),
                'change_threshold': change_threshold,
                'model_summary': fitted_model['model_quality'],
                'summary': {
                    'max_change_percentage': max(c['change_percentage'] for c in changes_detected),
                    'avg_change_percentage': np.mean([c['change_percentage'] for c in changes_detected]),
                    'total_significant_changes': sum(c['change_count'] for c in changes_detected)
                }
            }
            
            logger.info(f"Change detection completed. Found changes at {len(changes_detected)} time steps")
            return change_results
            
        except Exception as e:
            logger.error(f"Error in change detection: {e}")
            raise
    
    def create_change_maps(self, 
                          fitted_model: Dict,
                          changes_detected: Dict,
                          time_step: int) -> Dict[str, xr.DataArray]:
        """Create change maps for a specific time step."""
        
        try:
            logger.info(f"Creating change maps for time step {time_step}")
            
            index_name = fitted_model['index_name']
            changes = changes_detected['changes_detected']
            
            if time_step >= len(changes):
                raise ValueError(f"Time step {time_step} not available")
            
            change_info = changes[time_step]
            
            # Extract change information
            change_magnitude = change_info['change_magnitude']
            change_significance = change_info['change_significance']
            significant_changes = change_info['significant_changes']
            
            # Create change classification map
            change_classification = xr.zeros_like(significant_changes, dtype=int)
            
            # Classify changes
            change_classification = xr.where(
                (change_significance > self.settings.CONFIDENCE_SCORE_THRESHOLD) & 
                (change_magnitude > 0),
                1,  # Positive change (increase)
                change_classification
            )
            
            change_classification = xr.where(
                (change_significance > self.settings.CONFIDENCE_SCORE_THRESHOLD) & 
                (change_magnitude < 0),
                -1,  # Negative change (decrease)
                change_classification
            )
            
            change_classification = xr.where(
                change_significance <= self.settings.CONFIDENCE_SCORE_THRESHOLD,
                0,  # No significant change
                change_classification
            )
            
            # Create maps dictionary
            change_maps = {
                'change_magnitude': change_magnitude,
                'change_significance': change_significance,
                'significant_changes': significant_changes,
                'change_classification': change_classification
            }
            
            # Add metadata
            for map_name, data in change_maps.items():
                data.attrs = {
                    'description': f'{map_name} for time step {time_step}',
                    'time_value': str(change_info['time_value']),
                    'threshold': self.settings.CONFIDENCE_SCORE_THRESHOLD if 'significant' in map_name else None
                }
            
            logger.info(f"Created {len(change_maps)} change maps")
            return change_maps
            
        except Exception as e:
            logger.error(f"Error creating change maps: {e}")
            raise